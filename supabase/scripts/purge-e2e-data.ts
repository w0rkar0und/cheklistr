/**
 * Purge E2E test data via Supabase REST + Auth Admin APIs.
 *
 * Uses the service role key (bypasses RLS) to delete test data
 * while preserving Greythorn org and 3 core users.
 *
 * Usage:
 *   npx tsx supabase/scripts/purge-e2e-data.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import 'dotenv/config';

// Public Supabase URL — safe to hardcode (RLS + auth enforces security)
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://trlrwnoapvcpszjbntso.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const GREYTHORN_ID = '00000000-0000-0000-0000-000000000001';
const PRESERVED_LOGINS = ['M.PATEL', 'GREYADMIN01', 'TESTUSER01'];

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const countHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: 'count=exact',
};

async function restDelete(table: string, filter: string): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation,count=exact' },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DELETE ${table} failed (${res.status}): ${err}`);
  }
  // Count from content-range header
  const range = res.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  const body = await res.json();
  return Array.isArray(body) ? body.length : 0;
}

async function getCount(table: string, filter = ''): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=0${filter ? '&' + filter : ''}`;
  const res = await fetch(url, { method: 'HEAD', headers: countHeaders });
  const range = res.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return -1;
}

async function deleteOrphanedAuthUsers(preservedPublicIds: string[]): Promise<number> {
  // List all auth users via Admin API
  let deleted = 0;
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`  Failed to list auth users: ${res.status} ${err}`);
      break;
    }

    const data = await res.json();
    const users: { id: string }[] = data.users ?? data;
    if (!Array.isArray(users) || users.length === 0) break;

    for (const user of users) {
      if (!preservedPublicIds.includes(user.id)) {
        const delRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
          {
            method: 'DELETE',
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          }
        );
        if (delRes.ok) {
          deleted++;
        } else {
          console.error(`  Failed to delete auth user ${user.id}: ${delRes.status}`);
        }
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  return deleted;
}

async function main() {
  console.log('Purging E2E test data…\n');

  // 1. Delete all submissions (cascades to responses, photos, defects)
  const subCount = await restDelete('submissions', 'id=not.is.null');
  console.log(`Deleted ${subCount} submissions (+ cascaded responses, photos, defects)`);

  // 2. Delete all sessions
  const sessCount = await restDelete('sessions', 'id=not.is.null');
  console.log(`Deleted ${sessCount} sessions`);

  // 3. Get IDs of preserved users before deleting
  const preservedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?select=id&login_id=in.(${PRESERVED_LOGINS.join(',')})`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const preservedUsers: { id: string }[] = preservedRes.ok ? await preservedRes.json() : [];
  const preservedIds = preservedUsers.map((u) => u.id);
  console.log(`Preserving ${preservedIds.length} users: ${PRESERVED_LOGINS.join(', ')}`);

  // 4. Delete test users from public.users
  const userFilter = `login_id=not.in.(${PRESERVED_LOGINS.join(',')})`;
  const userCount = await restDelete('users', userFilter);
  console.log(`Deleted ${userCount} test users from public.users`);

  // 5. Delete orphaned auth.users
  const authCount = await deleteOrphanedAuthUsers(preservedIds);
  console.log(`Deleted ${authCount} orphaned auth.users entries`);

  // 6. Delete test organisations
  const orgCount = await restDelete('organisations', `id=neq.${GREYTHORN_ID}`);
  console.log(`Deleted ${orgCount} test organisations`);

  // Verify
  console.log('\n── Remaining counts ──');
  for (const table of ['organisations', 'users', 'sessions', 'submissions', 'checklist_responses', 'submission_photos', 'defects']) {
    const count = await getCount(table);
    console.log(`  ${table}: ${count}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
