// ============================================================
// Cheklistr: Database Types
// Mirrors the Supabase PostgreSQL schema
// ============================================================

// ==========================================
// ENUMS
// ==========================================

export type UserRole = 'site_manager' | 'admin';
export type SessionTerminationReason = 'expired' | 'logout' | 'superseded';
export type SubmissionStatus = 'draft' | 'submitted' | 'synced';
export type FieldType = 'boolean' | 'text' | 'number' | 'image' | 'select';
export type PhotoType =
  | 'front' | 'left' | 'right' | 'rear'
  | 'tyre_fl' | 'tyre_rl' | 'tyre_fr' | 'tyre_rr'
  | 'mirror_left' | 'mirror_right';

// ==========================================
// TABLE TYPES
// ==========================================

export interface User {
  id: string;
  login_id: string;
  contractor_id: string | null;
  full_name: string;
  email: string | null;
  role: UserRole;
  site_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  selfie_url: string | null;
  started_at: string;
  expires_at: string;
  terminated_at: string | null;
  termination_reason: SessionTerminationReason | null;
  device_info: Record<string, unknown> | null;
  created_at: string;
}

export interface Checklist {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistVersion {
  id: string;
  checklist_id: string;
  version_number: number;
  is_active: boolean;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface ChecklistSection {
  id: string;
  checklist_version_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  section_id: string;
  label: string;
  field_type: FieldType;
  display_order: number;
  is_required: boolean;
  config: ItemConfig;
  triggers_defect: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  session_id: string | null;
  checklist_version_id: string;
  status: SubmissionStatus;
  contractor_id: string | null;
  contractor_name: string | null;
  vehicle_registration: string;
  mileage: number | null;
  make_model: string | null;
  colour: string | null;
  site_code: string | null;
  defect_summary: string | null;
  ts_form_started: string;
  ts_form_reviewed: string | null;
  ts_form_submitted: string | null;
  ts_synced: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionPhoto {
  id: string;
  submission_id: string;
  photo_type: PhotoType;
  storage_url: string;
  created_at: string;
}

export interface ChecklistResponse {
  id: string;
  submission_id: string;
  checklist_item_id: string;
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  value_image_url: string | null;
  created_at: string;
}

export interface Defect {
  id: string;
  submission_id: string;
  defect_number: number;
  image_url: string | null;
  details: string | null;
  created_at: string;
}

// ==========================================
// ITEM CONFIG TYPES (JSONB)
// ==========================================

export interface BooleanConfig {
  default?: boolean | null;
  fail_value?: boolean;
}

export interface TextConfig {
  placeholder?: string;
  multiline?: boolean;
  max_length?: number;
}

export interface NumberConfig {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

export interface ImageConfig {
  max_count?: number;
  required_count?: number;
  guidance?: string;
}

export interface SelectConfig {
  options?: string[];
  allow_other?: boolean;
}

export type ItemConfig =
  | BooleanConfig
  | TextConfig
  | NumberConfig
  | ImageConfig
  | SelectConfig
  | Record<string, unknown>;

// ==========================================
// COMPOSITE TYPES (for fetching full checklist)
// ==========================================

export interface ChecklistItemWithSection extends ChecklistItem {
  section: ChecklistSection;
}

export interface FullChecklistVersion extends ChecklistVersion {
  sections: (ChecklistSection & {
    items: ChecklistItem[];
  })[];
}

export interface FullSubmission extends Submission {
  photos: SubmissionPhoto[];
  responses: ChecklistResponse[];
  defects: Defect[];
}
