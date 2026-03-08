-- Migration 010: Add soft-delete (archiving) for submissions
-- Adds archived_at timestamp and archived_by reference.
-- NULL archived_at = active; populated = archived.
-- Existing admin UPDATE RLS policy already covers these columns.

ALTER TABLE public.submissions
  ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN archived_by UUID REFERENCES public.users(id) DEFAULT NULL;

-- Partial index for fast filtering of active submissions
CREATE INDEX idx_submissions_active
  ON public.submissions (created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.submissions.archived_at IS 'Soft-delete timestamp. NULL = active.';
COMMENT ON COLUMN public.submissions.archived_by IS 'UUID of admin who archived the submission.';
