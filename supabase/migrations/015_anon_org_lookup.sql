-- Migration 015: Allow anonymous org lookup for login flow
-- =========================================================
-- The login page needs to validate an organisation slug BEFORE the user
-- authenticates.  At that point there is no auth.uid(), so the existing
-- RLS policies (which require authentication) block the query.
--
-- We add a minimal anon-accessible SELECT policy restricted to active
-- organisations only.  The organisations table contains no sensitive
-- data (name, slug, logo_url, primary_colour, is_active).

BEGIN;

CREATE POLICY "Anon can read active organisations for login"
  ON public.organisations FOR SELECT
  TO anon
  USING (is_active = true);

COMMIT;
