import { isNative } from './capacitorPlatform';

interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Get current position using native GPS (Capacitor) or browser geolocation.
 */
export async function getCurrentPosition(): Promise<Position | null> {
  if (isNative()) {
    return getNativePosition();
  }
  return getWebPosition();
}

async function getNativePosition(): Promise<Position | null> {
  const { Geolocation } = await import('@capacitor/geolocation');

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10_000,
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch {
    return null;
  }
}

function getWebPosition(): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
