-- ============================================================
-- Migration 005: Replace email-based login with User ID
-- ============================================================
-- Adds a unique login_id column to the users table.
-- Users log in with this ID instead of an email address.
-- Supabase Auth still requires an email internally, so we
-- generate synthetic emails ({login_id}@cheklistr.app).
-- ============================================================

-- 1. Add login_id column
ALTER TABLE public.users
  ADD COLUMN login_id TEXT;

-- 2. Backfill existing users: derive login_id from email prefix
UPDATE public.users
  SET login_id = SPLIT_PART(email, '@', 1)
  WHERE login_id IS NULL;

-- 3. Make it NOT NULL and UNIQUE
ALTER TABLE public.users
  ALTER COLUMN login_id SET NOT NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_login_id_unique UNIQUE (login_id);

-- 4. Make email nullable (no longer required for user-facing purposes)
ALTER TABLE public.users
  ALTER COLUMN email DROP NOT NULL;

-- 5. Index for fast login lookups
CREATE INDEX idx_users_login_id ON public.users (login_id);
