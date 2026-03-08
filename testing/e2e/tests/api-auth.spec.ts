import { test, expect } from '@playwright/test';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  toSyntheticEmail,
  getAccessToken,
} from './helpers/supabase-api';

// These tests run without a browser — pure API calls
test.use({ storageState: { cookies: [], origins: [] } });

const TEST_USER_ID = process.env.TEST_USER_ID!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

// ─── Authentication API ─────────────────────────────────────────
test.describe('Supabase Auth API', () => {
  test('synthetic email mapping is correct', () => {
    expect(toSyntheticEmail('X123456')).toBe('x123456@cheklistr.app');
    expect(toSyntheticEmail('TestUser01')).toBe('testuser01@cheklistr.app');
    expect(toSyntheticEmail('ADMIN')).toBe('admin@cheklistr.app');
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
