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
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompressor';
import type { ResponseValue } from '../../stores/checklistStore';

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
    setSubmitProgress('Step 1/5: Creating submission…');
    console.log('[SUBMIT] Starting submission…');
    console.log('[SUBMIT] Auth user id:', profile.id);
    console.log('[SUBMIT] Checklist version id:', store.version.id);

    try {
      // Generate UUID client-side so we never need .select().single()
      // which hangs when PostgREST can't return the row after insert
      const submissionId = crypto.randomUUID();
      const hrCode = store.driverInfo.hrCode ? store.driverInfo.hrCode.substring(0, 7) : null;

      // 1. Insert submission (no .select() — we already have the ID)
      console.log('[SUBMIT] Step 1: Inserting submission', submissionId);
      const { error: subError } = await supabase
        .from('submissions')
        .insert({
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
        });

      if (subError) {
        console.error('[SUBMIT] Step 1 FAILED:', JSON.stringify(subError));
        throw new Error(`Submission failed: ${subError.message} (code: ${subError.code})`);
      }
      console.log('[SUBMIT] Step 1 OK');

      // 2. Insert checklist responses
      setSubmitProgress('Step 2/5: Saving responses…');
      console.log('[SUBMIT] Step 2: Inserting responses…');
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
        const { error: respError } = await supabase
          .from('checklist_responses')
          .insert(responseRows);
        if (respError) {
          console.error('[SUBMIT] Step 2 FAILED:', JSON.stringify(respError));
        } else {
          console.log('[SUBMIT] Step 2 OK —', responseRows.length, 'responses');
        }
      } else {
        console.log('[SUBMIT] Step 2 OK — no responses');
      }

      // 3. Upload vehicle photos (compressed)
      const photoEntries = Array.from(store.vehiclePhotos.entries()).filter(
        ([, pd]) => pd.file != null
      );
      console.log('[SUBMIT] Step 3:', photoEntries.length, 'photos to upload');
      let photoIdx = 0;

      for (const [photoType, photoData] of photoEntries) {
        if (!photoData.file) continue;
        photoIdx++;
        setSubmitProgress(`Step 3/5: Photo ${photoIdx}/${photoEntries.length}…`);

        try {
          const compressed = await compressImage(photoData.file);
          console.log(`[SUBMIT] Photo ${photoType}: ${(photoData.file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);

          const filePath = `${submissionId}/${photoType}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('vehicle-photos')
            .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false });

          if (uploadError) {
            console.error(`[SUBMIT] Photo upload FAILED (${photoType}):`, JSON.stringify(uploadError));
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('vehicle-photos')
            .getPublicUrl(filePath);

          const { error: recErr } = await supabase
            .from('submission_photos')
            .insert({
              submission_id: submissionId,
              photo_type: photoType,
              storage_url: urlData.publicUrl,
            });

          if (recErr) {
            console.error(`[SUBMIT] Photo record FAILED (${photoType}):`, JSON.stringify(recErr));
          } else {
            console.log(`[SUBMIT] Photo ${photoType} OK`);
          }
        } catch (photoErr) {
          console.error(`[SUBMIT] Photo exception (${photoType}):`, photoErr);
        }
      }

      // 4. Insert defects
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
            const { error: upErr } = await supabase.storage
              .from('defect-photos')
              .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false });

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

        const { error: defErr } = await supabase.from('defects').insert({
          submission_id: submissionId,
          defect_number: i + 1,
          image_url: defectImageUrl,
          details: defect.details,
        });

        if (defErr) {
          console.error(`[SUBMIT] Defect insert FAILED (${i + 1}):`, JSON.stringify(defErr));
        }
      }

      // 5. Done
      setSubmitProgress('Complete!');
      console.log('[SUBMIT] All done — navigating home');
      store.resetForm();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error('[SUBMIT] FATAL:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`Error: ${msg}`);
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
