import type { FullChecklistVersion } from '../../types/database';
import type { VehicleInfo, DriverInfo, ResponseValue, DefectEntry } from '../../stores/checklistStore';

interface ReviewStepProps {
  driverInfo: DriverInfo;
  vehicleInfo: VehicleInfo;
  version: FullChecklistVersion;
  responses: Map<string, ResponseValue>;
  vehiclePhotos: Map<string, { file: File | null; previewUrl: string | null }>;
  defects: DefectEntry[];
  tsFormStarted: string | null;
  tsFormReviewed: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

export function ReviewStep({
  driverInfo,
  vehicleInfo,
  version,
  responses,
  vehiclePhotos,
  defects,
  tsFormStarted,
  tsFormReviewed,
  isSubmitting,
  onSubmit,
  onBack,
}: ReviewStepProps) {
  const photoCount = Array.from(vehiclePhotos.values()).filter((p) => p.file != null).length;

  return (
    <div className="form-step">
      <h2 className="form-step-title">Review & Submit</h2>
      <p className="form-step-description">
        Please review all details before submitting. Going back will reset the review timestamp.
      </p>

      {/* Driver Info Summary */}
      <div className="review-section">
        <h3 className="review-section-title">Van Driver</h3>
        <div className="review-row">
          <span className="review-label">HR Code</span>
          <span className="review-value">{driverInfo.hrCode || '—'}</span>
        </div>
        <div className="review-row">
          <span className="review-label">Contractor Name</span>
          <span className="review-value">{driverInfo.name || '—'}</span>
        </div>
        {driverInfo.site && (
          <div className="review-row">
            <span className="review-label">Site</span>
            <span className="review-value">{driverInfo.site}</span>
          </div>
        )}
      </div>

      {/* Vehicle Info Summary */}
      <div className="review-section">
        <h3 className="review-section-title">Vehicle Details</h3>
        <div className="review-row">
          <span className="review-label">Registration</span>
          <span className="review-value">{vehicleInfo.vehicleRegistration}</span>
        </div>
        {vehicleInfo.mileage && (
          <div className="review-row">
            <span className="review-label">Mileage</span>
            <span className="review-value">{vehicleInfo.mileage}</span>
          </div>
        )}
        {vehicleInfo.makeModel && (
          <div className="review-row">
            <span className="review-label">Make & Model</span>
            <span className="review-value">{vehicleInfo.makeModel}</span>
          </div>
        )}
        {vehicleInfo.colour && (
          <div className="review-row">
            <span className="review-label">Colour</span>
            <span className="review-value">{vehicleInfo.colour}</span>
          </div>
        )}
      </div>

      {/* Photos Summary */}
      <div className="review-section">
        <h3 className="review-section-title">Photos</h3>
        <div className="review-row">
          <span className="review-label">Vehicle Photos</span>
          <span className="review-value">{photoCount}/10 captured</span>
        </div>
      </div>

      {/* Checklist Responses Summary */}
      <div className="review-section">
        <h3 className="review-section-title">Inspection Checklist</h3>
        {version.sections.map((section) => (
          <div key={section.id} className="review-subsection">
            <h4 className="review-subsection-title">{section.name}</h4>
            {section.items.map((item) => {
              const response = responses.get(item.id);
              const displayValue = formatResponseValue(response);
              const isIssue = item.triggers_defect && response?.valueBoolean === false;

              return (
                <div
                  key={item.id}
                  className={`review-row ${isIssue ? 'review-row--issue' : ''}`}
                >
                  <span className="review-label">{item.label}</span>
                  <span className="review-value">{displayValue}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Defects Summary */}
      <div className="review-section">
        <h3 className="review-section-title">Defects</h3>
        {defects.length === 0 ? (
          <p className="review-none">No defects recorded</p>
        ) : (
          defects.map((defect, i) => (
            <div key={defect.id} className="review-defect">
              <strong>Defect #{i + 1}</strong>
              <p>{defect.details || 'No details'}</p>
              {defect.imageUrl && <span className="review-badge">Photo attached</span>}
            </div>
          ))
        )}
      </div>

      {/* Timestamps */}
      <div className="review-section">
        <h3 className="review-section-title">Timestamps</h3>
        <div className="review-row">
          <span className="review-label">Form Started</span>
          <span className="review-value">
            {tsFormStarted ? new Date(tsFormStarted).toLocaleString('en-GB') : '—'}
          </span>
        </div>
        <div className="review-row">
          <span className="review-label">Form Reviewed</span>
          <span className="review-value">
            {tsFormReviewed ? new Date(tsFormReviewed).toLocaleString('en-GB') : 'Now'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="form-step-actions">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={isSubmitting}>
          Back (resets review time)
        </button>
        <button
          type="button"
          className="btn-primary btn-large btn-submit"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Inspection'}
        </button>
      </div>
    </div>
  );
}

function formatResponseValue(response: ResponseValue | undefined): string {
  if (!response) return '—';

  switch (response.fieldType) {
    case 'boolean':
      if (response.valueBoolean === true) return 'Yes';
      if (response.valueBoolean === false) return 'No';
      return '—';
    case 'text':
      return response.valueText ?? '—';
    case 'number':
      return response.valueNumber != null ? String(response.valueNumber) : '—';
    case 'select':
      return response.valueText ?? '—';
    case 'image':
      return response.valueImageUrl ? 'Photo captured' : '—';
    default:
      return '—';
  }
}
