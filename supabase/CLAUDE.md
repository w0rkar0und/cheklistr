# Cheklistr — Supabase Backend & Multi-Tenancy

**Directory:** `supabase/`
**Backend:** Supabase Cloud — project ref `trlrwnoapvcpszjbntso`
**Status:** Multi-tenancy retrofitted and live on `main` (migrations 012a–016)

---

## Supabase Is the Sole Backend

There is no separate API server. Supabase handles:

| Concern | Feature |
|---------|---------|
| Authentication | Supabase Auth (password-based, JWT) |
| Database | PostgreSQL with RLS on ALL tables |
| Storage | Private buckets only |
| Edge Functions | Deno runtime (vehicle-lookup → UKVD API) |
| Realtime | Not used |

---

## Multi-Tenancy Architecture

Multi-tenancy was **retrofitted** onto a single-tenant build. The implementation:

- `organisations` table — one row per tenant
- `org_id` UUID foreign key on: `users`, `checklists`, `submissions`, `sessions`
- All RLS policies filter via `get_user_org_id()` helper function
- `super_admin` role bypasses org filtering entirely
- Org-scoped storage paths: `{org_id}/{submission_id}/{filename}`
- Login-scoped synthetic emails: `{login_id}.{org_slug}@cheklistr.app`

**Greythorn** is the seed tenant: slug `greythorn`, hardcoded UUID `00000000-0000-0000-0000-000000000001`.

---

## Migration History

| Migration | Description |
|-----------|-------------|
| 001 | Initial schema |
| 002 | Row level security |
| 003–011 | Feature additions (checklist versioning, sessions, photos, defects, etc.) |
| 012a | Add `organisations` table, add `org_id` to core tables |
| 012b | Migrate existing data to Greythorn org |
| 013 | Rewrite RLS policies for multi-tenancy |
| 014 | Org-scoped storage paths |
| 015 | Super admin role + `/admin/organisations` |
| 016 | Migrate auth.users synthetic emails |
| 017 | Add `org_id` to `defects` and `submission_photos`, rewrite RLS |

**Never edit existing migrations.** Always add a new numbered migration file.

---

## Database Schema

### organisations
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Tenant identifier |
| name | TEXT | Display name |
| slug | TEXT UNIQUE | URL-safe, used in login routing + storage paths |
| logo_url | TEXT nullable | Path in `org-assets` bucket |
| primary_colour | TEXT | Hex, default `#2E4057` |
| is_active | BOOLEAN | Soft disable |

### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References `auth.users` |
| org_id | UUID FK | → organisations.id |
| login_id | TEXT | HR code e.g. `X123456`. UNIQUE per (login_id, org_id) |
| contractor_id | VARCHAR | External HR reference |
| full_name | TEXT | |
| role | ENUM | `site_manager` · `admin` · `super_admin` |
| is_active | BOOLEAN | Soft disable |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | App-level session |
| user_id | UUID FK | → users.id |
| org_id | UUID FK | → organisations.id |
| started_at / expires_at | TIMESTAMPTZ | 2-hour window |
| terminated_at | TIMESTAMPTZ nullable | Null while active |
| termination_reason | ENUM | `expired` · `logout` · `superseded` |
| device_info | JSONB | userAgent, platform, screen, language |

DB trigger auto-supersedes previous active session on new login for same user.

### checklists / checklist_versions / checklist_sections / checklist_items
Versioned checklist templates. Only one active version per checklist per org.
`checklist_items.triggers_defect` — if true and answer is negative, flags a defect.

### submissions / submission_answers / submission_photos / defects / defect_photos
Core submission tables. All carry `org_id`. Photos stored in private buckets, referenced by path.

---

## Storage Buckets

| Bucket | Contents |
|--------|----------|
| `vehicle-photos` | 10 mandatory vehicle angle photos |
| `checklist-photos` | Image-type checklist item responses |
| `defect-photos` | Up to 4 defect photos per submission |
| `org-assets` | Org logos |

All buckets are **private**. Access is via signed URLs (15-min expiry). `<SignedImage>` in the frontend handles lazy regeneration on expiry.

Storage paths are always `{org_id}/{submission_id}/{filename}`.

---

## RLS Policy Rules

- Every table MUST have RLS enabled
- Standard user policies filter via `get_user_org_id()` — returns the org_id for the authenticated user
- `super_admin` policies use a separate check that bypasses org filtering
- When adding a new table: add `org_id UUID REFERENCES organisations(id)`, enable RLS, write both user-scoped and super_admin policies

---

## Edge Functions

### vehicle-lookup
- **Runtime:** Deno
- **Purpose:** Proxy to UKVD API (UK Vehicle Data) for VRM lookup
- **Auth:** `--no-verify-jwt` flag (JWT verification handled in function)
- **Deploy:** `supabase functions deploy vehicle-lookup --no-verify-jwt`
- **Client:** Called via raw `fetch()` with Bearer token in `lib/vehicleLookup.ts` — NOT `supabase.functions.invoke()`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/purge-all-submissions.sql` | Dev/test cleanup — removes all submissions |
| `scripts/purge-storage.ts` | Dev/test cleanup — removes storage files |

**Never run purge scripts against production.**

---

## Adding a New Tenant

Via the super admin panel at `/admin/organisations`:
1. Create org (name, slug, primary colour, logo)
2. Seed initial admin user with role `admin`
3. Assign org's active checklist template

Or directly via SQL migration for bootstrapping.

---

## Environment

| Variable | Location |
|----------|----------|
| `VITE_SUPABASE_URL` | `app/.env` |
| `VITE_SUPABASE_ANON_KEY` | `app/.env` |
| `UKVD_API_KEY` | Supabase Secrets — never in code |
