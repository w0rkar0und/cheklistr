# Cheklistr — Root Project Context

**Repo:** github.com/w0rkar0und/cheklistr (private)
**Branch:** `main`
**Last updated:** March 2026

---

## What is Cheklistr?

Cheklistr is a **multi-tenant, offline-first PWA** for vehicle inspection checklists. Site managers complete structured vehicle inspections on mobile devices — capturing photos, defect reports, and checklist responses. Organisation admins review submissions, manage users, and configure checklists via a web dashboard.

This is **not** a generic task manager. It is purpose-built for fleet inspection workflows.

---

## Tech Stack (Quick Reference)

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript (strict) | 19.2.0 / 5.9.3 |
| Routing | React Router | 7.13.1 |
| State | Zustand | 5.0.11 |
| Bundler | Vite | 7.3.1 |
| PWA | vite-plugin-pwa + Workbox | 1.2.0 / 7.4.0 |
| Backend | Supabase (PostgreSQL + Auth + Storage) | JS client 2.98.0 |
| Edge Functions | Deno (Supabase runtime) | — |
| Offline Storage | idb (IndexedDB wrapper) | 8.0.3 |
| Mobile/Native | Capacitor | 7.2.0 |
| Styling | Native CSS only — NO framework | — |
| E2E Testing | Playwright (chromium + mobile-chrome) | — |
| CI/CD | GitHub Actions (Node 20) | — |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) | — |

---

## Environments

- **Production:** cheklistr.app (Vercel) + Supabase project `trlrwnoapvcpszjbntso`
- **Staging:** NONE — flow is `local dev → push to main → Vercel auto-deploys → production`
- **E2E tests:** Run against live production URL via GitHub Actions (60s Vercel deploy wait)

---

## Active Workstreams

| Stream | Location | Status |
|--------|----------|--------|
| Core build | `app/src/` | Active — see `app/CLAUDE.md` |
| iOS / Capacitor | `app/ios/` | Active — see `app/ios/CLAUDE.md` |
| E2E Testing | `testing/` | Active — see `testing/CLAUDE.md` |
| Multi-tenancy / Supabase | `supabase/` | Active — see `supabase/CLAUDE.md` |

---

## Critical Architectural Patterns — Read Before Any Code Change

1. **Offline-first** — IndexedDB stores pending submissions and draft form state. Forms can be completed entirely offline. Never assume network availability in submission or checklist logic.

2. **Multi-tenancy via org_id + RLS** — `org_id` is threaded through `users`, `checklists`, `submissions`, `sessions`. All PostgreSQL RLS policies enforce isolation via `get_user_org_id()`. Every new table MUST include `org_id` and appropriate RLS.

3. **Raw fetch() over supabase.functions.invoke()** — Critical paths (submission sync, VRM lookup) use raw `fetch()` with manually extracted JWT. Do NOT switch these to `supabase.functions.invoke()` — it hangs during token refresh.

4. **Synthetic email auth** — Users log in with HR codes (e.g. `X123456`). These are converted to `{login_id}.{org_slug}@cheklistr.app` internally for Supabase Auth. Users never see or interact with these emails.

5. **Private storage + signed URLs + lazy regeneration** — All photo buckets are private. `<SignedImage>` auto-regenerates expired URLs on `onError`. Never use public buckets.

6. **App-level sessions** — 2-hour sessions in the `sessions` table, separate from Supabase auth tokens. Automatic supersession via DB trigger. Re-auth overlay on expiry.

7. **Draft resume from IndexedDB** — Drafts load directly from IndexedDB into forms, bypassing Zustand store to avoid race conditions with React StrictMode double-mounting. Do not change this pattern.

8. **No CSS framework** — Native CSS only. Design tokens in `global.css` (47KB). No Tailwind, no CSS-in-JS, no component library. All interactive elements minimum 44px touch target.

9. **E2E over unit tests** — 8 Playwright suites. No unit test framework. New features should be covered by E2E additions in `testing/e2e/`.

10. **Photo pipeline** — Capture → compress (1280px, 60% JPEG) → store as Blob in IndexedDB → upload to org-scoped storage path (`{org_id}/{submission_id}/{filename}`) → serve via signed URL.

---

## Key Commands

```bash
# Frontend dev server
cd app && npm run dev

# Frontend production build
cd app && npm run build

# Deploy edge function
supabase functions deploy vehicle-lookup --no-verify-jwt

# Run E2E tests locally
cd testing && npx playwright test

# Run specific E2E suite
cd testing && npx playwright test e2e/<suite-name>.spec.ts
```

---

## Environment Variables

| Variable | Location | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | `app/.env` (committed) | Safe to commit — public |
| `VITE_SUPABASE_ANON_KEY` | `app/.env` (committed) | Safe to commit — RLS enforced |
| `UKVD_API_KEY` | Supabase Secrets only | Never in code or .env |

---

## Database: Core Tables

`organisations` · `users` · `sessions` · `checklists` · `checklist_versions` · `checklist_sections` · `checklist_items` · `submissions` · `submission_answers` · `submission_photos` · `defects` · `defect_photos`

18 migrations (001–017, with 012 split into 012a/012b).
Greythorn seeded as first org: slug `greythorn`, UUID `00000000-0000-0000-0000-000000000001`.

Full schema detail: see `supabase/CLAUDE.md`.

---

## Handoff Notes — 11 March 2026

### What changed
- **New E2E admin test user:** `GREYADMIN01` (role `admin`, Greythorn org) created in Supabase Auth + `users` table. M.PATEL is now `super_admin` only.
- **GitHub secrets updated:** `E2E_ADMIN_USER_ID`/`PASSWORD` → `GREYADMIN01`. New `E2E_SUPER_ADMIN_USER_ID`/`PASSWORD` → `M.PATEL`. Local `testing/e2e/.env` updated to match.
- **Playwright config** (`playwright.config.ts`): `chromium` and `mobile-chrome` projects now depend on `admin-auth-setup` so `admin.json` auth state exists for multi-tenancy tests that use `test.use({ storageState: adminAuthFile })`.
- **AdminOrganisations.tsx**: Added `noValidate` to create and edit `<form>` elements so JS validation renders `.error-message` divs instead of browser-native tooltips.
- **multi-tenancy.spec.ts**: SignedImage detail test skips on mobile viewport (sidebar overlays table rows).
- **NewChecklistPage.tsx** (Phase 1 fix): Direct submit path now matches offline sync path — `org_id` in submission row, org-prefixed storage paths, storage paths stored instead of public URLs.
- **global.css** (Phase 2): All 27 `var(--color-primary)` refs replaced with `var(--org-primary, var(--color-primary))` — cascades from inline style set by AppLayout/AdminLayout.
- **AdminOrganisations.tsx** (Phase 2): Logo upload/remove in edit form, logo preview column in org table. Uploads to `org-assets/{org_id}/logo.{ext}`.
- **AdminChecklists.tsx** (Phase 3): Restructured to three-level view: checklist list → version management → version editor. Admins can create new checklists, activate/deactivate, delete inactive. No schema changes needed.
- **admin-checklists.spec.ts** (Phase 3): Rewritten E2E tests for new checklist list UI, create/delete flow, and navigation between list → versions → editor.
- **e2e-tests.yml**: Vercel deploy wait reduced from 180s to 60s.

### What's fixed
- Admin suite: 30/30 passing (was 0/30 — missing credentials)
- Multi-tenancy suite: 24/24 passing, 1 skipped (was 7/23 — missing admin auth state)
- Super-admin suite: 23/23 passing (was 0/23 — missing credentials). `noValidate` fix confirmed in CI after deploy.
- Direct (online) submission path: org_id, photo storage paths, and defect image URLs now org-scoped (was broken for any non-legacy org).
- Phase 2 complete: Dynamic org branding (CSS custom property cascade) and logo upload UI. All E2E suites green.
- Phase 3 complete: Checklist assignment UI — admins can list, create, activate, and delete checklists per org. Version management accessible from checklist list. E2E tests rewritten for new three-level flow (list → versions → editor).
- **Migration 017** (Phase 4): Added `org_id` to `defects` and `submission_photos` tables. Backfilled from parent `submissions`. RLS policies rewritten to use direct `org_id` checks for admin queries. All insert paths updated.

### Session 2 — 11 March 2026

**E2E workflow improvements:**
- Suite input changed from single-choice dropdown to free-text string supporting comma-separated names (e.g. `smoke,admin,api`). All 8 job `if` conditions use `contains()`.
- Added `retries` input (0/1/2) for `workflow_dispatch`.

**E2E data purge workflow** (`.github/workflows/purge-e2e-data.yml`):
- One-click manual workflow to clean up test-created data. Requires typing "purge" to confirm.
- Runs `supabase/scripts/purge-e2e-data.ts` (REST API + Auth Admin API — no psql, avoids IPv6 issue) then `purge-storage.ts`.
- Preserves: Greythorn org, M.PATEL (super_admin), GREYADMIN01 (admin), TESTUSER01 (site_manager).
- Safety check: aborts if any preserved users are not found before deleting.
- GitHub secrets required: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`.
- **Lesson learned:** psql cannot reach Supabase direct DB from GitHub Actions (IPv6 only). Always use REST/Auth Admin APIs instead.
- **Lesson learned:** Login IDs are stored uppercase in `public.users`. Purge script initially used wrong casing and deleted the m.patel super_admin — had to restore via Auth Admin API. Safety check now prevents this.

**Org logo display constraints:**
- Added `.header-logo` (max 2.5rem × 10rem) and `.sidebar-logo` (max 2rem × 8rem) CSS rules in `global.css`. Previously these classes had no styles, so large uploaded logos could overflow the layout.

**Storage purge script updated** (`supabase/scripts/purge-storage.ts`):
- Now also purges test org logos from `org-assets` bucket while preserving Greythorn's folder.

### What's next
- Multi-tenancy feature build is complete (Phases 1–4 done).
- E2E workflow and purge automation are in place.
- The `testing/e2e/.env` is gitignored — any new dev machine needs credentials populated manually or from GitHub secrets.
- Consider compressing logos on upload (like the photo pipeline does for vehicle photos) to reduce storage usage.

---

## Coding Conventions

- TypeScript strict mode — no `any` types
- Server/Supabase access only through `lib/` modules — never directly in components
- Zustand stores in `stores/` — keep stores lean, logic in `lib/`
- CSS: extend `global.css` design tokens, never hardcode colours or spacing
- Commits: imperative mood, under 72 chars (e.g. `Add org-scoped signed URL regeneration`)
