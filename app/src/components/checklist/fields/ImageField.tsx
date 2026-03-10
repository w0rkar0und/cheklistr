import { useRef } from 'react';
import type { ChecklistItem, ImageConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';

interface ImageFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

/**
 * Image capture field for checklist items.
 * Provides explicit Camera / Gallery buttons for reliable mobile behaviour.
 */
export function ImageField({ item, value, onChange }: ImageFieldProps) {
  const config = (item.config ?? {}) as ImageConfig;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onChange({ valueImageUrl: previewUrl });
    // TODO: Store the actual File object for upload
  };

  const handleRemove = () => {
    onChange({ valueImageUrl: null });
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  return (
    <div className="field-image">
      <div className="field-label">
        {item.label}
        {item.is_required && <span className="field-required">*</span>}
      </div>
      {config.guidance && (
        <p className="field-guidance">{config.guidance}</p>
      )}

      {value.valueImageUrl ? (
        <div className="image-preview-container">
          <img
            src={value.valueImageUrl}
            alt={item.label}
            className="image-preview"
          />
          <button
            type="button"
            className="image-remove-btn"
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="image-capture-buttons">
          <button
            type="button"
            className="btn-secondary image-capture-btn"
            onClick={() => { cameraRef.current!.value = ''; cameraRef.current!.click(); }}
          >
            &#128247; Camera
          </button>
          <button
            type="button"
            className="btn-secondary image-capture-btn"
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
