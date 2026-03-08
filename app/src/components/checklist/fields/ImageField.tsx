import { useRef } from 'react';
import type { ChecklistItem, ImageConfig } from '../../../types/database';
import type { ResponseValue } from '../../../stores/checklistStore';
import { isNativePlatform } from '../../../lib/capacitorPlatform';
import { capturePhoto, pickPhoto } from '../../../lib/nativeCamera';

interface ImageFieldProps {
  item: ChecklistItem;
  value: ResponseValue;
  onChange: (value: Partial<ResponseValue>) => void;
}

/**
 * Image capture field for checklist items.
 * On native: uses Capacitor camera plugin.
 * On web: provides explicit Camera / Gallery buttons with hidden file inputs.
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
  };

  const handleRemove = () => {
    onChange({ valueImageUrl: null });
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  const handleCamera = async () => {
    if (isNativePlatform()) {
      try {
        const result = await capturePhoto('rear');
        onChange({ valueImageUrl: result.previewUrl });
      } catch (err) {
        console.warn('Camera capture cancelled or failed:', err);
      }
    } else if (cameraRef.current) {
      cameraRef.current.value = '';
      cameraRef.current.click();
    }
  };

  const handleGallery = async () => {
    if (isNativePlatform()) {
      try {
        const result = await pickPhoto();
        onChange({ valueImageUrl: result.previewUrl });
      } catch (err) {
        console.warn('Gallery pick cancelled or failed:', err);
      }
    } else if (galleryRef.current) {
      galleryRef.current.value = '';
      galleryRef.current.click();
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
        <div className="image-capture-buttons">
          <button
            type="button"
            className="btn-secondary image-capture-btn"
            onClick={handleCamera}
          >
            &#128247; Camera
          </button>
          <button
            type="button"
            className="btn-secondary image-capture-btn"
            onClick={handleGallery}
          >
            &#128444; Gallery
          </button>
        </div>
      )}

      {/* Hidden file inputs — always rendered so refs are never null on web */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}
