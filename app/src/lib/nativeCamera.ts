import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { isNativePlatform } from './capacitorPlatform';
import { compressImage } from './imageCompressor';

export interface PhotoResult {
  file: File;
  previewUrl: string;
}

/**
 * Capture a photo using the device camera.
 * On native: launches the Capacitor camera plugin (full-screen native UI).
 * On web: falls back to a programmatic <input type="file" capture> click.
 */
export async function capturePhoto(
  direction: 'rear' | 'front' = 'rear',
): Promise<PhotoResult> {
  if (isNativePlatform()) {
    return captureNative(direction, CameraSource.Camera);
  }
  return captureWeb(true);
}

/**
 * Pick a photo from the device gallery.
 * On native: launches the Capacitor photo picker.
 * On web: falls back to a programmatic <input type="file"> click.
 */
export async function pickPhoto(): Promise<PhotoResult> {
  if (isNativePlatform()) {
    return captureNative('rear', CameraSource.Photos);
  }
  return captureWeb(false);
}

// ── Native implementation ──────────────────────────────────────

async function captureNative(
  direction: 'rear' | 'front',
  source: CameraSource,
): Promise<PhotoResult> {
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source,
    direction: direction === 'rear' ? CameraDirection.Rear : CameraDirection.Front,
    width: 1280,
    height: 1280,
    correctOrientation: true,
  });

  if (!photo.base64String) {
    throw new Error('Camera returned no image data');
  }

  // Convert base64 → Blob → File
  const byteString = atob(photo.base64String);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = photo.format === 'png' ? 'png' : 'jpg';
  const blob = new Blob([ab], { type: mimeType });
  const rawFile = new File([blob], `photo_${Date.now()}.${ext}`, { type: mimeType });

  // Run through compression for consistent output
  const file = await compressImage(rawFile);
  const previewUrl = URL.createObjectURL(file);

  return { file, previewUrl };
}

// ── Web fallback implementation ────────────────────────────────

function captureWeb(useCamera: boolean): Promise<PhotoResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }

    input.onchange = async () => {
      const rawFile = input.files?.[0];
      if (!rawFile) {
        reject(new Error('No file selected'));
        return;
      }
      try {
        const file = await compressImage(rawFile);
        const previewUrl = URL.createObjectURL(file);
        resolve({ file, previewUrl });
      } catch (err) {
        reject(err);
      }
    };

    // Handle cancel — the change event won't fire
    input.oncancel = () => reject(new Error('Photo capture cancelled'));

    input.click();
  });
}
