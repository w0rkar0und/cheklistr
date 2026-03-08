import { Geolocation } from '@capacitor/geolocation';
import { isNativePlatform } from './capacitorPlatform';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

const TIMEOUT_MS = 15000;
const MAX_AGE_MS = 60000;

/**
 * Get the device's current GPS coordinates.
 * On native: uses Capacitor Geolocation plugin.
 * On web: uses navigator.geolocation API.
 * Throws on timeout or permission denial.
 */
export async function getCurrentLocation(): Promise<LocationCoords> {
  if (isNativePlatform()) {
    return getLocationNative();
  }
  return getLocationWeb();
}

// ── Native implementation ──────────────────────────────────────

async function getLocationNative(): Promise<LocationCoords> {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: TIMEOUT_MS,
    maximumAge: MAX_AGE_MS,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

// ── Web fallback implementation ────────────────────────────────

function getLocationWeb(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by this browser'));
      return;
    }

    // Wrap with a timeout since the web API timeout option is unreliable
    const timeoutId = setTimeout(() => {
      reject(new Error('Location request timed out'));
    }, TIMEOUT_MS + 2000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`Location error: ${err.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
        maximumAge: MAX_AGE_MS,
      },
    );
  });
}
