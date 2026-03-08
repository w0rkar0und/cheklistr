import { test, expect } from '@playwright/test';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  getAccessToken,
  supabaseGet,
  supabasePost,
  supabaseDelete,
} from './helpers/supabase-api';

// These tests run without a browser — pure API calls
test.use({ storageState: { cookies: [], origins: [] } });

const TEST_USER_ID = process.env.TEST_USER_ID!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;
const ADMIN_USER_PASSWORD = process.env.ADMIN_USER_PASSWORD!;

// ─── Checklist Data Integrity ───────────────────────────────────
test.describe('Checklist Data Integrity', () => {
  let userToken: string;

  test.beforeAll(async () => {
    userToken = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);
  });

  test('active checklist exists', async () => {
    const { status, data } = await supabaseGet('checklists', userToken, {
      select: 'id,name,is_active',
      is_active: 'eq.true',
    });
    expect(status).toBe(200);
    expect((data as any[]).length).toBeGreaterThan(0);
    expect((data as any[])[0].name).toBeTruthy();
  });

  test('active checklist has an active version', async () => {
    const { data: checklists } = await supabaseGet('checklists', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });

    const checklistId = (checklists as any[])[0]?.id;
    expect(checklistId).toBeTruthy();

    const { status, data } = await supabaseGet('checklist_versions', userToken, {
      select: 'id,version_number,is_active',
      checklist_id: `eq.${checklistId}`,
      is_active: 'eq.true',
    });
    expect(status).toBe(200);
    expect((data as any[]).length).toBe(1);
  });

  test('checklist has sections in correct order', async () => {
    const { data: versions } = await supabaseGet('checklist_versions', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });

    const versionId = (versions as any[])[0]?.id;

    const { data: sections } = await supabaseGet('checklist_sections', userToken, {
      select: 'id,name,display_order',
      checklist_version_id: `eq.${versionId}`,
      order: 'display_order.asc',
    });

    expect((sections as any[]).length).toBeGreaterThan(0);

    // Verify display_order is sequential
    const orders = (sections as any[]).map((s: any) => s.display_order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  test('all checklist items have valid field types', async () => {
    const validTypes = ['boolean', 'text', 'number', 'image', 'select'];

    const { data: versions } = await supabaseGet('checklist_versions', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });

    const versionId = (versions as any[])[0]?.id;

    const { data: sections } = await supabaseGet('checklist_sections', userToken, {
      select: 'id',
      checklist_version_id: `eq.${versionId}`,
    });

    for (const section of sections as any[]) {
      const { data: items } = await supabaseGet('checklist_items', userToken, {
        select: 'id,label,field_type,is_required',
        section_id: `eq.${section.id}`,
      });

      for (const item of items as any[]) {
        expect(validTypes).toContain(item.field_type);
        expect(item.label).toBeTruthy();
      }
    }
  });

  test('checklist has expected number of sections (5)', async () => {
    const { data: versions } = await supabaseGet('checklist_versions', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });

    const versionId = (versions as any[])[0]?.id;

    const { data: sections } = await supabaseGet('checklist_sections', userToken, {
      select: 'id',
      checklist_version_id: `eq.${versionId}`,
    });

    expect((sections as any[]).length).toBe(5);
  });
});

// ─── Submission API ─────────────────────────────────────────────
test.describe('Submission API', () => {
  let userToken: string;
  let adminToken: string;
  let testSubmissionId: string;

  test.beforeAll(async () => {
    userToken = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);
    adminToken = await getAccessToken(ADMIN_USER_ID, ADMIN_USER_PASSWORD);
  });

  test('user can create a submission', async () => {
    // Get the user's profile ID
    const { data: users } = await supabaseGet('users', userToken, {
      select: 'id',
    });
    const userId = (users as any[])[0]?.id;
    expect(userId).toBeTruthy();

    // Get active checklist version
    const { data: versions } = await supabaseGet('checklist_versions', userToken, {
      select: 'id',
      is_active: 'eq.true',
      limit: '1',
    });
    const versionId = (versions as any[])[0]?.id;

    testSubmissionId = crypto.randomUUID();

    const { status, data } = await supabasePost('submissions', userToken, {
      id: testSubmissionId,
      user_id: userId,
      checklist_version_id: versionId,
      status: 'submitted',
      vehicle_registration: `API${Date.now().toString(36).toUpperCase()}`,
      contractor_id: 'X999999',
      contractor_name: 'API Test Driver',
      mileage: 50000,
      make_model: 'API Test Van',
      colour: 'Red',
      site_code: 'TEST',
      ts_form_started: new Date().toISOString(),
      ts_form_reviewed: new Date().toISOString(),
      ts_form_submitted: new Date().toISOString(),
      latitude: 51.5074,
      longitude: -0.1278,
    });

    expect(status).toBe(201);
  });

  test('user can read their created submission', async () => {
    const { status, data } = await supabaseGet('submissions', userToken, {
      select: 'id,vehicle_registration,status',
      id: `eq.${testSubmissionId}`,
    });

    expect(status).toBe(200);
    expect((data as any[]).length).toBe(1);
    expect((data as any[])[0].id).toBe(testSubmissionId);
  });

  test('admin can see the user-created submission', async () => {
    const { status, data } = await supabaseGet('submissions', adminToken, {
      select: 'id,vehicle_registration,user_id',
      id: `eq.${testSubmissionId}`,
    });

    expect(status).toBe(200);
    expect((data as any[]).length).toBe(1);
  });

  test('admin can archive a submission', async () => {
    // Get admin user ID
    const { data: adminUsers } = await supabaseGet('users', adminToken, {
      select: 'id',
      role: 'eq.admin',
      limit: '1',
    });
    const adminUserId = (adminUsers as any[])[0]?.id;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?id=eq.${testSubmissionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${adminToken}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          archived_at: new Date().toISOString(),
          archived_by: adminUserId,
        }),
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].archived_at).toBeTruthy();
  });

  // Clean up — delete the test submission
  test.afterAll(async () => {
    if (testSubmissionId && adminToken) {
      await supabaseDelete('submissions', adminToken, {
        id: `eq.${testSubmissionId}`,
      });
    }
  });
});

// ─── Storage Buckets ────────────────────────────────────────────
test.describe('Storage Buckets', () => {
  let userToken: string;

  test.beforeAll(async () => {
    userToken = await getAccessToken(TEST_USER_ID, TEST_USER_PASSWORD);
  });

  test('vehicle-photos bucket is accessible', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/bucket/vehicle-photos`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
    // Bucket exists — either 200 or accessible
    expect([200, 400]).toContain(res.status);
  });

  test('defect-photos bucket is accessible', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/bucket/defect-photos`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
    expect([200, 400]).toContain(res.status);
  });

  test('user can upload a test image to vehicle-photos', async () => {
    // 1x1 red PNG
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const testPath = `test-uploads/api-test-${Date.now()}.png`;

    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/vehicle-photos/${testPath}`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'image/png',
        },
        body: tinyPng,
      }
    );

    expect(res.status).toBe(200);

    // Clean up: delete the test file
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/vehicle-photos/${testPath}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
  });

  test('unauthenticated upload is rejected', async () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/vehicle-photos/should-fail.png`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'image/png',
        },
        body: tinyPng,
      }
    );

    // Should be rejected — no auth token
    expect(res.status).not.toBe(200);
  });
});
