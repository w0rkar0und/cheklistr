/**
 * Supabase API test helpers.
 *
 * Provides authenticated HTTP clients for hitting the Supabase REST API
 * directly — no browser needed. Used by API-level tests to verify RLS
 * policies, auth flows, and data integrity.
 */

// ─── Supabase project constants ─────────────────────────────────
const SUPABASE_URL = 'https://trlrwnoapvcpszjbntso.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybHJ3bm9hcHZjcHN6amJudHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTE2NTQsImV4cCI6MjA4ODM2NzY1NH0.LImmqc2SS6Fz_Ftijfdn7DvJui96jGSoJ7XCvzK8OY4';

export { SUPABASE_URL, SUPABASE_ANON_KEY };

/**
 * Convert a user login ID to the synthetic email used by Supabase Auth.
 */
export function toSyntheticEmail(loginId: string): string {
  return `${loginId.toLowerCase()}@cheklistr.app`;
}

/**
 * Authenticate with Supabase and return an access token.
 */
export async function getAccessToken(
  loginId: string,
  password: string
): Promise<string> {
  const email = toSyntheticEmail(loginId);

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
    throw new Error(`Auth failed for ${loginId} (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
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
