import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Submission, SubmissionPhoto, ChecklistResponse, Defect } from '../../types/database';

interface FullSubmission extends Submission {
  photos: SubmissionPhoto[];
  responses: (ChecklistResponse & { item_label?: string; section_name?: string })[];
  defects: Defect[];
}

export function AdminSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<FullSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Collect all viewable images (submission photos + defect photos) for lightbox
  const allImages: { url: string; label: string }[] = submission
    ? [
        ...submission.photos.map((p) => ({
          url: p.storage_url,
          label: p.photo_type.replace(/_/g, ' '),
        })),
        ...submission.defects
          .filter((d) => d.image_url)
          .map((d) => ({
            url: d.image_url!,
            label: `Defect #${d.defect_number}`,
          })),
      ]
    : [];

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevImage = useCallback(() => {
    setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);
  const nextImage = useCallback(() => {
    setLightboxIndex((i) =>
      i !== null && i < allImages.length - 1 ? i + 1 : i
    );
  }, [allImages.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevImage();
      else if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, closeLightbox, prevImage, nextImage]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

      // Fetch submission
      const { data: sub, error: subErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (subErr || !sub) {
        setError('Submission not found');
        setLoading(false);
        return;
      }

      // Fetch photos
      const { data: photos } = await supabase
        .from('submission_photos')
        .select('*')
        .eq('submission_id', id)
        .order('created_at');

      // Fetch responses with item labels
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('*, checklist_items(label, section_id, checklist_sections(name))')
        .eq('submission_id', id)
        .order('created_at');

      // Fetch defects
      const { data: defects } = await supabase
        .from('defects')
        .select('*')
        .eq('submission_id', id)
        .order('defect_number');

      // Flatten the response joins
      const flatResponses = (responses ?? []).map((r: Record<string, unknown>) => {
        const item = r.checklist_items as Record<string, unknown> | null;
        const section = item?.checklist_sections as Record<string, string> | null;
        return {
          ...r,
          item_label: (item?.label as string) ?? 'Unknown item',
          section_name: section?.name ?? '',
          checklist_items: undefined,
        };
      }) as unknown as FullSubmission['responses'];

      setSubmission({
        ...(sub as Submission),
        photos: (photos ?? []) as SubmissionPhoto[],
        responses: flatResponses,
        defects: (defects ?? []) as Defect[],
      });
      setLoading(false);
    };

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="admin-detail">
        <div className="error-message">{error ?? 'Submission not found'}</div>
        <button className="btn-secondary" onClick={() => navigate('/admin/submissions')}>
          Back to Submissions
        </button>
      </div>
    );
  }

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  return (
    <div className="admin-detail">
      <button
        className="btn-secondary"
        onClick={() => navigate('/admin/submissions')}
        style={{ marginBottom: '1rem' }}
      >
        &larr; Back to Submissions
      </button>

      {/* Header */}
      <div className="detail-header">
        <h2>{submission.vehicle_registration}</h2>
        <span className={`status-badge status-badge--${submission.status}`}>
          {submission.status}
        </span>
      </div>

      {/* Vehicle & Driver Info */}
      <section className="detail-section">
        <h3>Vehicle & Driver</h3>
        <div className="detail-grid">
          <div className="detail-field">
            <span className="detail-label">VRM</span>
            <span className="detail-value td-mono">{submission.vehicle_registration}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Make/Model</span>
            <span className="detail-value">{submission.make_model ?? '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Colour</span>
            <span className="detail-value">{submission.colour ?? '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Mileage</span>
            <span className="detail-value">{submission.mileage?.toLocaleString() ?? '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Contractor</span>
            <span className="detail-value">
              {submission.contractor_name ?? '—'}
              {submission.contractor_id && ` (${submission.contractor_id})`}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Site</span>
            <span className="detail-value">{submission.site_code ?? '—'}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Location</span>
            <span className="detail-value">
              {submission.latitude != null && submission.longitude != null ? (
                <a
                  href={`https://www.google.com/maps?q=${submission.latitude},${submission.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="geo-link"
                >
                  {submission.latitude.toFixed(6)}, {submission.longitude.toFixed(6)}
                </a>
              ) : (
                '—'
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Timestamps */}
      <section className="detail-section">
        <h3>Timeline</h3>
        <div className="detail-grid">
          <div className="detail-field">
            <span className="detail-label">Form Started</span>
            <span className="detail-value">{formatDate(submission.ts_form_started)}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Form Reviewed</span>
            <span className="detail-value">{formatDate(submission.ts_form_reviewed ?? null)}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Form Submitted</span>
            <span className="detail-value">{formatDate(submission.ts_form_submitted ?? null)}</span>
          </div>
        </div>
      </section>

      {/* Checklist Responses */}
      {submission.responses.length > 0 && (
        <section className="detail-section">
          <h3>Checklist Responses</h3>
          <div className="response-list">
            {submission.responses.map((r) => (
              <div key={r.id} className="response-row">
                <span className="response-label">{r.item_label}</span>
                <span className={`response-value ${r.value_boolean === false ? 'response-fail' : ''}`}>
                  {r.value_boolean !== null
                    ? r.value_boolean
                      ? 'Yes'
                      : 'No'
                    : r.value_text ?? r.value_number?.toString() ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photos */}
      {submission.photos.length > 0 && (
        <section className="detail-section">
          <h3>Vehicle Photos ({submission.photos.length})</h3>
          <div className="photo-grid">
            {submission.photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="photo-card photo-card--clickable"
                role="button"
                tabIndex={0}
                onClick={() => setLightboxIndex(idx)}
                onKeyDown={(e) => { if (e.key === 'Enter') setLightboxIndex(idx); }}
              >
                <img
                  src={photo.storage_url}
                  alt={photo.photo_type}
                  loading="lazy"
                />
                <span className="photo-label">{photo.photo_type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Defects */}
      {submission.defects.length > 0 && (
        <section className="detail-section">
          <h3>Defects ({submission.defects.length})</h3>
          <div className="defect-list">
            {submission.defects.map((defect) => (
              <div key={defect.id} className="defect-card">
                <strong>Defect #{defect.defect_number}</strong>
                {defect.details && <p>{defect.details}</p>}
                {defect.image_url && (
                  <img
                    src={defect.image_url}
                    alt={`Defect ${defect.defect_number}`}
                    loading="lazy"
                    className="defect-image defect-image--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const idx = allImages.findIndex((img) => img.url === defect.image_url);
                      if (idx >= 0) setLightboxIndex(idx);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {submission.defects.length === 0 && (
        <section className="detail-section">
          <h3>Defects</h3>
          <p className="empty-state">No defects reported</p>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && allImages[lightboxIndex] && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">
              &times;
            </button>
            {allImages.length > 1 && lightboxIndex > 0 && (
              <button className="lightbox-nav lightbox-nav--prev" onClick={prevImage} aria-label="Previous">
                &#8249;
              </button>
            )}
            <img
              src={allImages[lightboxIndex].url}
              alt={allImages[lightboxIndex].label}
              className="lightbox-image"
            />
            {allImages.length > 1 && lightboxIndex < allImages.length - 1 && (
              <button className="lightbox-nav lightbox-nav--next" onClick={nextImage} aria-label="Next">
                &#8250;
              </button>
            )}
            <div className="lightbox-caption">
              {allImages[lightboxIndex].label}
              {allImages.length > 1 && (
                <span className="lightbox-counter">
                  {' '}({lightboxIndex + 1} / {allImages.length})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
