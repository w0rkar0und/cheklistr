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
- **E2E tests:** Run against live production URL via GitHub Actions (3-min Vercel deploy wait)

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

17 migrations (001–016, with 012 split into 012a/012b).
Greythorn seeded as first org: slug `greythorn`, UUID `00000000-0000-0000-0000-000000000001`.

Full schema detail: see `supabase/CLAUDE.md`.

---

## Coding Conventions

- TypeScript strict mode — no `any` types
- Server/Supabase access only through `lib/` modules — never directly in components
- Zustand stores in `stores/` — keep stores lean, logic in `lib/`
- CSS: extend `global.css` design tokens, never hardcode colours or spacing
- Commits: imperative mood, under 72 chars (e.g. `Add org-scoped signed URL regeneration`)
