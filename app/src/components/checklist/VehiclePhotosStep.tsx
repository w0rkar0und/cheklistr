import { useRef } from 'react';
import type { PhotoType } from '../../types/database';
import { isNativePlatform } from '../../lib/capacitorPlatform';
import { capturePhoto, pickPhoto } from '../../lib/nativeCamera';

const REQUIRED_PHOTOS: { type: PhotoType; label: string }[] = [
  { type: 'front', label: 'Front' },
  { type: 'rear', label: 'Rear' },
  { type: 'left', label: 'Left Side' },
  { type: 'right', label: 'Right Side' },
  { type: 'tyre_fl', label: 'Tyre — Front Left' },
  { type: 'tyre_fr', label: 'Tyre — Front Right' },
  { type: 'tyre_rl', label: 'Tyre — Rear Left' },
  { type: 'tyre_rr', label: 'Tyre — Rear Right' },
  { type: 'mirror_left', label: 'Mirror — Left' },
  { type: 'mirror_right', label: 'Mirror — Right' },
];

interface VehiclePhotosStepProps {
  vehiclePhotos: Map<string, { file: File | null; previewUrl: string | null }>;
  onPhotoCapture: (photoType: string, file: File | null, previewUrl: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function VehiclePhotosStep({
  vehiclePhotos,
  onPhotoCapture,
  onNext,
  onBack,
}: VehiclePhotosStepProps) {
  const capturedCount = REQUIRED_PHOTOS.filter(
    (p) => vehiclePhotos.get(p.type)?.file !== null && vehiclePhotos.get(p.type)?.file !== undefined
  ).length;
  const allCaptured = capturedCount === REQUIRED_PHOTOS.length;

  return (
    <div className="form-step">
      <h2 className="form-step-title">Vehicle Photos</h2>
      <p className="form-step-description">
        Capture all {REQUIRED_PHOTOS.length} required photos ({capturedCount}/{REQUIRED_PHOTOS.length} done)
      </p>

      <div className="photo-grid">
        {REQUIRED_PHOTOS.map((photo) => (
          <PhotoSlot
            key={photo.type}
            photoType={photo.type}
            label={photo.label}
            current={vehiclePhotos.get(photo.type) ?? null}
            onCapture={onPhotoCapture}
          />
        ))}
      </div>

      <div className="form-step-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary btn-large"
          disabled={!allCaptured}
          onClick={onNext}
        >
          Continue to Checklist
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Individual photo slot — native camera on Capacitor, HTML inputs on web
// ============================================================

interface PhotoSlotProps {
  photoType: string;
  label: string;
  current: { file: File | null; previewUrl: string | null } | null;
  onCapture: (photoType: string, file: File | null, previewUrl: string | null) => void;
}

function PhotoSlot({ photoType, label, current, onCapture }: PhotoSlotProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    onCapture(photoType, file, previewUrl);
  };

  const handleRemove = () => {
    if (current?.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }
    onCapture(photoType, null, null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const openCamera = async () => {
    if (isNativePlatform()) {
      try {
        const result = await capturePhoto('rear');
        onCapture(photoType, result.file, result.previewUrl);
      } catch (err) {
        console.warn('Camera capture cancelled or failed:', err);
      }
    } else {
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
        cameraInputRef.current.click();
      }
    }
  };

  const openGallery = async () => {
    if (isNativePlatform()) {
      try {
        const result = await pickPhoto();
        onCapture(photoType, result.file, result.previewUrl);
      } catch (err) {
        console.warn('Gallery pick cancelled or failed:', err);
      }
    } else {
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
        galleryInputRef.current.click();
      }
    }
  };

  const hasPhoto = current?.file != null;

  return (
    <div className={`photo-slot ${hasPhoto ? 'photo-slot--captured' : ''}`}>
      {hasPhoto && current?.previewUrl ? (
        <div className="photo-slot-preview">
          <img src={current.previewUrl} alt={label} />
          <div className="photo-slot-actions">
            <button
              type="button"
              className="photo-slot-retake"
              onClick={openCamera}
              aria-label={`Retake ${label} photo`}
            >
              Retake
            </button>
            <button
              type="button"
              className="photo-slot-remove"
              onClick={handleRemove}
              aria-label={`Remove ${label} photo`}
            >
              &#x2715;
            </button>
          </div>
        </div>
      ) : (
        <div className="photo-slot-empty">
          <span className="photo-slot-label">{label}</span>
          <div className="photo-slot-buttons">
            <button type="button" className="photo-slot-btn" onClick={openCamera}>
              &#128247; Camera
            </button>
            <button type="button" className="photo-slot-btn photo-slot-btn--gallery" onClick={openGallery}>
              &#128444; Gallery
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs — always rendered so refs are never null on web */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="photo-slot-input"
        style={{ display: 'none' }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="photo-slot-input"
        style={{ display: 'none' }}
      />
    </div>
  );
}
