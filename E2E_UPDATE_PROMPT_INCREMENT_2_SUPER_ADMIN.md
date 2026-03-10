# E2E Test Update Prompt — Increment 2: Super Admin Management UI

> **Context**: This increment adds the Organisations management page (super_admin only) and upgrades the Admin Users page with cross-org user creation for super_admin users. No database migrations required — all RLS policies from Increment 1 already support super_admin cross-org access.

---

## 1. New Route: /admin/organisations (Super Admin Only)

### Route Details
```
Path:     /admin/organisations
Guard:    ProtectedRoute(requiredRole="super_admin")
Component: AdminOrganisations
```

- Only `super_admin` users can access this route.
- Regular `admin` users navigating here are redirected to `/`.
- The "Organisations" link appears in the admin sidebar **only** for `super_admin` users.

### Sidebar Navigation (AdminLayout)
The sidebar nav now conditionally renders:
```
Dashboard          → /admin          (all admin/super_admin)
Submissions        → /admin/submissions    (all admin/super_admin)
Checklists         → /admin/checklists     (all admin/super_admin)
Users              → /admin/users          (all admin/super_admin)
Sessions           → /admin/sessions       (all admin/super_admin)
Organisations      → /admin/organisations  (super_admin ONLY)
```

---

## 2. AdminOrganisations Page

### Page Header
- Title: "Organisations"
- Button: "+ New Organisation" (toggles to "Cancel" when form is open)

### Organisations Table
| Column | Content |
|--------|---------|
| Name | Organisation name (font-weight: 500) |
| Slug | Monospace, the login slug |
| Users | Count of users belonging to that org |
| Colour | Colour swatch + hex code |
| Status | "Active" or "Inactive" badge |
| Actions | "Edit" and "Deactivate"/"Activate" buttons |

### Create Organisation Form
Shown when "+ New Organisation" is clicked.

| Field | Element | Details |
|-------|---------|---------|
| Organisation Name * | `id="org-name"` input text | required |
| Slug * | `id="org-slug"` input text | required, min 2 chars, auto-lowercased, only `[a-z0-9-]` |
| Brand Colour | `id="org-colour"` color picker + text input | default `#2E4057` |
| Submit | button "Create Organisation" | shows "Creating..." when loading |

Slug helper text: "Used for login — lowercase letters, numbers, and hyphens only"

#### Validation/Error Messages
- Empty name: `"Organisation name is required"`
- Short/empty slug: `"Slug must be at least 2 characters (lowercase letters, numbers, hyphens)"`
- Duplicate slug (Postgres 23505): `"An organisation with this slug already exists"`

### Edit Organisation Form
Shown when "Edit" is clicked on a table row. Replaces the create form if open.

| Field | Element | Details |
|-------|---------|---------|
| Organisation Name * | `id="edit-org-name"` input text | pre-filled, required |
| Slug | disabled input | shows current slug, cannot be changed |
| Brand Colour | `id="edit-org-colour"` color picker + text input | pre-filled |
| Buttons | "Save Changes" + "Cancel" | side by side |

Slug helper text: "Slug cannot be changed after creation (would break existing user logins)"

### Toggle Active/Inactive
- "Deactivate" button on active orgs → sets `is_active = false`
- "Activate" button on inactive orgs → sets `is_active = true`
- Inactive org rows get CSS class `row-inactive`

---

## 3. AdminUsers Page — Super Admin Enhancements

### Org Filter Bar (Super Admin Only)
When logged in as `super_admin`, a filter bar appears above the users table:

```
Organisation: [dropdown of all active orgs]    id="filter-org"
```

- Defaults to the super_admin's own organisation
- Changing the dropdown reloads the user list for that org
- Regular `admin` users do NOT see this bar (RLS already scopes to their org)

### Create User Form — Target Organisation (Super Admin Only)
When `super_admin` opens the create user form, an additional field appears at the top:

| Field | Element | Details |
|-------|---------|---------|
| Target Organisation * | `id="target-org"` select | required, lists all active orgs |

- Defaults to the currently selected filter org
- The synthetic email uses the target org's slug: `{loginId}.{targetOrgSlug}@cheklistr.app`
- Regular `admin` users do NOT see this field (users are created in their own org)

### Role Dropdown — Super Admin Option
When logged in as `super_admin`, the role dropdown now includes a third option:

```html
<option value="site_manager">Site Manager</option>
<option value="admin">Admin</option>
<option value="super_admin">Super Admin</option>   <!-- super_admin only -->
```

Regular `admin` users only see Site Manager and Admin options (enforced both in UI and by the `admin_create_user` RPC).

---

## 4. Files Changed

### Created
| File | Purpose |
|------|---------|
| `app/src/pages/admin/AdminOrganisations.tsx` | Organisation management page (CRUD) |

### Modified
| File | Key Changes |
|------|-------------|
| `app/src/router.tsx` | Added import + `/admin/organisations` route with `requiredRole="super_admin"` guard |
| `app/src/components/layout/AdminLayout.tsx` | Conditional "Organisations" nav link for `super_admin` |
| `app/src/pages/admin/AdminUsers.tsx` | Org filter bar, target org selector in create form, super_admin role option in dropdown |

### No Migrations Required
All RLS policies from Increment 1 already grant super_admin full access to `organisations` (SELECT, INSERT, UPDATE) and cross-org access to `users` (SELECT, INSERT, UPDATE).

---

## 5. Key Test Scenarios

### New Scenarios — AdminOrganisations
1. **Super admin can access /admin/organisations** — page loads, shows table
2. **Regular admin cannot access /admin/organisations** — redirected to `/`
3. **Admin sidebar shows "Organisations" link only for super_admin**
4. **Create organisation** — fill form, submit, verify new org appears in table
5. **Duplicate slug rejected** — create org with existing slug → error message
6. **Edit organisation** — change name/colour, save, verify updated in table
7. **Slug is immutable on edit** — slug field is disabled in edit form
8. **Deactivate organisation** — click deactivate, verify status changes to "Inactive"
9. **Activate organisation** — click activate on inactive org, verify status changes to "Active"
10. **User count shown** — verify count column matches actual user count for each org

### New Scenarios — AdminUsers (Super Admin Enhancements)
11. **Org filter visible for super_admin** — filter bar appears with org dropdown
12. **Org filter NOT visible for regular admin** — no filter bar shown
13. **Switching org filter reloads user list** — change dropdown, verify different users shown
14. **Target org selector in create form for super_admin** — field appears at top of form
15. **Target org selector NOT shown for regular admin** — field absent
16. **Create user in different org** — super_admin selects target org, creates user, verify user appears in that org's list
17. **Super admin role option in dropdown** — super_admin sees three role options
18. **Regular admin only sees two role options** — no super_admin option

### Test Data Notes
- Tests need a `super_admin` user (e.g. `M.PATEL` in greythorn org)
- Tests should create a second org (e.g. slug: `testorg`) and verify cross-org operations
- After creating a user in `testorg`, switching the org filter should show that user
