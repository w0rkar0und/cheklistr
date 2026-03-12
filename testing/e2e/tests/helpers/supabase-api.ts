/**
 * Supabase API test helpers.
 *
 * Provides authenticated HTTP clients for hitting the Supabase REST API
 * directly — no browser needed. Used by API-level tests to verify RLS
 * policies, auth flows, and data integrity.
 */

// ─── Supabase project constants ─────────────────────────────────
// Read from environment to support staging/production switching.
// Falls back to production values for backward compatibility.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://trlrwnoapvcpszjbntso.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybHJ3bm9hcHZjcHN6amJudHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTE2NTQsImV4cCI6MjA4ODM2NzY1NH0.LImmqc2SS6Fz_Ftijfdn7DvJui96jGSoJ7XCvzK8OY4';

export { SUPABASE_URL, SUPABASE_ANON_KEY };

/** Default org slug used by all Greythorn test users. */
export const TEST_ORG_SLUG = process.env.TEST_ORG_SLUG ?? 'greythorn';

/**
 * Convert a user login ID + org slug to the synthetic email used by Supabase Auth.
 * Format: `{loginId}.{orgSlug}@cheklistr.app`
 */
export function toSyntheticEmail(loginId: string, orgSlug?: string): string {
  const slug = orgSlug ?? TEST_ORG_SLUG;
  return `${loginId.toLowerCase()}.${slug}@cheklistr.app`;
}

/**
 * Authenticate with Supabase and return an access token.
 */
export async function getAccessToken(
  loginId: string,
  password: string,
  orgSlug?: string
): Promise<string> {
  const email = toSyntheticEmail(loginId, orgSlug);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth failed for ${email} (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Look up an organisation by slug via the REST API (anon access — migration 015).
 */
export async function lookupOrganisation(
  slug: string
): Promise<{ status: number; data: unknown }> {
  const url = `${SUPABASE_URL}/rest/v1/organisations?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,name,slug,is_active`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Authenticated GET request to the Supabase REST API.
 */
export async function supabaseGet(
  path: string,
  accessToken: string,
  queryParams?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Authenticated POST request to the Supabase REST API.
 */
export async function supabasePost(
  path: string,
  accessToken: string,
  body: unknown,
  prefer = 'return=representation'
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Authenticated PATCH request to the Supabase REST API.
 */
export async function supabasePatch(
  path: string,
  accessToken: string,
  body: unknown,
  queryParams?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Authenticated DELETE request to the Supabase REST API.
 */
export async function supabaseDelete(
  path: string,
  accessToken: string,
  queryParams?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=representation',
    },
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/**
 * Unauthenticated GET — used to verify anon access is blocked.
 */
export async function supabaseAnonGet(
  path: string,
  queryParams?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
