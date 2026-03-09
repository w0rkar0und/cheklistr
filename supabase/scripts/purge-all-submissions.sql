-- =============================================================================
-- PURGE ALL SUBMISSIONS + RELATED DATA
-- =============================================================================
-- Removes all test/manual submissions and their associated data.
-- Run manually via Supabase SQL Editor when cleaning up after testing.
--
-- What this deletes:
--   1. checklist_responses  (cascaded via FK)
--   2. submission_photos    (cascaded via FK)
--   3. defects              (cascaded via FK)
--   4. submissions          (parent table — cascade handles children)
--
-- What this does NOT delete:
--   - Checklists, versions, sections, items (template data)
--   - Users / profiles
--   - Sessions
--
-- STORAGE CLEANUP:
--   Supabase prevents direct SQL deletes on storage.objects (trigger guard).
--   After running this SQL, empty the storage buckets via the Dashboard:
--     1. Go to Storage in the Supabase Dashboard
--     2. Open each bucket: vehicle-photos, defect-photos, checklist-photos
--     3. Select all → Delete
--   Or run the companion script: supabase/scripts/purge-storage.ts
-- =============================================================================

-- Delete all submissions (cascades to responses, photos rows, defects)
DELETE FROM public.submissions;

-- ─── Verify ─────────────────────────────────────────────────────────────────
SELECT 'submissions' AS table_name, COUNT(*) AS remaining FROM public.submissions
UNION ALL
SELECT 'checklist_responses', COUNT(*) FROM public.checklist_responses
UNION ALL
SELECT 'submission_photos', COUNT(*) FROM public.submission_photos
UNION ALL
SELECT 'defects', COUNT(*) FROM public.defects;
