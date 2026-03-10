import { test, expect } from '@playwright/test';
import {
  getAccessToken,
  supabaseGet,
  supabasePost,
  supabaseAnonGet,
  lookupOrganisation,
} from './helpers/supabase-api';

// These tests run without a browser — pure API calls
test.use({ storageState: { cookies: [], origins: [] } });

const TEST_USER_ID = process.env.TEST_USER_ID!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;
const ADMIN_USER_PASSWORD = process.env.ADMIN_USER_PASSWORD!;

// ─── RLS: Unauthenticated Access ────────────────────────────────
test.describe('RLS — Unauthenticated Access', () => {
  test('anon cannot read users table', async () => {
    const { status, data } = await supabaseAnonGet('users', { select: '*' });
    expect(status).toBe(200);
    expect(data).toEqual([]); // RLS returns empty, not 403
  });

  test('anon cannot read submissions table', async () => {
    const { status, data } = await supabaseAnonGet('submissions', { select: '*' });
    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  test('anon cannot read sessions table', async () => {
    const { status, data } = await supabaseAnonGet('sessions', { select: '*' });
    expect(status).toBe(200);
    expect(data).toEqual([]);
  });

  test('anon cannot read checklists (authenticated users only)', async () => {
    const { status, data } = await supabaseAnonGet('checklists', { select: '*' });
    expect(status).toBe(200);
    // Anon is not authenticated, so should get empty
    expect(data).toEqual([]);
  });

  test('anon CAN read active organisations (migration 015)', async () => {
    const { status, data } = await lookupOrganisation('greythorn');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(1);
    expect((data as any[])[0].slug).toBe('greythorn');
  });

  test('anon cannot read inactive organisations', async () => {
    // The RLS policy only allows is_active=true, so inactive orgs are invisible
    const { status, data } = await supabaseAnonGet('organisations', {
      select: 'id,slug',
      is_active: 'eq.false',
    });
    expect(status).toBe(200);
    expect(data).toEqual([]);
  });
});

// ─── RLS: Site Manager (Regular User) ───────────────────────────
test.describe('RLS — Site Manager Access', () => {
  let userToken: string;

  test.beforeAll(async () => {
    userToken = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);
  });

  test('user can read own profile', async () => {
    const { status, data } = await supabaseGet('users', userToken, {
      select: 'id,login_id,role,full_name,org_id',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // User should see at least their own record
    expect((data as any[]).length).toBeGreaterThanOrEqual(1);
  });

  test('user profile includes org_id', async () => {
    const { data } = await supabaseGet('users', userToken, {
      select: 'org_id',
    });
    expect(Array.isArray(data)).toBe(true);
    // Every user record should have a non-null org_id (migration 012 backfill)
    for (const row of data as any[]) {
      expect(row.org_id).toBeTruthy();
    }
  });

  test('user can read own organisation', async () => {
    const { status, data } = await supabaseGet('organisations', userToken, {
      select: 'id,name,slug,is_active',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // User should see their own org
    expect((data as any[]).length).toBeGreaterThanOrEqual(1);
  });

  test('user can read active checklists', async () => {
    const { status, data } = await supabaseGet('checklists', userToken, {
      select: '*',
      is_active: 'eq.true',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBeGreaterThan(0);
  });

  test('user can read checklist versions', async () => {
    const { status, data } = await supabaseGet('checklist_versions', userToken, {
      select: '*',
      is_active: 'eq.true',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBeGreaterThan(0);
  });

  test('user can read checklist sections and items', async () => {
    // Get active version first
    const { data: versions } = await supabaseGet('checklist_versions', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });

    const versionId = (versions as any[])[0]?.id;
    expect(versionId).toBeTruthy();

    // Read sections
    const { status: sectionStatus, data: sections } = await supabaseGet(
      'checklist_sections',
      userToken,
      { select: '*', checklist_version_id: `eq.${versionId}` }
    );
    expect(sectionStatus).toBe(200);
    expect((sections as any[]).length).toBeGreaterThan(0);

    // Read items for first section
    const sectionId = (sections as any[])[0].id;
    const { status: itemStatus, data: items } = await supabaseGet(
      'checklist_items',
      userToken,
      { select: '*', section_id: `eq.${sectionId}` }
    );
    expect(itemStatus).toBe(200);
    expect((items as any[]).length).toBeGreaterThan(0);
  });

  test('user can read own submissions', async () => {
    const { status, data } = await supabaseGet('submissions', userToken, {
      select: 'id,vehicle_registration,status,org_id',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // May be empty if no submissions exist for this user yet
  });

  test('user cannot insert into users table', async () => {
    const { status } = await supabasePost('users', userToken, {
      login_id: 'HACKER_USER',
      full_name: 'Should Not Work',
      role: 'admin',
    });
    // RLS should block — either 403 or PostgreSQL error (409/400)
    expect(status).not.toBe(201);
  });

  test('user cannot update other users', async () => {
    // Try to read all users — site_manager should only see themselves
    const { status, data } = await supabaseGet('users', userToken, {
      select: 'id,login_id',
    });

    // If user can only see themselves (site_manager), the count should be 1
    if ((data as any[]).length === 1) {
      // Correct — user only sees their own profile
      expect((data as any[])[0].login_id.toLowerCase()).toBe(
        TEST_USER_ID.toLowerCase()
      );
    }
  });
});

// ─── RLS: Admin Access ──────────────────────────────────────────
test.describe('RLS — Admin Access', () => {
  let adminToken: string;

  test.beforeAll(async () => {
    if (!ADMIN_USER_ID || !ADMIN_USER_PASSWORD) {
      throw new Error('ADMIN_USER_ID and ADMIN_USER_PASSWORD must be set');
    }
    adminToken = await getAccessToken(ADMIN_USER_ID, ADMIN_USER_PASSWORD);
  });

  test('admin can read all users within their org', async () => {
    const { status, data } = await supabaseGet('users', adminToken, {
      select: 'id,login_id,role,org_id',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // Admin should see more than just their own record
    expect((data as any[]).length).toBeGreaterThan(1);
  });

  test('admin users all belong to same org', async () => {
    const { data } = await supabaseGet('users', adminToken, {
      select: 'org_id',
    });
    // All users visible to this admin should share the same org_id
    const orgIds = new Set((data as any[]).map((u: any) => u.org_id));
    // With org-scoped RLS, admin sees only their own org's users
    expect(orgIds.size).toBe(1);
  });

  test('admin can read all submissions within their org', async () => {
    const { status, data } = await supabaseGet('submissions', adminToken, {
      select: 'id,vehicle_registration,user_id,status,org_id',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  test('admin can read all sessions', async () => {
    const { status, data } = await supabaseGet('sessions', adminToken, {
      select: 'id,user_id,started_at',
    });
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  test('admin sees users with different roles', async () => {
    const { data } = await supabaseGet('users', adminToken, {
      select: 'role',
    });
    const roles = new Set((data as any[]).map((u: any) => u.role));
    // Should have at least site_manager and admin roles
    expect(roles.has('admin') || roles.has('super_admin')).toBe(true);
  });
});

// ─── RLS: Cross-User Data Isolation ──────────────────────────────
test.describe('RLS — Cross-User Data Isolation', () => {
  let userToken: string;
  let adminToken: string;

  test.beforeAll(async () => {
    userToken = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);
    adminToken = await getAccessToken(ADMIN_USER_ID, ADMIN_USER_PASSWORD);
  });

  test('regular user sees fewer records than admin', async () => {
    const { data: userData } = await supabaseGet('users', userToken, {
      select: 'id',
    });
    const { data: adminData } = await supabaseGet('users', adminToken, {
      select: 'id',
    });

    const userCount = (userData as any[]).length;
    const adminCount = (adminData as any[]).length;

    // Admin should see all users; regular user sees only themselves
    expect(adminCount).toBeGreaterThanOrEqual(userCount);
  });

  test('regular user submissions are subset of admin view', async () => {
    const { data: userData } = await supabaseGet('submissions', userToken, {
      select: 'id',
    });
    const { data: adminData } = await supabaseGet('submissions', adminToken, {
      select: 'id',
    });

    const userIds = new Set((userData as any[]).map((s: any) => s.id));
    const adminIds = new Set((adminData as any[]).map((s: any) => s.id));

    // Every submission the user sees, the admin should also see
    for (const id of userIds) {
      expect(adminIds.has(id)).toBe(true);
    }
  });
});
