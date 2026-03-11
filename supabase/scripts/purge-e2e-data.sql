-- =============================================================================
-- PURGE E2E TEST DATA
-- =============================================================================
-- Removes all data created by E2E test runs while preserving:
--   - Greythorn organisation (slug: greythorn)
--   - m.patel super admin user (login_id: M.PATEL)
--   - GREYADMIN01 admin user
--   - TESTUSER01 site manager user
--   - Greythorn's checklist templates
--
-- Run via Supabase SQL Editor. Then run the companion storage script:
--   npx tsx supabase/scripts/purge-storage.ts
--
-- ORDER MATTERS — foreign keys enforce deletion order.
-- =============================================================================

-- ── 0. Define preserved IDs ─────────────────────────────────────────────────
-- Greythorn org
DO $$
DECLARE
  greythorn_id UUID := '00000000-0000-0000-0000-000000000001';
  preserved_logins TEXT[] := ARRAY['M.PATEL', 'GREYADMIN01', 'TESTUSER01'];
  deleted_count BIGINT;
BEGIN

  -- ── 1. Delete ALL submissions (cascades to responses, photos, defects) ────
  DELETE FROM public.submissions;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % submissions (+ cascaded responses, photos, defects)', deleted_count;

  -- ── 2. Delete ALL sessions ────────────────────────────────────────────────
  DELETE FROM public.sessions;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % sessions', deleted_count;

  -- ── 3. Delete test users (non-preserved) ──────────────────────────────────
  -- First delete from auth.users (the public.users row references auth.users)
  -- We need to delete public.users first due to FK, then auth.users
  DELETE FROM public.users
    WHERE login_id != ALL(preserved_logins);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % test users from public.users', deleted_count;

  -- Delete orphaned auth.users (those not referenced by any public.users row)
  DELETE FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.users);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphaned auth.users entries', deleted_count;

  -- ── 4. Delete test organisations (non-Greythorn) ─────────────────────────
  DELETE FROM public.organisations
    WHERE id != greythorn_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % test organisations', deleted_count;

END $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT 'organisations' AS table_name, COUNT(*) AS remaining FROM public.organisations
UNION ALL
SELECT 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'sessions', COUNT(*) FROM public.sessions
UNION ALL
SELECT 'submissions', COUNT(*) FROM public.submissions
UNION ALL
SELECT 'checklist_responses', COUNT(*) FROM public.checklist_responses
UNION ALL
SELECT 'submission_photos', COUNT(*) FROM public.submission_photos
UNION ALL
SELECT 'defects', COUNT(*) FROM public.defects;

-- Expected results:
--   organisations:       1  (Greythorn)
--   users:               3  (M.PATEL, GREYADMIN01, TESTUSER01)
--   sessions:            0
--   submissions:         0
--   checklist_responses: 0
--   submission_photos:   0
--   defects:             0
