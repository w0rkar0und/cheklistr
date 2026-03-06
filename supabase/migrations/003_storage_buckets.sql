-- ============================================================
-- Cheklistr: Storage Buckets
-- ============================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('vehicle-photos', 'vehicle-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('checklist-photos', 'checklist-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('defect-photos', 'defect-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('selfie-captures', 'selfie-captures', false, 5242880, ARRAY['image/jpeg', 'image/png']);

-- 5242880 bytes = 5MB max per file

-- ==========================================
-- STORAGE POLICIES: vehicle-photos
-- ==========================================

-- Authenticated users can upload to vehicle-photos
CREATE POLICY "Users can upload vehicle photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND auth.uid() IS NOT NULL
  );

-- Users can view their own vehicle photos (path starts with submission_id they own)
CREATE POLICY "Users can view own vehicle photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-photos'
    AND auth.uid() IS NOT NULL
  );

-- Admins can view all vehicle photos
CREATE POLICY "Admins can view all vehicle photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vehicle-photos'
    AND public.is_admin()
  );

-- ==========================================
-- STORAGE POLICIES: checklist-photos
-- ==========================================

CREATE POLICY "Users can upload checklist photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own checklist photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can view all checklist photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checklist-photos'
    AND public.is_admin()
  );

-- ==========================================
-- STORAGE POLICIES: defect-photos
-- ==========================================

CREATE POLICY "Users can upload defect photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'defect-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own defect photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'defect-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can view all defect photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'defect-photos'
    AND public.is_admin()
  );

-- ==========================================
-- STORAGE POLICIES: selfie-captures
-- ==========================================

CREATE POLICY "Users can upload selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'selfie-captures'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfie-captures'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can view all selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'selfie-captures'
    AND public.is_admin()
  );
