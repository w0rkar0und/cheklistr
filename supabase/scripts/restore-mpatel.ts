/**
 * One-off script to restore the m.patel super_admin user.
 * Run: npx tsx supabase/scripts/restore-mpatel.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY env var.
 */

import 'dotenv/config';

const SUPABASE_URL = 'https://trlrwnoapvcpszjbntso.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

const GREYTHORN_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const headers = {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1. Create auth user via Admin API
  console.log('Creating auth user m.patel.greythorn@cheklistr.app…');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: 'm.patel.greythorn@cheklistr.app',
      password: 'Goodbye36',
      email_confirm: true,
    }),
  });

  if (!authRes.ok) {
    const err = await authRes.text();
    console.error(`Auth user creation failed (${authRes.status}): ${err}`);
    process.exit(1);
  }

  const authUser = await authRes.json();
  const userId = authUser.id;
  console.log(`Auth user created with ID: ${userId}`);

  // 2. Insert public.users row
  console.log('Inserting public.users row…');
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      id: userId,
      org_id: GREYTHORN_ID,
      login_id: 'M.PATEL',
      full_name: 'M. Patel',
      role: 'super_admin',
      is_active: true,
    }),
  });

  if (!userRes.ok) {
    const err = await userRes.text();
    console.error(`User insert failed (${userRes.status}): ${err}`);
    process.exit(1);
  }

  console.log('Done. m.patel user restored as super_admin in Greythorn org.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
