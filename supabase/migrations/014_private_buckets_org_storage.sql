-- ============================================================
-- Migration 014: Private Buckets + Org-Prefixed Storage
-- ============================================================
-- Reverts photo buckets from public to private (security fix).
-- Rewrites storage policies with org-prefixed paths.
-- Creates org-assets bucket for organisation logos/branding.
--
-- After this migration, all photo URLs require signed URLs
-- generated via supabase.storage.createSignedUrl().
--
-- Storage path convention:
--   {bucket}/{org_id}/{submission_id}/{filename}
--
-- Legacy paths ({submission_id}/{filename}) remain readable
-- for Greythorn's existing data via a backward-compat policy.
--
-- REQUIRES: Migration 012 + 013 applied first.
-- ============================================================

BEGIN;

-- ==========================================
-- 1. REVERT BUCKETS TO PRIVATE
-- ==========================================

UPDATE storage.buckets SET public = false WHERE id = 'vehicle-photos';
UPDATE storage.buckets SET public = false WHERE id = 'defect-photos';
UPDATE storage.buckets SET public = false WHERE id = 'checklist-photos';

-- ==========================================
-- 2. DROP ALL EXISTING STORAGE POLICIES
-- ==========================================

-- vehicle-photos
DROP POLICY IF EXISTS "Users can upload vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all vehicle photos" ON storage.objects;

-- checklist-photos
DROP POLICY IF EXISTS "Users can upload checklist photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own checklist photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all checklist photos" ON storage.objects;

-- defect-photos
DROP POLICY IF EXISTS "Users can upload defect photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own defect photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all defect photos" ON storage.objects;

-- ==========================================
-- 3. CREATE ORG-ASSETS BUCKET
-- ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-assets',
  'org-assets',
  true,  -- Public read (logos are shown on login page before auth)
  2097152,  -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
);

-- ==========================================
-- 4. HELPER: Extract org_id from storage path
-- ==========================================
-- Storage paths follow: {org_id}/{submission_id}/{filename}
-- The first path segment is the org_id.

CREATE OR REPLACE FUNCTION storage.get_path_org_id(path TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN (SPLIT_PART(path, '/', 1))::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;  -- Legacy path without org prefix
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION storage.get_path_org_id IS 'Extracts org UUID from first segment of storage path';

-- ==========================================
-- 5. PHOTO BUCKET POLICIES (ORG-SCOPED)
-- ==========================================
-- Pattern: Users upload/read within their org prefix.
-- Admins read within their org prefix.
-- Super admins read everything.
-- Legacy paths (no org prefix) readable for backward compat.

-- ---- vehicle-photos ----

CREATE POLICY "Org users can upload vehicle photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND auth.uid() IS NOT NULL
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

CREATE POLICY "Org users can view own org vehicle photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-photos'
    AND auth.uid() IS NOT NULL
    AND (
      storage.get_path_org_id(name) = public.get_user_org_id()
      OR storage.get_path_org_id(name) IS NULL  -- Legacy paths
    )
  );

CREATE POLICY "Super admins can view all vehicle photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-photos'
    AND public.is_super_admin()
  );

-- ---- checklist-photos ----

CREATE POLICY "Org users can upload checklist photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

CREATE POLICY "Org users can view own org checklist photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
    AND (
      storage.get_path_org_id(name) = public.get_user_org_id()
      OR storage.get_path_org_id(name) IS NULL
    )
  );

CREATE POLICY "Super admins can view all checklist photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND public.is_super_admin()
  );

-- ---- defect-photos ----

CREATE POLICY "Org users can upload defect photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'defect-photos'
    AND auth.uid() IS NOT NULL
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

CREATE POLICY "Org users can view own org defect photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'defect-photos'
    AND auth.uid() IS NOT NULL
    AND (
      storage.get_path_org_id(name) = public.get_user_org_id()
      OR storage.get_path_org_id(name) IS NULL
    )
  );

CREATE POLICY "Super admins can view all defect photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'defect-photos'
    AND public.is_super_admin()
  );

-- ==========================================
-- 6. ORG-ASSETS BUCKET POLICIES
-- ==========================================
-- Public read (logos shown pre-auth on login page).
-- Write restricted to admins of that org + super admins.
-- Path convention: {org_id}/{filename}

-- Anyone can read org assets (public bucket, but policies still apply for writes)
CREATE POLICY "Anyone can view org assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-assets');

-- Admins can upload to their org's folder
CREATE POLICY "Admins can upload org assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-assets'
    AND public.is_admin()
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

-- Admins can update their org's assets
CREATE POLICY "Admins can update org assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-assets'
    AND public.is_admin()
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

-- Admins can delete their org's assets
CREATE POLICY "Admins can delete org assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-assets'
    AND public.is_admin()
    AND storage.get_path_org_id(name) = public.get_user_org_id()
  );

-- Super admins can manage all org assets
CREATE POLICY "Super admins can manage all org assets"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'org-assets'
    AND public.is_super_admin()
  );

COMMIT;
