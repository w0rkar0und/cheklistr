# Cheklistr — Core Frontend Build

**Directory:** `app/`
**Stack:** React 19 + TypeScript (strict) + Vite + Zustand + Supabase JS client
**Deployment:** Vercel (auto on push to `main`)

---

## Current State

This is the primary deployment target. The PWA runs on cheklistr.app and is the fully active production app. The Capacitor iOS build is a parallel workstream (see `ios/CLAUDE.md`).

Multi-tenancy was retrofitted via migrations 012a–016. All core tables now carry `org_id`. RLS policies rewritten to use `get_user_org_id()`.

---

## Directory Map

```
app/src/
├── main.tsx              # Entry point, SW registration
├── App.tsx               # Root component, auth init, router
├── router.tsx            # Route definitions
├── global.css            # Design system (47KB) — all tokens here
├── components/
│   ├── common/           # ProtectedRoute, SignedImage, SessionExpiryOverlay,
│   │                       PwaInstallBanner, OfflineIndicator
│   ├── layout/           # AppLayout, AdminLayout
│   └── checklist/        # Multi-step form components + field types
├── pages/
│   ├── auth/             # LoginPage
│   ├── checklist/        # HomePage, NewChecklistPage, PendingSubmissionsPage
│   └── admin/            # AdminDashboard, Submissions, Checklists, Users,
│                           Sessions, Organisations (super_admin only)
├── hooks/                # useAuth, useOnlineStatus, usePwaInstall
├── stores/               # authStore, checklistStore (Zustand)
├── lib/                  # All Supabase/business logic — never import directly in components
│   ├── auth.ts
│   ├── supabase.ts
│   ├── checklist.ts
│   ├── syncSubmission.ts     # RAW FETCH — do not change to supabase.functions.invoke()
│   ├── vehicleLookup.ts      # RAW FETCH — do not change to supabase.functions.invoke()
│   ├── offlineDb.ts          # IndexedDB via idb
│   ├── generateSubmissionPdf.ts
│   ├── imageCompressor.ts    # 1280px, 60% JPEG
│   ├── nativeCamera.ts       # Capacitor camera
│   ├── nativeGeolocation.ts  # Capacitor GPS
│   ├── biometricAuth.ts      # @aparajita/capacitor-biometric-auth
│   └── secureStorage.ts      # Capacitor Preferences
└── types/
    └── database.ts           # Full TypeScript DB types — keep in sync with schema
```

---

## Key Patterns

### Auth Flow
1. User enters `login_id` (e.g. `X123456`) + password + org slug
2. `lib/auth.ts` converts to synthetic email: `{login_id}.{org_slug}@cheklistr.app`
3. Supabase Auth signs in with synthetic email
4. App-level session created in `sessions` table (2-hour window)
5. DB trigger supersedes any existing active session for same user

### Offline Submission Flow
1. Form state saved to IndexedDB (via `offlineDb.ts`) at each step
2. On submit: if online → `syncSubmission.ts` uploads immediately; if offline → queued in IndexedDB
3. `PendingSubmissionsPage` shows queue and retries on reconnect
4. Draft resume: loads directly from IndexedDB → bypasses Zustand to avoid StrictMode double-mount race

### Photo Pipeline
```
Native camera / file input
  → imageCompressor.ts (1280px, 60% JPEG)
  → Blob stored in IndexedDB
  → On sync: upload to {org_id}/{submission_id}/{filename}
  → Served via signed URL (15-min expiry)
  → <SignedImage> auto-regenerates on onError
```

### SignedImage Component
Always use `<SignedImage>` for storage photos — never raw `<img src={url}>`. It handles signed URL expiry automatically.

---

## Commands

```bash
cd app
npm run dev        # Dev server on http://localhost:5173
npm run build      # Production build → dist/
npm run lint       # ESLint check
```

---

## Known Gotchas

- **React StrictMode double-mount:** Draft loading bypasses Zustand deliberately. Do not "fix" this by routing drafts through the store.
- **supabase.functions.invoke() hangs:** syncSubmission and vehicleLookup use raw `fetch()` with extracted JWT. Do not refactor.
- **CSS:** Extend tokens in `global.css`. Never hardcode `#1B3A5C` etc. — use `var(--color-primary)`.
- **TypeScript strict:** No `any`. If a type is unknown, extend `database.ts`.
- **Org-scoped storage paths:** Always `{org_id}/{submission_id}/{filename}` — never flat paths.

---

## Roles & Route Access

| Role | Access |
|------|--------|
| `site_manager` | Login, checklist form, pending submissions, home |
| `admin` | All above + admin dashboard, submissions, users, checklists, sessions |
| `super_admin` | All above + `/admin/organisations` (org CRUD, cross-org user management) |

`ProtectedRoute` enforces role checks. `super_admin` bypasses org-level RLS in Supabase.
