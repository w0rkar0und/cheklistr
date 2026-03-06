import { useRef } from 'react';
import type { DefectEntry } from '../../stores/checklistStore';

interface DefectsStepProps {
  defects: DefectEntry[];
  onAddDefect: (defect: DefectEntry) => void;
  onUpdateDefect: (id: string, updates: Partial<DefectEntry>) => void;
  onRemoveDefect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DefectsStep({
  defects,
  onAddDefect,
  onUpdateDefect,
  onRemoveDefect,
  onNext,
  onBack,
}: DefectsStepProps) {
  const handleAddDefect = () => {
    onAddDefect({
      id: crypto.randomUUID(),
      imageUrl: null,
      imageFile: null,
      details: '',
    });
  };

  return (
    <div className="form-step">
      <h2 className="form-step-title">Defects</h2>
      <p className="form-step-description">
        Record any defects found during the inspection. You can skip this step if none were found.
      </p>

      {defects.map((defect, index) => (
        <DefectCard
          key={defect.id}
          defect={defect}
          index={index}
          onUpdate={(updates) => onUpdateDefect(defect.id, updates)}
          onRemove={() => onRemoveDefect(defect.id)}
        />
      ))}

      <button
        type="button"
        className="btn-secondary"
        onClick={handleAddDefect}
        style={{ width: '100%', marginBottom: '1rem' }}
      >
        + Add Defect
      </button>

      <div className="form-step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary btn-large"
          onClick={onNext}
        >
          Review Submission
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Individual defect card — camera/gallery choice
// ============================================================

interface DefectCardProps {
  defect: DefectEntry;
  index: number;
  onUpdate: (updates: Partial<DefectEntry>) => void;
  onRemove: () => void;
}

function DefectCard({ defect, index, onUpdate, onRemove }: DefectCardProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onUpdate({ imageFile: file, imageUrl: previewUrl });
  };

  const clearInputs = () => {
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  return (
    <div className="defect-card">
      <div className="defect-card-header">
        <h4>Defect #{index + 1}</h4>
        <button
          type="button"
          className="defect-remove-btn"
          onClick={onRemove}
          aria-label={`Remove defect ${index + 1}`}
        >
          Remove
        </button>
      </div>

      <label htmlFor={`defect-details-${defect.id}`}>Details *</label>
      <textarea
        id={`defect-details-${defect.id}`}
        value={defect.details}
        onChange={(e) => onUpdate({ details: e.target.value })}
        placeholder="Describe the defect..."
        rows={3}
      />

      {defect.imageUrl ? (
        <div className="defect-image-preview">
          <img src={defect.imageUrl} alt={`Defect ${index + 1}`} />
          <button
            type="button"
            className="image-remove-btn"
            onClick={() => {
              onUpdate({ imageFile: null, imageUrl: null });
              clearInputs();
            }}
          >
            Remove Photo
          </button>
        </div>
      ) : (
        <div className="defect-image-buttons">
          <button
            type="button"
            className="btn-secondary defect-photo-btn"
            onClick={() => { cameraRef.current!.value = ''; cameraRef.current!.click(); }}
          >
            &#128247; Camera
          </button>
          <button
            type="button"
            className="btn-secondary defect-photo-btn"
            onClick={() => { galleryRef.current!.value = ''; galleryRef.current!.click(); }}
          >
            &#128444; Gallery
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="photo-slot-input" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} className="photo-slot-input" />
    </div>
  );
}
