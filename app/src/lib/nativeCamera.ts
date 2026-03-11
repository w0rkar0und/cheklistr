import { isNative } from './capacitorPlatform';
import { compressImage } from './imageCompressor';

interface CaptureResult {
  blob: Blob;
  filename: string;
}

/**
 * Capture a photo using native camera (Capacitor) or fall back to file input (web).
 * Output is always a compressed JPEG blob ready for IndexedDB storage.
 */
export async function capturePhoto(): Promise<CaptureResult | null> {
  if (isNative()) {
    return captureNative();
  }
  return captureWeb();
}

async function captureNative(): Promise<CaptureResult | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 90,
      allowEditing: false,
    });

    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const rawBlob = await response.blob();
    const filename = `photo_${Date.now()}.jpg`;
    const rawFile = new File([rawBlob], filename, { type: rawBlob.type });
    const compressed = await compressImage(rawFile);

    return { blob: compressed, filename };
  } catch {
    // User cancelled or permission denied
    return null;
  }
}

async function captureWeb(): Promise<CaptureResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const compressed = await compressImage(file);
      const filename = `photo_${Date.now()}.jpg`;
      resolve({ blob: compressed, filename });
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Pick a photo from gallery using native picker or file input.
 */
export async function pickFromGallery(): Promise<CaptureResult | null> {
  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        quality: 90,
        allowEditing: false,
      });

      if (!photo.webPath) return null;

      const response = await fetch(photo.webPath);
      const rawBlob = await response.blob();
      const filename = `photo_${Date.now()}.jpg`;
      const rawFile = new File([rawBlob], filename, { type: rawBlob.type });
      const compressed = await compressImage(rawFile);

      return { blob: compressed, filename };
    } catch {
      return null;
    }
  }

  // Web fallback — same as captureWeb but without capture attribute
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const compressed = await compressImage(file);
      const filename = `photo_${Date.now()}.jpg`;
      resolve({ blob: compressed, filename });
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}
