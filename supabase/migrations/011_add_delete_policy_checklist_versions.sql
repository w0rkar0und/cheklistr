-- ============================================================
-- Add missing DELETE policy for checklist_versions
-- ============================================================
-- checklist_sections and checklist_items already have FOR ALL
-- policies covering DELETE, but checklist_versions only had
-- SELECT, INSERT, UPDATE — causing silent RLS-blocked deletes.
-- ============================================================

CREATE POLICY "Admins can delete checklist versions"
  ON public.checklist_versions FOR DELETE
  USING (public.is_admin());
