-- ============================================================
-- Cheklistr: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- HELPER: Check if current user is admin
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- USERS TABLE POLICIES
-- ==========================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Admins can read all users
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (public.is_admin());

-- Admins can create users
CREATE POLICY "Admins can create users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update users
CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_admin());

-- Users can update their own profile (limited fields handled at app level)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ==========================================
-- SESSIONS TABLE POLICIES
-- ==========================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own sessions
CREATE POLICY "Users can create own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions (for termination)
CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON public.sessions FOR SELECT
  USING (public.is_admin());

-- Admins can update any session (force-terminate)
CREATE POLICY "Admins can update any session"
  ON public.sessions FOR UPDATE
  USING (public.is_admin());

-- ==========================================
-- CHECKLISTS TABLE POLICIES
-- ==========================================

-- Everyone authenticated can read active checklists
CREATE POLICY "Authenticated users can view active checklists"
  ON public.checklists FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage checklists
CREATE POLICY "Admins can create checklists"
  ON public.checklists FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update checklists"
  ON public.checklists FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete checklists"
  ON public.checklists FOR DELETE
  USING (public.is_admin());

-- ==========================================
-- CHECKLIST VERSIONS TABLE POLICIES
-- ==========================================

-- Everyone authenticated can read versions (needed to render forms)
CREATE POLICY "Authenticated users can view checklist versions"
  ON public.checklist_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins can manage versions
CREATE POLICY "Admins can create checklist versions"
  ON public.checklist_versions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update checklist versions"
  ON public.checklist_versions FOR UPDATE
  USING (public.is_admin());

-- ==========================================
-- CHECKLIST SECTIONS TABLE POLICIES
-- ==========================================

CREATE POLICY "Authenticated users can view checklist sections"
  ON public.checklist_sections FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist sections"
  ON public.checklist_sections FOR ALL
  USING (public.is_admin());

-- ==========================================
-- CHECKLIST ITEMS TABLE POLICIES
-- ==========================================

CREATE POLICY "Authenticated users can view checklist items"
  ON public.checklist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage checklist items"
  ON public.checklist_items FOR ALL
  USING (public.is_admin());

-- ==========================================
-- SUBMISSIONS TABLE POLICIES
-- ==========================================

-- Site managers can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON public.submissions FOR SELECT
  USING (user_id = auth.uid());

-- Site managers can create submissions
CREATE POLICY "Users can create own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Site managers can update their own draft submissions
CREATE POLICY "Users can update own drafts"
  ON public.submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON public.submissions FOR SELECT
  USING (public.is_admin());

-- Admins can update any submission (e.g. mark as synced)
CREATE POLICY "Admins can update any submission"
  ON public.submissions FOR UPDATE
  USING (public.is_admin());

-- ==========================================
-- SUBMISSION PHOTOS TABLE POLICIES
-- ==========================================

-- Users can view photos for their own submissions
CREATE POLICY "Users can view own submission photos"
  ON public.submission_photos FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can add photos to their own submissions
CREATE POLICY "Users can create own submission photos"
  ON public.submission_photos FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Admins can view all photos
CREATE POLICY "Admins can view all submission photos"
  ON public.submission_photos FOR SELECT
  USING (public.is_admin());

-- ==========================================
-- CHECKLIST RESPONSES TABLE POLICIES
-- ==========================================

-- Users can view responses for their own submissions
CREATE POLICY "Users can view own checklist responses"
  ON public.checklist_responses FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can create responses for their own submissions
CREATE POLICY "Users can create own checklist responses"
  ON public.checklist_responses FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can update responses for their own draft submissions
CREATE POLICY "Users can update own draft responses"
  ON public.checklist_responses FOR UPDATE
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid() AND status = 'draft'
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all checklist responses"
  ON public.checklist_responses FOR SELECT
  USING (public.is_admin());

-- ==========================================
-- DEFECTS TABLE POLICIES
-- ==========================================

-- Users can view defects for their own submissions
CREATE POLICY "Users can view own defects"
  ON public.defects FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Users can create defects for their own submissions
CREATE POLICY "Users can create own defects"
  ON public.defects FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

-- Admins can view all defects
CREATE POLICY "Admins can view all defects"
  ON public.defects FOR SELECT
  USING (public.is_admin());
