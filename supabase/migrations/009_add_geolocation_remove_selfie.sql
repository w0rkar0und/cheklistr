-- 009: Add geolocation to submissions + remove selfie scaffolding
-- Deploy: Run in Supabase SQL Editor

-- ============================================
-- 1. Add geolocation columns to submissions
-- ============================================
ALTER TABLE public.submissions
  ADD COLUMN latitude  DECIMAL(10, 8),
  ADD COLUMN longitude DECIMAL(11, 8);

COMMENT ON COLUMN public.submissions.latitude IS 'GPS latitude at time of submission';
COMMENT ON COLUMN public.submissions.longitude IS 'GPS longitude at time of submission';

-- Index for potential geo-based queries
CREATE INDEX idx_submissions_geo ON public.submissions(latitude, longitude)
  WHERE latitude IS NOT NULL;

-- ============================================
-- 2. Remove selfie scaffolding from sessions
-- ============================================
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS selfie_url;

-- ============================================
-- 3. Remove selfie-captures storage policies
--    (bucket must be deleted manually via Supabase Dashboard > Storage)
-- ============================================
DROP POLICY IF EXISTS "Users can upload selfies" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own selfies" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all selfies" ON storage.objects;

-- NOTE: Delete the 'selfie-captures' bucket manually in
-- Supabase Dashboard > Storage > selfie-captures > Delete bucket
