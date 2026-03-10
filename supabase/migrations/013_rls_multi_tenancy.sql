-- ============================================================
-- Migration 013: Rewrite All RLS Policies for Multi-Tenancy
-- ============================================================
-- Drops every existing RLS policy and recreates them with
-- org_id filtering via get_user_org_id(). Super admins
-- bypass org filtering on all tables.
--
-- REQUIRES: Migration 012 (organisations table, org_id columns,
-- helper functions) must be applied first.
-- ============================================================

BEGIN;

-- ==========================================
-- 1. DROP ALL EXISTING POLICIES
-- ==========================================

-- organisations (temp policies from 012)
DROP POLICY IF EXISTS "temp_users_read_own_org" ON public.organisations;
DROP POLICY IF EXISTS "temp_super_admin_full_access" ON public.organisations;

-- users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can create users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can update any session" ON public.sessions;

-- checklists
DROP POLICY IF EXISTS "Authenticated users can view active checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can create checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can update checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can delete checklists" ON public.checklists;

-- checklist_versions
DROP POLICY IF EXISTS "Authenticated users can view checklist versions" ON public.checklist_versions;
DROP POLICY IF EXISTS "Admins can create checklist versions" ON public.checklist_versions;
DROP POLICY IF EXISTS "Admins can update checklist versions" ON public.checklist_versions;
DROP POLICY IF EXISTS "Admins can delete checklist versions" ON public.checklist_versions;

-- checklist_sections
DROP POLICY IF EXISTS "Authenticated users can view checklist sections" ON public.checklist_sections;
DROP POLICY IF EXISTS "Admins can manage checklist sections" ON public.checklist_sections;

-- checklist_items
DROP POLICY IF EXISTS "Authenticated users can view checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins can manage checklist items" ON public.checklist_items;

-- submissions
DROP POLICY IF EXISTS "Users can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can create own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can update own drafts" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update any submission" ON public.submissions;

-- submission_photos
DROP POLICY IF EXISTS "Users can view own submission photos" ON public.submission_photos;
DROP POLICY IF EXISTS "Users can create own submission photos" ON public.submission_photos;
DROP POLICY IF EXISTS "Admins can view all submission photos" ON public.submission_photos;

-- checklist_responses
DROP POLICY IF EXISTS "Users can view own checklist responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can create own checklist responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Users can update own draft responses" ON public.checklist_responses;
DROP POLICY IF EXISTS "Admins can view all checklist responses" ON public.checklist_responses;

-- defects
DROP POLICY IF EXISTS "Users can view own defects" ON public.defects;
DROP POLICY IF EXISTS "Users can create own defects" ON public.defects;
DROP POLICY IF EXISTS "Admins can view all defects" ON public.defects;

-- ==========================================
-- 2. ORGANISATIONS TABLE POLICIES
-- ==========================================

-- Users can read their own organisation
CREATE POLICY "Users can view own organisation"
  ON public.organisations FOR SELECT
  USING (id = public.get_user_org_id());

-- Super admins can read all organisations
CREATE POLICY "Super admins can view all organisations"
  ON public.organisations FOR SELECT
  USING (public.is_super_admin());

-- Super admins can create organisations
CREATE POLICY "Super admins can create organisations"
  ON public.organisations FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Super admins can update organisations
CREATE POLICY "Super admins can update organisations"
  ON public.organisations FOR UPDATE
  USING (public.is_super_admin());

-- Org admins can update their own org (limited to branding fields at app level)
CREATE POLICY "Admins can update own organisation"
  ON public.organisations FOR UPDATE
  USING (id = public.get_user_org_id() AND public.is_admin());

-- ==========================================
-- 3. USERS TABLE POLICIES
-- ==========================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Admins can view all users in their org
CREATE POLICY "Admins can view org users"
  ON public.users FOR SELECT
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Super admins can view all users across all orgs
CREATE POLICY "Super admins can view all users"
  ON public.users FOR SELECT
  USING (public.is_super_admin());

-- User creation is handled by admin_create_user RPC (SECURITY DEFINER).
-- This INSERT policy covers the RPC's bypass path and super_admin direct inserts.
CREATE POLICY "Admins can create org users"
  ON public.users FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

CREATE POLICY "Super admins can create any user"
  ON public.users FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Admins can update users in their org
CREATE POLICY "Admins can update org users"
  ON public.users FOR UPDATE
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- Super admins can update any user
CREATE POLICY "Super admins can update any user"
  ON public.users FOR UPDATE
  USING (public.is_super_admin());

-- ==========================================
-- 4. SESSIONS TABLE POLICIES
-- ==========================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own sessions (must match their org)
CREATE POLICY "Users can create own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = public.get_user_org_id()
  );

-- Users can update their own sessions (for termination)
CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can view all sessions in their org
CREATE POLICY "Admins can view org sessions"
  ON public.sessions FOR SELECT
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Admins can update any session in their org (force-terminate)
CREATE POLICY "Admins can update org sessions"
  ON public.sessions FOR UPDATE
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Super admins can view/update all sessions
CREATE POLICY "Super admins can view all sessions"
  ON public.sessions FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can update any session"
  ON public.sessions FOR UPDATE
  USING (public.is_super_admin());

-- ==========================================
-- 5. CHECKLISTS TABLE POLICIES
-- ==========================================

-- Authenticated users can view checklists in their org
CREATE POLICY "Users can view org checklists"
  ON public.checklists FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND org_id = public.get_user_org_id()
  );

-- Admins can create checklists in their org
CREATE POLICY "Admins can create org checklists"
  ON public.checklists FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Admins can update checklists in their org
CREATE POLICY "Admins can update org checklists"
  ON public.checklists FOR UPDATE
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Admins can delete checklists in their org
CREATE POLICY "Admins can delete org checklists"
  ON public.checklists FOR DELETE
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Super admins can manage all checklists
CREATE POLICY "Super admins can manage all checklists"
  ON public.checklists FOR ALL
  USING (public.is_super_admin());

-- ==========================================
-- 6. CHECKLIST VERSIONS TABLE POLICIES
-- ==========================================
-- Versions don't have org_id directly — filter via parent checklist.

CREATE POLICY "Users can view org checklist versions"
  ON public.checklist_versions FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND checklist_id IN (
      SELECT id FROM public.checklists WHERE org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Admins can create org checklist versions"
  ON public.checklist_versions FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND checklist_id IN (
      SELECT id FROM public.checklists WHERE org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Admins can update org checklist versions"
  ON public.checklist_versions FOR UPDATE
  USING (
    public.is_admin()
    AND checklist_id IN (
      SELECT id FROM public.checklists WHERE org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Admins can delete org checklist versions"
  ON public.checklist_versions FOR DELETE
  USING (
    public.is_admin()
    AND checklist_id IN (
      SELECT id FROM public.checklists WHERE org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Super admins can manage all checklist versions"
  ON public.checklist_versions FOR ALL
  USING (public.is_super_admin());

-- ==========================================
-- 7. CHECKLIST SECTIONS TABLE POLICIES
-- ==========================================
-- Filter via version → checklist chain.

CREATE POLICY "Users can view org checklist sections"
  ON public.checklist_sections FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND checklist_version_id IN (
      SELECT cv.id FROM public.checklist_versions cv
      JOIN public.checklists c ON cv.checklist_id = c.id
      WHERE c.org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Admins can manage org checklist sections"
  ON public.checklist_sections FOR ALL
  USING (
    public.is_admin()
    AND checklist_version_id IN (
      SELECT cv.id FROM public.checklist_versions cv
      JOIN public.checklists c ON cv.checklist_id = c.id
      WHERE c.org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Super admins can manage all checklist sections"
  ON public.checklist_sections FOR ALL
  USING (public.is_super_admin());

-- ==========================================
-- 8. CHECKLIST ITEMS TABLE POLICIES
-- ==========================================
-- Filter via section → version → checklist chain.

CREATE POLICY "Users can view org checklist items"
  ON public.checklist_items FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND section_id IN (
      SELECT cs.id FROM public.checklist_sections cs
      JOIN public.checklist_versions cv ON cs.checklist_version_id = cv.id
      JOIN public.checklists c ON cv.checklist_id = c.id
      WHERE c.org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Admins can manage org checklist items"
  ON public.checklist_items FOR ALL
  USING (
    public.is_admin()
    AND section_id IN (
      SELECT cs.id FROM public.checklist_sections cs
      JOIN public.checklist_versions cv ON cs.checklist_version_id = cv.id
      JOIN public.checklists c ON cv.checklist_id = c.id
      WHERE c.org_id = public.get_user_org_id()
    )
  );

CREATE POLICY "Super admins can manage all checklist items"
  ON public.checklist_items FOR ALL
  USING (public.is_super_admin());

-- ==========================================
-- 9. SUBMISSIONS TABLE POLICIES
-- ==========================================

-- Users can view their own submissions (implicitly org-scoped)
CREATE POLICY "Users can view own submissions"
  ON public.submissions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create submissions in their org
CREATE POLICY "Users can create own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = public.get_user_org_id()
  );

-- Users can update their own draft submissions
CREATE POLICY "Users can update own drafts"
  ON public.submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

-- Admins can view all submissions in their org
CREATE POLICY "Admins can view org submissions"
  ON public.submissions FOR SELECT
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Admins can update any submission in their org
CREATE POLICY "Admins can update org submissions"
  ON public.submissions FOR UPDATE
  USING (
    public.is_admin()
    AND org_id = public.get_user_org_id()
  );

-- Super admins can manage all submissions
CREATE POLICY "Super admins can manage all submissions"
  ON public.submissions FOR ALL
  USING (public.is_super_admin());

-- ==========================================
-- 10. SUBMISSION PHOTOS TABLE POLICIES
-- ==========================================
-- Filter via parent submission's org_id.

CREATE POLICY "Users can view own submission photos"
  ON public.submission_photos FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own submission photos"
  ON public.submission_photos FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view org submission photos"
  ON public.submission_photos FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions
      WHERE org_id = public.get_user_org_id()
    )
    AND public.is_admin()
  );

CREATE POLICY "Super admins can view all submission photos"
  ON public.submission_photos FOR SELECT
  USING (public.is_super_admin());

-- ==========================================
-- 11. CHECKLIST RESPONSES TABLE POLICIES
-- ==========================================

CREATE POLICY "Users can view own checklist responses"
  ON public.checklist_responses FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own checklist responses"
  ON public.checklist_responses FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own draft responses"
  ON public.checklist_responses FOR UPDATE
  USING (
    submission_id IN (
      SELECT id FROM public.submissions
      WHERE user_id = auth.uid() AND status = 'draft'
    )
  );

CREATE POLICY "Admins can view org checklist responses"
  ON public.checklist_responses FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions
      WHERE org_id = public.get_user_org_id()
    )
    AND public.is_admin()
  );

CREATE POLICY "Super admins can view all checklist responses"
  ON public.checklist_responses FOR SELECT
  USING (public.is_super_admin());

-- ==========================================
-- 12. DEFECTS TABLE POLICIES
-- ==========================================

CREATE POLICY "Users can view own defects"
  ON public.defects FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own defects"
  ON public.defects FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.submissions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view org defects"
  ON public.defects FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions
      WHERE org_id = public.get_user_org_id()
    )
    AND public.is_admin()
  );

CREATE POLICY "Super admins can view all defects"
  ON public.defects FOR SELECT
  USING (public.is_super_admin());

COMMIT;
