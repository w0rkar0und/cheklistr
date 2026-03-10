-- ============================================================
-- Migration 012b: Multi-Tenancy Foundation
-- ============================================================
-- Creates the organisations table, threads org_id through
-- users/checklists/submissions/sessions, updates the login_id
-- uniqueness constraint, creates helper functions, and updates RPCs.
--
-- This migration seeds Greythorn as the first org and
-- backfills all existing data to belong to it.
--
-- PREREQUISITE: Run 012a first (adds super_admin enum value).
-- IMPORTANT: Run this BEFORE migration 013 (RLS rewrite)
-- and 014 (storage changes).
-- ============================================================

BEGIN;

-- ==========================================
-- 1. CREATE ORGANISATIONS TABLE
-- ==========================================

CREATE TABLE public.organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  logo_url        TEXT,
  primary_colour  TEXT NOT NULL DEFAULT '#2E4057',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organisations_slug ON public.organisations(slug);
CREATE INDEX idx_organisations_active ON public.organisations(is_active) WHERE is_active = true;

COMMENT ON TABLE public.organisations IS 'Tenant organisations for multi-tenancy SaaS model';
COMMENT ON COLUMN public.organisations.slug IS 'URL-safe identifier used in path routing (e.g. /org/greythorn)';
COMMENT ON COLUMN public.organisations.logo_url IS 'Path to org logo in org-assets storage bucket';
COMMENT ON COLUMN public.organisations.primary_colour IS 'Hex colour for white-label branding';

-- Apply updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- 2. SEED GREYTHORN AS FIRST ORGANISATION
-- ==========================================

INSERT INTO public.organisations (id, name, slug, primary_colour)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Greythorn Contract Logistics',
  'greythorn',
  '#2E4057'
);

-- ==========================================
-- 3. ADD org_id TO PARENT TABLES
-- ==========================================
-- Strategy: add column with default → backfill → drop default → set NOT NULL

-- 3a. users
ALTER TABLE public.users
  ADD COLUMN org_id UUID REFERENCES public.organisations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.users SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.users ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN org_id DROP DEFAULT;

CREATE INDEX idx_users_org_id ON public.users(org_id);

-- 3b. checklists
ALTER TABLE public.checklists
  ADD COLUMN org_id UUID REFERENCES public.organisations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.checklists SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.checklists ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.checklists ALTER COLUMN org_id DROP DEFAULT;

CREATE INDEX idx_checklists_org_id ON public.checklists(org_id);

-- 3c. submissions
ALTER TABLE public.submissions
  ADD COLUMN org_id UUID REFERENCES public.organisations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.submissions SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.submissions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.submissions ALTER COLUMN org_id DROP DEFAULT;

CREATE INDEX idx_submissions_org_id ON public.submissions(org_id);

-- 3d. sessions
ALTER TABLE public.sessions
  ADD COLUMN org_id UUID REFERENCES public.organisations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.sessions SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

ALTER TABLE public.sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.sessions ALTER COLUMN org_id DROP DEFAULT;

CREATE INDEX idx_sessions_org_id ON public.sessions(org_id);

-- ==========================================
-- 4. UPDATE login_id UNIQUENESS
-- ==========================================
-- Currently: login_id is globally unique.
-- New: login_id is unique WITHIN an organisation.
-- Two orgs can have user X000001 independently.

ALTER TABLE public.users
  DROP CONSTRAINT users_login_id_unique;

ALTER TABLE public.users
  ADD CONSTRAINT users_login_id_org_unique UNIQUE (org_id, login_id);

-- ==========================================
-- 5. HELPER FUNCTIONS FOR MULTI-TENANCY
-- ==========================================

-- 5a. Get the org_id of the currently authenticated user.
-- Returns NULL if user not found (e.g. super_admin without org).
-- SECURITY DEFINER so it bypasses RLS when reading users table.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_org_id IS 'Returns the org_id of the currently authenticated user for RLS filtering';

-- 5b. Check if current user is a super_admin.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if the current user has super_admin role (platform operator)';

-- 5c. Update is_admin() to also return true for super_admin.
-- This ensures existing admin-level operations still work
-- for super_admins without needing separate checks everywhere.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- 6. UPDATE admin_create_user RPC
-- ==========================================
-- Now accepts org_id and validates the calling admin
-- belongs to the same org (or is super_admin).

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_user_id       UUID,
  p_login_id      TEXT,
  p_full_name     TEXT,
  p_email         TEXT,
  p_role          user_role,
  p_org_id        UUID,
  p_contractor_id TEXT DEFAULT NULL,
  p_site_code     TEXT DEFAULT NULL,
  p_admin_id      UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role user_role;
  v_admin_org_id UUID;
BEGIN
  -- Fetch the admin's role and org
  SELECT role, org_id INTO v_admin_role, v_admin_org_id
  FROM public.users
  WHERE id = p_admin_id AND is_active = true;

  -- Must be an active admin or super_admin
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorised: only active admins can create users';
  END IF;

  -- Org-scoped admins can only create users in their own org
  IF v_admin_role = 'admin' AND v_admin_org_id != p_org_id THEN
    RAISE EXCEPTION 'Unauthorised: admins can only create users in their own organisation';
  END IF;

  -- Validate the target org exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.organisations WHERE id = p_org_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Organisation not found or inactive';
  END IF;

  -- Only super_admin can create other super_admins
  IF p_role = 'super_admin' AND v_admin_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorised: only super_admins can create super_admin users';
  END IF;

  -- Insert the new user profile
  INSERT INTO public.users (id, login_id, full_name, email, role, org_id, contractor_id, site_code, is_active)
  VALUES (p_user_id, p_login_id, p_full_name, p_email, p_role, p_org_id, p_contractor_id, p_site_code, true);
END;
$$;

-- ==========================================
-- 7. ENABLE RLS ON ORGANISATIONS TABLE
-- ==========================================

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies until migration 013 rewrites them all.
-- These ensure the app continues to function between migrations.

-- All authenticated users can read their own org
CREATE POLICY "temp_users_read_own_org"
  ON public.organisations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Super admins can do everything
CREATE POLICY "temp_super_admin_full_access"
  ON public.organisations FOR ALL
  USING (public.is_super_admin());

COMMIT;
