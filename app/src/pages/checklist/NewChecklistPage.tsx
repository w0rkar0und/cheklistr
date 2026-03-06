import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChecklistStore } from '../../stores/checklistStore';
import { useAuthStore } from '../../stores/authStore';
import { fetchActiveChecklist } from '../../lib/checklist';
import { VehicleInfoStep } from '../../components/checklist/VehicleInfoStep';
import { VehiclePhotosStep } from '../../components/checklist/VehiclePhotosStep';
import { ChecklistSectionView } from '../../components/checklist/ChecklistSectionView';
import { DefectsStep } from '../../components/checklist/DefectsStep';
import { ReviewStep } from '../../components/checklist/ReviewStep';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompressor';
import type { ResponseValue } from '../../stores/checklistStore';

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

export function NewChecklistPage() {
  const navigate = useNavigate();
  const store = useChecklistStore();
  const profile = useAuthStore((s) => s.profile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load the active checklist on mount
  useEffect(() => {
    const load = async () => {
      store.setLoading(true);
      store.setLoadError(null);

      const { checklist, version, error } = await fetchActiveChecklist();
      if (error || !checklist || !version) {
        store.setLoadError(error ?? 'Failed to load checklist');
        store.setLoading(false);
        return;
      }

      store.setChecklistData(checklist, version);
      // Default driver site to the logged-in user's site
      if (profile?.site_code) {
        store.setDriverInfo({ site: profile.site_code });
      }
      store.setFormStarted();
      store.setLoading(false);
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
    setSubmitProgress('Checking auth…');

    try {
      // ── Pre-flight: verify auth token is valid ──
      console.log('[SUBMIT] Pre-flight: checking auth session…');
      const { data: sessionData, error: sessionErr } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        'Auth check'
      );
      if (sessionErr || !sessionData.session) {
        throw new Error('Auth session expired. Please log out and log back in.');
      }
      const accessToken = sessionData.session.access_token;
      console.log('[SUBMIT] Auth OK — token length:', accessToken.length);

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

      // ── Step 3: Upload vehicle photos ──
      const photoEntries = Array.from(store.vehiclePhotos.entries()).filter(
        ([, pd]) => pd.file != null
      );
      console.log('[SUBMIT] Step 3:', photoEntries.length, 'photos');
      let photoIdx = 0;

      for (const [photoType, photoData] of photoEntries) {
        if (!photoData.file) continue;
        photoIdx++;
        setSubmitProgress(`Step 3/5: Photo ${photoIdx}/${photoEntries.length}…`);

        try {
          const compressed = await compressImage(photoData.file);
          console.log(`[SUBMIT] Photo ${photoType}: ${(photoData.file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);

          const filePath = `${submissionId}/${photoType}.jpg`;
          const { error: uploadError } = await withTimeout(
            supabase.storage
              .from('vehicle-photos')
              .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false }),
            30000,
            `Photo upload ${photoType}`
          );

          if (uploadError) {
            console.error(`[SUBMIT] Photo upload FAILED (${photoType}):`, JSON.stringify(uploadError));
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('vehicle-photos')
            .getPublicUrl(filePath);

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
                storage_url: urlData.publicUrl,
              }),
            }),
            15000,
            `Photo record ${photoType}`
          );
          console.log(`[SUBMIT] Photo ${photoType} OK`);
        } catch (photoErr) {
          console.error(`[SUBMIT] Photo exception (${photoType}):`, photoErr);
          // Continue — don't block on one photo
        }
      }

      // ── Step 4: Insert defects ──
      if (store.defects.length > 0) {
        setSubmitProgress('Step 4/5: Saving defects…');
        console.log('[SUBMIT] Step 4:', store.defects.length, 'defects');
      }

      for (let i = 0; i < store.defects.length; i++) {
        const defect = store.defects[i];
        let defectImageUrl: string | null = null;

        if (defect.imageFile) {
          setSubmitProgress(`Step 4/5: Defect photo ${i + 1}…`);
          try {
            const compressed = await compressImage(defect.imageFile);
            const filePath = `${submissionId}/defect_${i + 1}.jpg`;
            const { error: upErr } = await withTimeout(
              supabase.storage
                .from('defect-photos')
                .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false }),
              30000,
              `Defect photo ${i + 1}`
            );
            if (!upErr) {
              const { data: urlData } = supabase.storage
                .from('defect-photos')
                .getPublicUrl(filePath);
              defectImageUrl = urlData.publicUrl;
            } else {
              console.error(`[SUBMIT] Defect photo FAILED (${i + 1}):`, JSON.stringify(upErr));
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
      store.resetForm();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('[SUBMIT] FATAL:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
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
