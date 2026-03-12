# Cheklistr — E2E Testing

**Directory:** `testing/`
**Framework:** Playwright (chromium + mobile-chrome)
**CI:** GitHub Actions — `.github/workflows/e2e-tests.yml`
**Target:** Staging (staging.cheklistr.com) or production (cheklistr.app) depending on branch

---

## Environment-Aware Testing

E2E tests run against **staging** when triggered from the `staging` branch, and against **production** when triggered from `main`. The CI workflow determines the target environment automatically:

- **Push to `staging`** → tests use `E2E_STAGING_BASE_URL` + `STAGING_SUPABASE_URL`/`STAGING_SUPABASE_ANON_KEY`
- **Push to `main`** → tests use `E2E_BASE_URL` (production)

The `supabase-api.ts` test helper reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from environment variables, falling back to production values if unset.

The CI workflow waits 60 seconds post-push for Vercel to complete deployment before running tests. Do not remove this wait.

---

## Test Suites

| Suite | File | Scope |
|-------|------|-------|
| Smoke | `e2e/smoke.spec.ts` | Login, home page, navigation |
| Checklist | `e2e/checklist.spec.ts` | Form steps, draft save/resume, submission |
| VRM | `e2e/vrm.spec.ts` | Vehicle registration lookup integration |
| PDF | `e2e/pdf.spec.ts` | Photo aspect ratio and rendering |
| Admin | `e2e/admin.spec.ts` | Dashboard, checklist management |
| API | `e2e/api.spec.ts` | Auth, data queries, RLS policy enforcement |
| Multi-Tenancy | `e2e/multi-tenancy.spec.ts` | Org branding, SignedImage, cross-org isolation |
| Super Admin | `e2e/super-admin.spec.ts` | Organisation CRUD, cross-org user management |

---

## CI Triggers

- **Push to `main`** → runs all 8 suites
- **PR to `main`** → runs on app source changes
- **Manual dispatch** → select specific suite + retry count

CI artefacts: HTML reports + failure screenshots, 14-day retention.

---

## Local Commands

```bash
cd testing
npx playwright test                              # All suites
npx playwright test e2e/smoke.spec.ts            # Specific suite
npx playwright test e2e/super-admin.spec.ts
npx playwright test --ui                         # Interactive UI mode
npx playwright test --headed                     # Visible browser
npx playwright show-report                       # Last HTML report
```

---

## Login Form (Three Fields — Post Multi-Tenancy)

The login page has THREE fields since the multi-tenancy migration:

| Field | Element ID | Notes |
|-------|-----------|-------|
| Organisation ID | `#org-slug` | e.g. `greythorn` — validates org exists before auth |
| User ID | `#login-id` | e.g. `X123456` |
| Password | `#password` | |
| Submit | `.btn-primary.btn-large` | Shows "Signing in..." when loading |

**Login error messages to assert:**
- Invalid org: `"Organisation not found. Check the Organisation ID and try again."`
- Bad credentials: `"Invalid User ID or password"`
- Inactive account: `"Your account has been deactivated. Contact an administrator."`
- Profile load failure: `"Unable to load your profile. Contact an administrator."`

**Post-login redirects:**
- `admin` / `super_admin` → `/admin`
- `site_manager` → `/`

> ⚠️ Old two-field login tests must be updated to fill three fields.

---

## Test Data

### Greythorn (Seed Org)
- **Slug:** `greythorn`
- **UUID:** `00000000-0000-0000-0000-000000000001`
- Synthetic email format: `{loginId}.greythorn@cheklistr.app`
- Super admin user: `M.PATEL` (greythorn org)

### Creating a Test User via RPC
```sql
SELECT admin_create_user(
  'testuser.greythorn@cheklistr.app',
  'TestPass123!',
  'Test User',
  'TESTUSER',
  'site_manager',
  'SITE01',
  '00000000-0000-0000-0000-000000000001'
);
```

### Second Org for Isolation Tests
Create a test org with slug `testorg` via the super admin panel or SQL. Use it to verify cross-org data isolation.

---

## Multi-Tenancy Suite — Scope & Scenarios

### Org Branding
- `AppLayout` header shows org logo (if `logo_url`) or org name fallback
- `AdminLayout` sidebar shows org logo or name + role badge ("Admin" / "Super Admin")
- CSS custom property `--org-primary` set from `organisation.primary_colour`
- For Greythorn (no logo, no primary_colour by default): header shows "Greythorn Contract Logistics"

### SignedImage Component
All vehicle/defect/checklist photos are served via `<SignedImage>` — not raw `<img>` tags. Tests checking photo display must:
- Allow for a loading state (`div.signed-image-loading`)
- Assert `<img>` src contains signed URL token params (e.g. `?token=...`)
- Not assert exact src values (signed URLs expire and rotate)

**SignedImage states:** `loading` → `div.signed-image-loading` | `error` → `div.signed-image-error` | `loaded` → `<img src="{signedUrl}">`

### Storage Paths
All org-scoped: `{orgId}/{submissionId}/{filename}`. Legacy Greythorn paths (pre-migration, no UUID prefix) remain accessible via backward-compat policy.

### Key Scenarios
1. Three-field login with valid org slug → successful login
2. Invalid org slug → `"Organisation not found..."` error
3. Header/sidebar shows correct org name for Greythorn
4. `<SignedImage>` renders photos (loading → loaded state)
5. Cross-org isolation: user from Org A cannot see Org B submissions, users, checklists
6. Session re-auth overlay uses stored org context (no org field shown)
7. Offline submission sync: verify `org_id` in synced row + org-prefixed storage paths
8. PDF export: header shows dynamic org name (not hardcoded "Greythorn")

---

## Super Admin Suite — Scope & Scenarios

### Route & Access
- **Route:** `/admin/organisations`
- **Guard:** `super_admin` only — regular `admin` redirected to `/`
- **Sidebar:** "Organisations" link visible to `super_admin` only

### AdminOrganisations Page

**Table columns:** Name · Slug · Users (count) · Colour (swatch + hex) · Status (Active/Inactive badge) · Actions (Edit / Deactivate/Activate)

**Create Organisation form elements:**

| Field | Element ID | Notes |
|-------|-----------|-------|
| Organisation Name | `#org-name` | required |
| Slug | `#org-slug` | required, min 2 chars, `[a-z0-9-]` only, auto-lowercased |
| Brand Colour | `#org-colour` | colour picker + text input, default `#2E4057` |
| Submit | "Create Organisation" button | shows "Creating..." when loading |

**Create validation errors:**
- Empty name: `"Organisation name is required"`
- Short/empty slug: `"Slug must be at least 2 characters (lowercase letters, numbers, hyphens)"`
- Duplicate slug (Postgres 23505): `"An organisation with this slug already exists"`

**Edit form elements:** `#edit-org-name` (pre-filled) · `#edit-org-colour` (pre-filled) · slug field **disabled** (immutable after creation)

**Toggle active/inactive:** "Deactivate" → `is_active = false`, row gets class `row-inactive`. "Activate" → `is_active = true`.

### AdminUsers Super Admin Enhancements

**Org filter bar** (super_admin only, above users table):
- Dropdown `#filter-org` listing all active orgs
- Defaults to super_admin's own org
- Changing dropdown reloads user list for selected org
- NOT shown for regular `admin` users

**Create user form — additional field for super_admin:**
- `#target-org` select at top of form — lists all active orgs
- Defaults to currently selected filter org
- Synthetic email uses target org's slug: `{loginId}.{targetOrgSlug}@cheklistr.app`
- NOT shown for regular `admin` users

**Role dropdown:**
- super_admin sees: Site Manager · Admin · **Super Admin**
- regular admin sees: Site Manager · Admin only

### Key Scenarios
1. Super admin accesses `/admin/organisations` → page loads with table
2. Regular admin navigates to `/admin/organisations` → redirected to `/`
3. "Organisations" sidebar link visible only for super_admin
4. Create org → appears in table
5. Duplicate slug → error message
6. Edit org → name/colour updated in table
7. Slug field disabled in edit form
8. Deactivate org → status changes to "Inactive", row gets `row-inactive`
9. Activate org → status changes to "Active"
10. User count column matches actual user count
11. Org filter visible for super_admin, absent for regular admin
12. Switching org filter shows different users
13. Target org selector in create form for super_admin, absent for admin
14. Create user in different org → appears in that org's list after filter switch
15. Super admin sees three role options; regular admin sees two

---

## Coverage Philosophy

- **No unit tests** — E2E only. New features must have Playwright coverage.
- **Two browsers:** chromium + mobile-chrome. Tests should pass both unless explicitly scoped.
- **RLS enforcement:** `api.spec.ts` must cover any new table. Cross-org access must be explicitly blocked and tested.
- **Multi-tenancy additions:** Any feature touching org context needs a cross-org isolation check in `multi-tenancy.spec.ts`.
- **Tests run against production** — be careful with tests that create/modify/delete real data. Use `testorg` for destructive test scenarios.
