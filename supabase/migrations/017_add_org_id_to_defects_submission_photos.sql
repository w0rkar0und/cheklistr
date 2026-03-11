-- Migration 017: Add org_id to defects and submission_photos
-- Denormalises org_id from parent submissions table for:
-- 1. Direct RLS filtering (no subquery through submissions)
-- 2. Index-based org-scoped queries
-- 3. Explicit audit trail

BEGIN;

-- ==========================================
-- 1. ADD org_id COLUMN TO submission_photos
-- ==========================================

ALTER TABLE public.submission_photos
  ADD COLUMN org_id UUID REFERENCES public.organisations(id);

-- Backfill from parent submissions
UPDATE public.submission_photos sp
  SET org_id = s.org_id
  FROM public.submissions s
  WHERE sp.submission_id = s.id;

-- Make NOT NULL after backfill
ALTER TABLE public.submission_photos
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX idx_submission_photos_org_id ON public.submission_photos(org_id);

-- ==========================================
-- 2. ADD org_id COLUMN TO defects
-- ==========================================

ALTER TABLE public.defects
  ADD COLUMN org_id UUID REFERENCES public.organisations(id);

-- Backfill from parent submissions
UPDATE public.defects d
  SET org_id = s.org_id
  FROM public.submissions s
  WHERE d.submission_id = s.id;

-- Make NOT NULL after backfill
ALTER TABLE public.defects
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX idx_defects_org_id ON public.defects(org_id);

-- ==========================================
-- 3. REWRITE submission_photos RLS POLICIES
-- ==========================================
-- Replace subquery-based policies with direct org_id checks.

DROP POLICY IF EXISTS "Users can view own submission photos" ON public.submission_photos;
DROP POLICY IF EXISTS "Users can create own submission photos" ON public.submission_photos;
DROP POLICY IF EXISTS "Admins can view org submission photos" ON public.submission_photos;
DROP POLICY IF EXISTS "Super admins can view all submission photos" ON public.submission_photos;

-- Users can view their own submission photos (via parent submission ownership)
CREATE POLICY "Users can view own submission photos"
  ON public.submission_photos FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can create submission photos in their org
CREATE POLICY "Users can create own submission photos"
  ON public.submission_photos FOR INSERT
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Admins can view all submission photos in their org (direct org_id check)
CREATE POLICY "Admins can view org submission photos"
  ON public.submission_photos FOR SELECT
  USING (
    org_id = public.get_user_org_id()
    AND public.is_admin()
  );

-- Super admins can view all submission photos
CREATE POLICY "Super admins can view all submission photos"
  ON public.submission_photos FOR SELECT
  USING (public.is_super_admin());

-- ==========================================
-- 4. REWRITE defects RLS POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own defects" ON public.defects;
DROP POLICY IF EXISTS "Users can create own defects" ON public.defects;
DROP POLICY IF EXISTS "Admins can view org defects" ON public.defects;
DROP POLICY IF EXISTS "Super admins can view all defects" ON public.defects;

-- Users can view their own defects (via parent submission ownership)
CREATE POLICY "Users can view own defects"
  ON public.defects FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can create defects in their org
CREATE POLICY "Users can create own defects"
  ON public.defects FOR INSERT
  WITH CHECK (
    org_id = public.get_user_org_id()
    AND submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Admins can view all defects in their org (direct org_id check)
CREATE POLICY "Admins can view org defects"
  ON public.defects FOR SELECT
  USING (
    org_id = public.get_user_org_id()
    AND public.is_admin()
  );

-- Super admins can view all defects
CREATE POLICY "Super admins can view all defects"
  ON public.defects FOR SELECT
  USING (public.is_super_admin());

COMMIT;
