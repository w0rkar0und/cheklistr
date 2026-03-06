-- ============================================================
-- Fix window question wording
-- The van should NOT have side/rear windows (panel van).
-- Reword to match the "Is the van free of…" pattern so that
-- Yes = pass (no windows) and No = fail (has windows).
-- ============================================================

UPDATE public.checklist_items
SET label = 'Is the van free of side and rear windows?'
WHERE section_id = 'c0000000-0000-0000-0000-000000000001'
  AND display_order = 6
  AND label = 'Does the van have windows at sides/back?';
