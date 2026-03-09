import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChecklistStore } from '../../stores/checklistStore';
import { useAuthStore } from '../../stores/authStore';
import { fetchActiveChecklist, fetchCachedChecklist } from '../../lib/checklist';
import { VehicleInfoStep } from '../../components/checklist/VehicleInfoStep';
import { VehiclePhotosStep } from '../../components/checklist/VehiclePhotosStep';
import { ChecklistSectionView } from '../../components/checklist/ChecklistSectionView';
import { DefectsStep } from '../../components/checklist/DefectsStep';
import { ReviewStep } from '../../components/checklist/ReviewStep';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessTokenFromStorage } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompressor';
import { savePendingSubmission, getPendingCount, saveDraft, deleteDraft, getDraft } from '../../lib/offlineDb';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { ResponseValue } from '../../stores/checklistStore';
import type { PendingPhoto, PendingDefect, PendingResponse, DraftResponse, DraftPhoto, DraftDefect } from '../../lib/offlineDb';

/** Race a promise against a timeout. Rejects with a clear message if the timeout wins. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

const STEPS = ['vehicle-info', 'photos', 'checklist', 'defects', 'review'] as const;

/** Convert an object-URL (blob:…) to a File. Used for draft-restored photos where file is null. */
async function blobUrlToFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

const MAX_PENDING = 10;

export function NewChecklistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useChecklistStore();
  const profile = useAuthStore((s) => s.profile);
  const { isOnline } = useOnlineStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Load the active checklist on mount (with offline fallback).
  // If resuming a draft, we load it directly from IndexedDB (not the store)
  // so there's no race condition with store resets or React strict-mode re-mounts.
  useEffect(() => {
    const locState = location.state as { resumedDraft?: boolean } | null;
    const isResuming = locState?.resumedDraft === true;

    // Clear the navigation state so a browser refresh doesn't re-trigger
    if (isResuming) {
      window.history.replaceState({}, '');
    }

    const load = async () => {
      store.setLoading(true);
      store.setLoadError(null);

      try {
        // Try network first
        const { checklist, version, error } = await fetchActiveChecklist();
        if (!error && checklist && version) {
          store.setChecklistData(checklist, version); // resets responses to defaults

          if (isResuming) {
            await applyDraftFromIndexedDB();
          } else {
            if (profile?.site_code) {
              store.setDriverInfo({ site: profile.site_code });
            }
            store.setFormStarted();
          }
          return;
        }

        // Network failed — try offline cache
        console.log('[CHECKLIST] Network fetch failed, trying cache…');
        const cached = await fetchCachedChecklist();
        if (cached.checklist && cached.version) {
          store.setChecklistData(cached.checklist, cached.version);

          if (isResuming) {
            await applyDraftFromIndexedDB();
          } else {
            if (profile?.site_code) {
              store.setDriverInfo({ site: profile.site_code });
            }
            store.setFormStarted();
          }
          return;
        }

        // Both failed
        store.setLoadError(error ?? 'Failed to load checklist — no cached version available');
      } catch (err) {
        console.error('[CHECKLIST] Unexpected error loading checklist:', err);
        store.setLoadError('Unexpected error loading checklist');
      } finally {
        store.setLoading(false);
      }
    };

    /** Load draft from IndexedDB and apply it to the store (after setChecklistData). */
    const applyDraftFromIndexedDB = async () => {
      try {
        const draft = await getDraft();
        if (!draft) {
          console.warn('[CHECKLIST] Resume flag set but no draft found in IndexedDB');
          store.setFormStarted();
          return;
        }

        console.log('[CHECKLIST] Applying draft from IndexedDB…');

        // Re-apply driver/vehicle info
        store.setDriverInfo({ ...draft.driverInfo });
        store.setVehicleInfo({ ...draft.vehicleInfo });

        // Re-apply responses over the defaults setChecklistData created
        for (const r of draft.responses) {
          store.setResponse(r.itemId, r.fieldType, {
            itemId: r.itemId,
            fieldType: r.fieldType,
            valueBoolean: r.valueBoolean,
            valueText: r.valueText,
            valueNumber: r.valueNumber,
            valueImageUrl: r.valueImageUrl,
          });
        }

        // Restore vehicle photo previews from Blobs
        for (const p of draft.vehiclePhotos) {
          const previewUrl = URL.createObjectURL(p.blob);
          store.setVehiclePhoto(p.photoType, null, previewUrl);
        }

        // Restore defects with image previews from Blobs
        for (const d of draft.defects) {
          store.addDefect({
            id: d.id,
            details: d.details,
            imageUrl: d.imageBlob ? URL.createObjectURL(d.imageBlob) : null,
            imageFile: null,
          });
        }

        // Restore timestamps and step
        if (draft.tsFormStarted) {
          // Manually set — setFormStarted() would overwrite with "now"
          useChecklistStore.setState({ tsFormStarted: draft.tsFormStarted });
        }
        if (draft.tsFormReviewed) {
          useChecklistStore.setState({ tsFormReviewed: draft.tsFormReviewed });
        }
        store.setCurrentStep(draft.currentStep);

        console.log('[CHECKLIST] Draft applied successfully');
      } catch (err) {
        console.error('[CHECKLIST] Failed to apply draft:', err);
        // Fall back to fresh form
        store.setFormStarted();
      }
    };

    load();

    // Cleanup on unmount
    return () => {
      store.resetForm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStepIndex = STEPS.indexOf(store.currentStep);
  const stepLabel = `Step ${currentStepIndex + 1} of ${STEPS.length}`;

  const goToStep = useCallback((step: typeof STEPS[number]) => {
    // If leaving review, clear the reviewed timestamp
    if (store.currentStep === 'review' && step !== 'review') {
      store.clearFormReviewed();
    }
    // If entering review, set the reviewed timestamp
    if (step === 'review') {
      store.setFormReviewed();
    }
    store.setCurrentStep(step);
    window.scrollTo(0, 0);
  }, [store]);

  const handleSubmit = async () => {
    if (!store.version || !profile) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // If offline, skip network attempt entirely and save locally
    if (!isOnline) {
      try {
        await saveSubmissionOffline();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSubmitError(`Offline save failed: ${msg}`);
      } finally {
        setIsSubmitting(false);
        setSubmitProgress('');
      }
      return;
    }

    setSubmitProgress('Checking auth…');

    try {
      // ── Pre-flight: read auth token directly from localStorage ──
      // supabase.auth.getSession() hangs during token refresh, so we bypass it entirely.
      console.log('[SUBMIT] Pre-flight: reading token from localStorage…');
      const accessToken = getAccessTokenFromStorage();
      if (!accessToken) {
        throw new Error('No auth token found. Please log out and log back in.');
      }
      console.log('[SUBMIT] Auth OK — token length:', accessToken.length);

      // ── Geolocation: capture GPS coordinates (mandatory) ──
      setSubmitProgress('Getting location…');
      console.log('[SUBMIT] Requesting geolocation…');
      let geoLatitude: number | null = null;
      let geoLongitude: number | null = null;

      try {
        const position = await withTimeout(
          new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000,
            });
          }),
          20000,
          'Geolocation'
        );
        geoLatitude = position.coords.latitude;
        geoLongitude = position.coords.longitude;
        console.log('[SUBMIT] Geolocation OK:', geoLatitude, geoLongitude);
      } catch (geoErr) {
        console.error('[SUBMIT] Geolocation failed:', geoErr);
        throw new Error(
          'Location access is required to submit the checklist. Please enable location services in your browser settings and try again.'
        );
      }

      // ── Step 1: Insert submission via raw fetch (bypasses Supabase JS client) ──
      setSubmitProgress('Step 1/5: Creating submission…');
      const submissionId = crypto.randomUUID();
      const hrCode = store.driverInfo.hrCode ? store.driverInfo.hrCode.substring(0, 7) : null;

      const submissionRow = {
        id: submissionId,
        user_id: profile.id,
        session_id: null,
        checklist_version_id: store.version.id,
        status: 'submitted',
        contractor_id: hrCode,
        contractor_name: store.driverInfo.name || null,
        vehicle_registration: store.vehicleInfo.vehicleRegistration,
        mileage: store.vehicleInfo.mileage ? parseInt(store.vehicleInfo.mileage, 10) : null,
        make_model: store.vehicleInfo.makeModel || null,
        colour: store.vehicleInfo.colour || null,
        site_code: store.driverInfo.site || profile.site_code,
        defect_summary: store.defects.length > 0
          ? `${store.defects.length} defect(s) reported`
          : null,
        ts_form_started: store.tsFormStarted,
        ts_form_reviewed: store.tsFormReviewed,
        ts_form_submitted: new Date().toISOString(),
        latitude: geoLatitude,
        longitude: geoLongitude,
      };

      console.log('[SUBMIT] Step 1: raw POST to', `${SUPABASE_URL}/rest/v1/submissions`);
      const insertRes = await withTimeout(
        fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(submissionRow),
        }),
        15000,
        'Submission insert'
      );

      if (!insertRes.ok) {
        const errBody = await insertRes.text();
        console.error('[SUBMIT] Step 1 FAILED:', insertRes.status, errBody);
        throw new Error(`Insert failed (${insertRes.status}): ${errBody}`);
      }
      console.log('[SUBMIT] Step 1 OK — id:', submissionId);

      // ── Step 2: Insert checklist responses ──
      setSubmitProgress('Step 2/5: Saving responses…');
      const responseRows = Array.from(store.responses.values())
        .filter((r) => hasValue(r))
        .map((r) => ({
          submission_id: submissionId,
          checklist_item_id: r.itemId,
          value_boolean: r.valueBoolean,
          value_text: r.valueText,
          value_number: r.valueNumber,
          value_image_url: r.valueImageUrl,
        }));

      if (responseRows.length > 0) {
        console.log('[SUBMIT] Step 2: inserting', responseRows.length, 'responses…');
        const respRes = await withTimeout(
          fetch(`${SUPABASE_URL}/rest/v1/checklist_responses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify(responseRows),
          }),
          15000,
          'Response insert'
        );
        if (!respRes.ok) {
          const errBody = await respRes.text();
          console.error('[SUBMIT] Step 2 FAILED:', respRes.status, errBody);
          // Non-fatal: continue
        } else {
          console.log('[SUBMIT] Step 2 OK');
        }
      }

      // ── Step 3: Upload vehicle photos (all in parallel via raw fetch) ──
      // Include photos that have either a File OR a previewUrl (draft-restored photos)
      const photoEntries = Array.from(store.vehiclePhotos.entries()).filter(
        ([, pd]) => pd.file != null || pd.previewUrl != null
      );
      console.log('[SUBMIT] Step 3:', photoEntries.length, 'photos (parallel raw fetch)');
      setSubmitProgress(`Step 3/5: Uploading ${photoEntries.length} photos…`);

      // Compress all photos first (CPU-bound, fast)
      const compressedPhotos = await Promise.all(
        photoEntries.map(async ([photoType, photoData]) => {
          try {
            // Resolve the file — either from the File object or from the object URL (draft-restored)
            let file: File;
            if (photoData.file) {
              file = photoData.file;
            } else if (photoData.previewUrl) {
              file = await blobUrlToFile(photoData.previewUrl, `${photoType}.jpg`);
            } else {
              return null;
            }
            const compressed = await compressImage(file);
            console.log(`[SUBMIT] Compressed ${photoType}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
            return { photoType, compressed };
          } catch {
            console.error(`[SUBMIT] Compression failed for ${photoType}`);
            return null;
          }
        })
      );

      const validPhotos = compressedPhotos.filter(Boolean) as { photoType: string; compressed: File }[];
      let uploadedCount = 0;

      // Upload ALL photos in parallel using raw fetch (bypasses Supabase JS client)
      await Promise.all(
        validPhotos.map(async ({ photoType, compressed }) => {
          try {
            const filePath = `${submissionId}/${photoType}.jpg`;
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
                body: compressed,
              }),
              20000,
              `Photo upload ${photoType}`
            );

            if (!uploadRes.ok) {
              const errBody = await uploadRes.text();
              console.error(`[SUBMIT] Photo upload FAILED (${photoType}): ${uploadRes.status} ${errBody}`);
              return;
            }

            // Build the public URL (same pattern Supabase uses)
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${filePath}`;

            await withTimeout(
              fetch(`${SUPABASE_URL}/rest/v1/submission_photos`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${accessToken}`,
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                  submission_id: submissionId,
                  photo_type: photoType,
                  storage_url: publicUrl,
                }),
              }),
              10000,
              `Photo record ${photoType}`
            );
            uploadedCount++;
            console.log(`[SUBMIT] Photo ${photoType} OK (${uploadedCount}/${validPhotos.length})`);
            setSubmitProgress(`Step 3/5: ${uploadedCount}/${validPhotos.length} photos…`);
          } catch (photoErr) {
            console.error(`[SUBMIT] Photo exception (${photoType}):`, photoErr);
          }
        })
      );

      // ── Step 4: Insert defects ──
      if (store.defects.length > 0) {
        setSubmitProgress('Step 4/5: Saving defects…');
        console.log('[SUBMIT] Step 4:', store.defects.length, 'defects');
      }

      for (let i = 0; i < store.defects.length; i++) {
        const defect = store.defects[i];
        let defectImageUrl: string | null = null;

        // Resolve defect image: either from File or from object URL (draft-restored)
        const hasDefectImage = defect.imageFile || defect.imageUrl;
        if (hasDefectImage) {
          setSubmitProgress(`Step 4/5: Defect photo ${i + 1}…`);
          try {
            let file: File;
            if (defect.imageFile) {
              file = defect.imageFile;
            } else {
              file = await blobUrlToFile(defect.imageUrl!, `defect_${i + 1}.jpg`);
            }
            const compressed = await compressImage(file);
            const filePath = `${submissionId}/defect_${i + 1}.jpg`;
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
                body: compressed,
              }),
              20000,
              `Defect photo ${i + 1}`
            );
            if (upRes.ok) {
              defectImageUrl = `${SUPABASE_URL}/storage/v1/object/public/defect-photos/${filePath}`;
            } else {
              const errBody = await upRes.text();
              console.error(`[SUBMIT] Defect photo FAILED (${i + 1}): ${upRes.status} ${errBody}`);
            }
          } catch (dpErr) {
            console.error(`[SUBMIT] Defect photo exception (${i + 1}):`, dpErr);
          }
        }

        try {
          await withTimeout(
            fetch(`${SUPABASE_URL}/rest/v1/defects`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                submission_id: submissionId,
                defect_number: i + 1,
                image_url: defectImageUrl,
                details: defect.details,
              }),
            }),
            15000,
            `Defect ${i + 1}`
          );
        } catch (defErr) {
          console.error(`[SUBMIT] Defect insert FAILED (${i + 1}):`, defErr);
        }
      }

      // ── Step 5: Done ──
      setSubmitProgress('Complete!');
      console.log('[SUBMIT] All done — navigating home');

      // Clean up any saved draft
      try { await deleteDraft(); } catch { /* non-fatal */ }

      store.resetForm();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('[SUBMIT] Network submission failed:', err);
      const msg = err instanceof Error ? err.message : String(err);

      // If not a geolocation / auth error, try saving offline
      if (
        !msg.includes('Location access is required') &&
        !msg.includes('No auth token found')
      ) {
        console.log('[SUBMIT] Attempting offline save…');
        try {
          await saveSubmissionOffline();
          return; // navigate happens inside saveSubmissionOffline
        } catch (offlineErr) {
          console.error('[SUBMIT] Offline save also failed:', offlineErr);
        }
      }

      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  };

  /** Save the current form state to IndexedDB for later sync. */
  const saveSubmissionOffline = async () => {
    if (!store.version || !profile) return;

    // Check queue capacity
    const pendingCount = await getPendingCount();
    if (pendingCount >= MAX_PENDING) {
      setSubmitError(`Offline queue is full (${MAX_PENDING} submissions). Please sync existing submissions first.`);
      return;
    }

    setSubmitProgress('Saving offline…');

    // Capture GPS (works offline — GPS doesn't need internet)
    let geoLatitude = 0;
    let geoLongitude = 0;
    try {
      const position = await withTimeout(
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
          });
        }),
        20000,
        'Geolocation'
      );
      geoLatitude = position.coords.latitude;
      geoLongitude = position.coords.longitude;
    } catch {
      // GPS optional for offline — can't block the save
      console.warn('[SUBMIT] GPS unavailable for offline save');
    }

    // Compress photos and collect as blobs (handle draft-restored photos with previewUrl only)
    const photos: PendingPhoto[] = [];
    const photoEntries = Array.from(store.vehiclePhotos.entries()).filter(
      ([, pd]) => pd.file != null || pd.previewUrl != null
    );

    for (const [photoType, photoData] of photoEntries) {
      try {
        let file: File;
        if (photoData.file) {
          file = photoData.file;
        } else if (photoData.previewUrl) {
          file = await blobUrlToFile(photoData.previewUrl, `${photoType}.jpg`);
        } else {
          continue;
        }
        const compressed = await compressImage(file);
        photos.push({ photoType, blob: compressed });
      } catch {
        console.error(`[SUBMIT] Compression failed for ${photoType}`);
      }
    }

    // Collect defects with image blobs (handle draft-restored defects with imageUrl only)
    const defects: PendingDefect[] = [];
    for (let i = 0; i < store.defects.length; i++) {
      const d = store.defects[i];
      let imageBlob: Blob | null = null;
      if (d.imageFile) {
        try {
          imageBlob = await compressImage(d.imageFile);
        } catch {
          console.error(`[SUBMIT] Defect image compression failed (${i + 1})`);
        }
      } else if (d.imageUrl) {
        try {
          const file = await blobUrlToFile(d.imageUrl, `defect_${i + 1}.jpg`);
          imageBlob = await compressImage(file);
        } catch {
          console.error(`[SUBMIT] Defect image fetch/compression failed (${i + 1})`);
        }
      }
      defects.push({
        defectNumber: i + 1,
        details: d.details,
        imageBlob,
      });
    }

    // Collect responses
    const responses: PendingResponse[] = Array.from(store.responses.values())
      .filter((r) => hasValue(r))
      .map((r) => ({
        checklistItemId: r.itemId,
        valueBoolean: r.valueBoolean,
        valueText: r.valueText,
        valueNumber: r.valueNumber,
        valueImageUrl: r.valueImageUrl,
      }));

    const hrCode = store.driverInfo.hrCode ? store.driverInfo.hrCode.substring(0, 7) : '';

    await savePendingSubmission({
      submissionId: crypto.randomUUID(),
      userId: profile.id,
      checklistVersionId: store.version.id,
      vehicleRegistration: store.vehicleInfo.vehicleRegistration,
      mileage: store.vehicleInfo.mileage,
      makeModel: store.vehicleInfo.makeModel,
      colour: store.vehicleInfo.colour,
      contractorId: hrCode,
      contractorName: store.driverInfo.name,
      siteCode: store.driverInfo.site || profile.site_code || '',
      responses,
      photos,
      defects,
      latitude: geoLatitude,
      longitude: geoLongitude,
      tsFormStarted: store.tsFormStarted,
      tsFormReviewed: store.tsFormReviewed,
      tsFormSubmitted: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    console.log('[SUBMIT] Saved to offline queue');

    // Draft is now a pending submission — clean up draft
    try { await deleteDraft(); } catch { /* non-fatal */ }

    store.resetForm();
    navigate('/', { replace: true, state: { offlineSaved: true } });
  };

  /** Save the current form as a draft to IndexedDB so the user can resume later. */
  const handleSaveDraft = async () => {
    if (!store.version || !profile) return;

    setIsSavingDraft(true);
    setSubmitError(null);

    try {
      // Serialise responses Map → array
      const responses: DraftResponse[] = Array.from(store.responses.values()).map((r) => ({
        itemId: r.itemId,
        fieldType: r.fieldType,
        valueBoolean: r.valueBoolean,
        valueText: r.valueText,
        valueNumber: r.valueNumber,
        valueImageUrl: r.valueImageUrl,
      }));

      // Compress vehicle photos → blobs
      const vehiclePhotos: DraftPhoto[] = [];
      for (const [photoType, pd] of store.vehiclePhotos.entries()) {
        if (!pd.file && !pd.previewUrl) continue;
        try {
          let blob: Blob;
          if (pd.file) {
            blob = await compressImage(pd.file);
          } else if (pd.previewUrl) {
            // Photo restored from a previous draft (file is null, previewUrl is an object URL)
            const res = await fetch(pd.previewUrl);
            blob = await res.blob();
          } else {
            continue;
          }
          vehiclePhotos.push({ photoType, blob });
        } catch {
          console.error(`[DRAFT] Photo compression failed for ${photoType}`);
        }
      }

      // Compress defect images → blobs
      const defects: DraftDefect[] = [];
      for (const d of store.defects) {
        let imageBlob: Blob | null = null;
        if (d.imageFile) {
          try {
            imageBlob = await compressImage(d.imageFile);
          } catch {
            console.error(`[DRAFT] Defect image compression failed`);
          }
        } else if (d.imageUrl) {
          try {
            const res = await fetch(d.imageUrl);
            imageBlob = await res.blob();
          } catch {
            console.error(`[DRAFT] Defect image fetch failed`);
          }
        }
        defects.push({ id: d.id, details: d.details, imageBlob });
      }

      await saveDraft({
        userId: profile.id,
        checklistVersionId: store.version.id,
        currentStep: store.currentStep,
        driverInfo: { ...store.driverInfo },
        vehicleInfo: { ...store.vehicleInfo },
        responses,
        vehiclePhotos,
        defects,
        tsFormStarted: store.tsFormStarted,
        tsFormReviewed: store.tsFormReviewed,
      });

      console.log('[DRAFT] Saved successfully');
      store.resetForm();
      navigate('/', { replace: true, state: { draftSaved: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`Failed to save draft: ${msg}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Loading state
  if (store.isLoading) {
    return (
      <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
        <div className="loading-spinner" />
        <p>Loading checklist...</p>
      </div>
    );
  }

  // Error state
  if (store.loadError) {
    return (
      <div className="form-step">
        <div className="error-message">{store.loadError}</div>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Go Back
        </button>
      </div>
    );
  }

  if (!store.version) return null;

  return (
    <div className="checklist-page">
      {/* Progress indicator */}
      <div className="form-progress">
        <span className="form-progress-label">{stepLabel}</span>
        <div className="form-progress-bar">
          <div
            className="form-progress-fill"
            style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {submitError && (
        <div className="error-message">{submitError}</div>
      )}

      {/* Step content */}
      {store.currentStep === 'vehicle-info' && profile && (
        <VehicleInfoStep
          vehicleInfo={store.vehicleInfo}
          driverInfo={store.driverInfo}
          profile={profile}
          onChange={store.setVehicleInfo}
          onDriverChange={store.setDriverInfo}
          onNext={() => goToStep('photos')}
        />
      )}

      {store.currentStep === 'photos' && (
        <VehiclePhotosStep
          vehiclePhotos={store.vehiclePhotos}
          onPhotoCapture={store.setVehiclePhoto}
          onNext={() => goToStep('checklist')}
          onBack={() => goToStep('vehicle-info')}
        />
      )}

      {store.currentStep === 'checklist' && (
        <div className="form-step">
          <h2 className="form-step-title">Inspection Checklist</h2>
          {store.version.sections.map((section) => (
            <ChecklistSectionView
              key={section.id}
              section={section}
              responses={store.responses}
              onResponseChange={(itemId, value) => {
                const item = section.items.find((i) => i.id === itemId);
                if (item) {
                  store.setResponse(itemId, item.field_type, value);
                }
              }}
            />
          ))}
          <div className="form-step-actions">
            <button type="button" className="btn-secondary" onClick={() => goToStep('photos')}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary btn-large"
              onClick={() => goToStep('defects')}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {store.currentStep === 'defects' && (
        <DefectsStep
          defects={store.defects}
          onAddDefect={store.addDefect}
          onUpdateDefect={store.updateDefect}
          onRemoveDefect={store.removeDefect}
          onNext={() => goToStep('review')}
          onBack={() => goToStep('checklist')}
        />
      )}

      {store.currentStep === 'review' && (
        <ReviewStep
          driverInfo={store.driverInfo}
          vehicleInfo={store.vehicleInfo}
          version={store.version}
          responses={store.responses}
          vehiclePhotos={store.vehiclePhotos}
          defects={store.defects}
          tsFormStarted={store.tsFormStarted}
          tsFormReviewed={store.tsFormReviewed}
          isSubmitting={isSubmitting}
          submitProgress={submitProgress}
          submitError={submitError}
          onSubmit={handleSubmit}
          onBack={() => goToStep('defects')}
          onSaveDraft={handleSaveDraft}
          isSavingDraft={isSavingDraft}
        />
      )}
    </div>
  );
}

function hasValue(r: ResponseValue): boolean {
  return (
    r.valueBoolean !== null ||
    r.valueText !== null ||
    r.valueNumber !== null ||
    r.valueImageUrl !== null
  );
}
