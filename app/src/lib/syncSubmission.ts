import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { deletePendingSubmission } from './offlineDb';
import type { PendingSubmission } from './offlineDb';

// ============================================================
// Cheklistr: Sync Engine
// Uploads a PendingSubmission from IndexedDB to Supabase,
// replicating the same 5-step pipeline as NewChecklistPage.
// ============================================================

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export interface SyncProgress {
  step: string;
  detail: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Upload a single pending submission to Supabase.
 * On success, removes it from IndexedDB.
 */
export async function syncSubmission(
  pending: PendingSubmission,
  accessToken: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Prefer': 'return=minimal',
  };

  try {
    // ── Step 1: Insert submission ──
    onProgress?.({ step: '1/5', detail: 'Creating submission…' });

    const submissionRow = {
      id: pending.submissionId,
      user_id: pending.userId,
      session_id: null,
      checklist_version_id: pending.checklistVersionId,
      status: 'submitted',
      contractor_id: pending.contractorId || null,
      contractor_name: pending.contractorName || null,
      vehicle_registration: pending.vehicleRegistration,
      mileage: pending.mileage ? parseInt(pending.mileage, 10) : null,
      make_model: pending.makeModel || null,
      colour: pending.colour || null,
      site_code: pending.siteCode || null,
      defect_summary: pending.defects.length > 0
        ? `${pending.defects.length} defect(s) reported`
        : null,
      ts_form_started: pending.tsFormStarted,
      ts_form_reviewed: pending.tsFormReviewed,
      ts_form_submitted: pending.tsFormSubmitted,
      latitude: pending.latitude,
      longitude: pending.longitude,
    };

    const insertRes = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(submissionRow),
      }),
      15000,
      'Submission insert'
    );

    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      throw new Error(`Insert failed (${insertRes.status}): ${errBody}`);
    }

    // ── Step 2: Insert checklist responses ──
    onProgress?.({ step: '2/5', detail: 'Saving responses…' });

    const responseRows = pending.responses
      .filter((r) => r.valueBoolean !== null || r.valueText !== null || r.valueNumber !== null || r.valueImageUrl !== null)
      .map((r) => ({
        submission_id: pending.submissionId,
        checklist_item_id: r.checklistItemId,
        value_boolean: r.valueBoolean,
        value_text: r.valueText,
        value_number: r.valueNumber,
        value_image_url: r.valueImageUrl,
      }));

    if (responseRows.length > 0) {
      const respRes = await withTimeout(
        fetch(`${SUPABASE_URL}/rest/v1/checklist_responses`, {
          method: 'POST',
          headers,
          body: JSON.stringify(responseRows),
        }),
        15000,
        'Response insert'
      );
      if (!respRes.ok) {
        console.error('[SYNC] Response insert failed:', respRes.status);
      }
    }

    // ── Step 3: Upload vehicle photos ──
    onProgress?.({ step: '3/5', detail: `Uploading ${pending.photos.length} photos…` });

    let uploadedCount = 0;
    await Promise.all(
      pending.photos.map(async ({ photoType, blob }) => {
        try {
          const filePath = `${pending.submissionId}/${photoType}.jpg`;
          const storageUrl = `${SUPABASE_URL}/storage/v1/object/vehicle-photos/${filePath}`;

          const uploadRes = await withTimeout(
            fetch(storageUrl, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'image/jpeg',
                'x-upsert': 'false',
              },
              body: blob,
            }),
            20000,
            `Photo upload ${photoType}`
          );

          if (!uploadRes.ok) {
            console.error(`[SYNC] Photo upload failed (${photoType}): ${uploadRes.status}`);
            return;
          }

          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${filePath}`;

          await withTimeout(
            fetch(`${SUPABASE_URL}/rest/v1/submission_photos`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                submission_id: pending.submissionId,
                photo_type: photoType,
                storage_url: publicUrl,
              }),
            }),
            10000,
            `Photo record ${photoType}`
          );
          uploadedCount++;
          onProgress?.({ step: '3/5', detail: `${uploadedCount}/${pending.photos.length} photos…` });
        } catch (err) {
          console.error(`[SYNC] Photo exception (${photoType}):`, err);
        }
      })
    );

    // ── Step 4: Insert defects ──
    if (pending.defects.length > 0) {
      onProgress?.({ step: '4/5', detail: `Saving ${pending.defects.length} defects…` });
    }

    for (let i = 0; i < pending.defects.length; i++) {
      const defect = pending.defects[i];
      let defectImageUrl: string | null = null;

      if (defect.imageBlob) {
        onProgress?.({ step: '4/5', detail: `Defect photo ${i + 1}…` });
        try {
          const filePath = `${pending.submissionId}/defect_${defect.defectNumber}.jpg`;
          const storageUrl = `${SUPABASE_URL}/storage/v1/object/defect-photos/${filePath}`;

          const upRes = await withTimeout(
            fetch(storageUrl, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'image/jpeg',
                'x-upsert': 'false',
              },
              body: defect.imageBlob,
            }),
            20000,
            `Defect photo ${i + 1}`
          );
          if (upRes.ok) {
            defectImageUrl = `${SUPABASE_URL}/storage/v1/object/public/defect-photos/${filePath}`;
          }
        } catch (err) {
          console.error(`[SYNC] Defect photo exception (${i + 1}):`, err);
        }
      }

      try {
        await withTimeout(
          fetch(`${SUPABASE_URL}/rest/v1/defects`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              submission_id: pending.submissionId,
              defect_number: defect.defectNumber,
              image_url: defectImageUrl,
              details: defect.details,
            }),
          }),
          15000,
          `Defect ${i + 1}`
        );
      } catch (err) {
        console.error(`[SYNC] Defect insert failed (${i + 1}):`, err);
      }
    }

    // ── Step 5: Remove from IndexedDB ──
    onProgress?.({ step: '5/5', detail: 'Complete!' });

    if (pending.id != null) {
      await deletePendingSubmission(pending.id);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SYNC] FATAL:', msg);
    return { success: false, error: msg };
  }
}
