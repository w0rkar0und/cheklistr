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
 * Uses the native file input with camera capture for mobile devices.
 * Full camera component integration will be added in the photo capture phase.
 */
export function ImageField({ item, value, onChange }: ImageFieldProps) {
  const config = (item.config ?? {}) as ImageConfig;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    onChange({ valueImageUrl: previewUrl });
    // TODO: Store the actual File object for upload
  };

  const handleRemove = () => {
    onChange({ valueImageUrl: null });
    if (inputRef.current) {
      inputRef.current.value = '';
    }
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
        <div className="image-capture-area">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCapture}
            className="image-input"
            id={`field-${item.id}`}
          />
          <label htmlFor={`field-${item.id}`} className="image-capture-button">
            <span className="image-capture-icon">&#128247;</span>
            <span>Take Photo</span>
          </label>
        </div>
      )}
    </div>
  );
}
