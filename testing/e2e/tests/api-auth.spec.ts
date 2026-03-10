import { test, expect } from '@playwright/test';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TEST_ORG_SLUG,
  toSyntheticEmail,
  getAccessToken,
  lookupOrganisation,
} from './helpers/supabase-api';

// These tests run without a browser — pure API calls
test.use({ storageState: { cookies: [], origins: [] } });

const TEST_USER_ID = process.env.TEST_USER_ID!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

// ─── Authentication API ─────────────────────────────────────────
test.describe('Supabase Auth API', () => {
  test('synthetic email mapping includes org slug', () => {
    expect(toSyntheticEmail('X123456')).toBe(`x123456.${TEST_ORG_SLUG}@cheklistr.app`);
    expect(toSyntheticEmail('TestUser01')).toBe(`testuser01.${TEST_ORG_SLUG}@cheklistr.app`);
    expect(toSyntheticEmail('ADMIN')).toBe(`admin.${TEST_ORG_SLUG}@cheklistr.app`);
  });

  test('synthetic email accepts custom org slug', () => {
    expect(toSyntheticEmail('X123456', 'acme')).toBe('x123456.acme@cheklistr.app');
    expect(toSyntheticEmail('USER01', 'other-org')).toBe('user01.other-org@cheklistr.app');
  });

  test('valid credentials return an access token', async () => {
    const token = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(50);
  });

  test('invalid password returns 400', async () => {
    const email = toSyntheticEmail(TEST_USER_ID);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password: 'wrong-password-123' }),
    });

    expect(res.status).toBe(400);
  });

  test('non-existent user returns 400', async () => {
    const email = toSyntheticEmail('NONEXISTENT_USER_XYZ');

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password: 'any-password' }),
    });

    expect(res.status).toBe(400);
  });

  test('access token grants API access', async () => {
    const token = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);

    // Use token to read user's own profile
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,login_id,role`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('missing auth token blocks API access', async () => {
    // Anon key alone should return empty results (RLS blocks unauthenticated reads)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,login_id`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });

    // PostgREST returns 200 with empty array when RLS blocks all rows
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });
});

// ─── Organisation Lookup (Anon) ─────────────────────────────────
test.describe('Organisation Lookup API', () => {
  test('valid org slug returns organisation data', async () => {
    const { status, data } = await lookupOrganisation('greythorn');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(1);

    const org = (data as any[])[0];
    expect(org.slug).toBe('greythorn');
    expect(org.name).toBeTruthy();
    expect(org.is_active).toBe(true);
  });

  test('non-existent org slug returns empty array', async () => {
    const { status, data } = await lookupOrganisation('nonexistent-org-xyz-999');
    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  test('org lookup works without authentication (anon access)', async () => {
    // Verifies migration 015 — anon role can SELECT active organisations
    const { status } = await lookupOrganisation('greythorn');
    expect(status).toBe(200);
  });
});
