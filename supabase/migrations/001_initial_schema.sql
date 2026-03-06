-- ============================================================
-- Cheklistr: Initial Schema Migration
-- CHKL-SPEC-001 v0.2
-- Run this in the Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- ==========================================
-- 1. CUSTOM TYPES (ENUMS)
-- ==========================================

CREATE TYPE user_role AS ENUM ('site_manager', 'admin');
CREATE TYPE session_termination_reason AS ENUM ('expired', 'logout', 'superseded');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'synced');
CREATE TYPE field_type AS ENUM ('boolean', 'text', 'number', 'image', 'select');
CREATE TYPE photo_type AS ENUM (
  'front', 'left', 'right', 'rear',
  'tyre_fl', 'tyre_rl', 'tyre_fr', 'tyre_rr',
  'mirror_left', 'mirror_right'
);

-- ==========================================
-- 2. USERS TABLE (extends Supabase Auth)
-- ==========================================

CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_id VARCHAR(7),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'site_manager',
  site_code     VARCHAR(10),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_contractor_id ON public.users(contractor_id);
CREATE INDEX idx_users_site_code ON public.users(site_code);
CREATE INDEX idx_users_role ON public.users(role);

COMMENT ON TABLE public.users IS 'Application user profiles extending Supabase auth.users';
COMMENT ON COLUMN public.users.contractor_id IS 'Greythorn HR code (format X######)';

-- ==========================================
-- 3. SESSIONS TABLE
-- ==========================================

CREATE TABLE public.sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  selfie_url           TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  terminated_at        TIMESTAMPTZ,
  termination_reason   session_termination_reason,
  device_info          JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_active ON public.sessions(user_id, terminated_at) WHERE terminated_at IS NULL;

COMMENT ON TABLE public.sessions IS 'Authentication sessions with selfie capture and 2-hour expiry';

-- ==========================================
-- 4. CHECKLISTS TABLE
-- ==========================================

CREATE TABLE public.checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checklists IS 'Top-level checklist definitions';

-- ==========================================
-- 5. CHECKLIST VERSIONS TABLE
-- ==========================================

CREATE TABLE public.checklist_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(checklist_id, version_number)
);

CREATE INDEX idx_checklist_versions_checklist ON public.checklist_versions(checklist_id);
CREATE INDEX idx_checklist_versions_active ON public.checklist_versions(checklist_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.checklist_versions IS 'Versioned snapshots of checklist configurations';

-- ==========================================
-- 6. CHECKLIST SECTIONS TABLE
-- ==========================================

CREATE TABLE public.checklist_sections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_version_id  UUID NOT NULL REFERENCES public.checklist_versions(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  display_order         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_sections_version ON public.checklist_sections(checklist_version_id);

COMMENT ON TABLE public.checklist_sections IS 'Ordered groups of checklist items within a version';

-- ==========================================
-- 7. CHECKLIST ITEMS TABLE
-- ==========================================

CREATE TABLE public.checklist_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id       UUID NOT NULL REFERENCES public.checklist_sections(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  field_type       field_type NOT NULL DEFAULT 'boolean',
  display_order    INTEGER NOT NULL DEFAULT 0,
  is_required      BOOLEAN NOT NULL DEFAULT true,
  config           JSONB DEFAULT '{}',
  triggers_defect  BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_section ON public.checklist_items(section_id);

COMMENT ON TABLE public.checklist_items IS 'Individual inspection items with configurable field types';
COMMENT ON COLUMN public.checklist_items.config IS 'Type-specific config: boolean {fail_value}, text {placeholder, multiline, max_length}, number {min, max, step, unit}, image {max_count, guidance}, select {options, allow_other}';

-- ==========================================
-- 8. SUBMISSIONS TABLE
-- ==========================================

CREATE TABLE public.submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id),
  session_id            UUID REFERENCES public.sessions(id),
  checklist_version_id  UUID NOT NULL REFERENCES public.checklist_versions(id),
  status                submission_status NOT NULL DEFAULT 'draft',
  contractor_id         VARCHAR(7),
  contractor_name       TEXT,
  vehicle_registration  VARCHAR(15) NOT NULL,
  mileage               INTEGER,
  make_model            TEXT,
  colour                VARCHAR(30),
  site_code             VARCHAR(10),
  defect_summary        TEXT,
  ts_form_started       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ts_form_reviewed      TIMESTAMPTZ,
  ts_form_submitted     TIMESTAMPTZ,
  ts_synced             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_user ON public.submissions(user_id);
CREATE INDEX idx_submissions_vehicle ON public.submissions(vehicle_registration);
CREATE INDEX idx_submissions_site ON public.submissions(site_code);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_submitted ON public.submissions(ts_form_submitted DESC);
CREATE INDEX idx_submissions_checklist_version ON public.submissions(checklist_version_id);

-- Compliance query index: find latest submission per vehicle
CREATE INDEX idx_submissions_vehicle_date ON public.submissions(vehicle_registration, ts_form_submitted DESC)
  WHERE status IN ('submitted', 'synced');

COMMENT ON TABLE public.submissions IS 'Vehicle inspection checklist submissions';

-- ==========================================
-- 9. SUBMISSION PHOTOS TABLE
-- ==========================================

CREATE TABLE public.submission_photos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  photo_type     photo_type NOT NULL,
  storage_url    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, photo_type)
);

CREATE INDEX idx_submission_photos_submission ON public.submission_photos(submission_id);

COMMENT ON TABLE public.submission_photos IS 'Mandatory vehicle photographs (10 per submission)';

-- ==========================================
-- 10. CHECKLIST RESPONSES TABLE
-- ==========================================

CREATE TABLE public.checklist_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id      UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  checklist_item_id  UUID NOT NULL REFERENCES public.checklist_items(id),
  value_boolean      BOOLEAN,
  value_text         TEXT,
  value_number       DECIMAL,
  value_image_url    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, checklist_item_id)
);

CREATE INDEX idx_checklist_responses_submission ON public.checklist_responses(submission_id);

COMMENT ON TABLE public.checklist_responses IS 'Responses to individual checklist items within a submission';

-- ==========================================
-- 11. DEFECTS TABLE
-- ==========================================

CREATE TABLE public.defects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  defect_number  INTEGER NOT NULL CHECK (defect_number BETWEEN 1 AND 4),
  image_url      TEXT,
  details        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, defect_number)
);

CREATE INDEX idx_defects_submission ON public.defects(submission_id);

COMMENT ON TABLE public.defects IS 'Defect reports with optional photographs (up to 4 per submission)';

-- ==========================================
-- 12. UPDATED_AT TRIGGER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- 13. SESSION MANAGEMENT FUNCTION
-- Terminates existing active sessions when
-- a user starts a new session (single active
-- session enforcement)
-- ==========================================

CREATE OR REPLACE FUNCTION public.terminate_existing_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.sessions
  SET terminated_at = now(),
      termination_reason = 'superseded'
  WHERE user_id = NEW.user_id
    AND terminated_at IS NULL
    AND id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_session
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.terminate_existing_sessions();
