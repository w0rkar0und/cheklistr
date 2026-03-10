import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './capacitorPlatform';

// ============================================================
// Secure Storage — Capacitor Preferences on native (iOS Keychain
// / Android Keystore), localStorage fallback on web.
// ============================================================

const KEY_AUTH_TOKEN = 'cheklistr_auth_token';
const KEY_REFRESH_TOKEN = 'cheklistr_refresh_token';
const KEY_BIOMETRIC_ENROLLED = 'cheklistr_biometric_enrolled';
const KEY_BIOMETRIC_USER_ID = 'cheklistr_biometric_user_id';

// ── Auth Token ─────────────────────────────────────────────────

export async function saveAuthTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (isNativePlatform()) {
    await Preferences.set({ key: KEY_AUTH_TOKEN, value: accessToken });
    await Preferences.set({ key: KEY_REFRESH_TOKEN, value: refreshToken });
  } else {
    localStorage.setItem(KEY_AUTH_TOKEN, accessToken);
    localStorage.setItem(KEY_REFRESH_TOKEN, refreshToken);
  }
}

export async function getAuthTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  if (isNativePlatform()) {
    const { value: accessToken } = await Preferences.get({ key: KEY_AUTH_TOKEN });
    const { value: refreshToken } = await Preferences.get({ key: KEY_REFRESH_TOKEN });
    return { accessToken, refreshToken };
  }
  return {
    accessToken: localStorage.getItem(KEY_AUTH_TOKEN),
    refreshToken: localStorage.getItem(KEY_REFRESH_TOKEN),
  };
}

export async function clearAuthTokens(): Promise<void> {
  if (isNativePlatform()) {
    await Preferences.remove({ key: KEY_AUTH_TOKEN });
    await Preferences.remove({ key: KEY_REFRESH_TOKEN });
  } else {
    localStorage.removeItem(KEY_AUTH_TOKEN);
    localStorage.removeItem(KEY_REFRESH_TOKEN);
  }
}

// ── Biometric Enrolment ────────────────────────────────────────

export async function setBiometricEnrolled(
  enrolled: boolean,
  userId?: string,
): Promise<void> {
  if (isNativePlatform()) {
    await Preferences.set({
      key: KEY_BIOMETRIC_ENROLLED,
      value: enrolled ? 'true' : 'false',
    });
    if (userId) {
      await Preferences.set({ key: KEY_BIOMETRIC_USER_ID, value: userId });
    }
    if (!enrolled) {
      await Preferences.remove({ key: KEY_BIOMETRIC_USER_ID });
    }
  } else {
    localStorage.setItem(KEY_BIOMETRIC_ENROLLED, enrolled ? 'true' : 'false');
    if (userId) {
      localStorage.setItem(KEY_BIOMETRIC_USER_ID, userId);
    }
    if (!enrolled) {
      localStorage.removeItem(KEY_BIOMETRIC_USER_ID);
    }
  }
}

export async function isBiometricEnrolled(): Promise<boolean> {
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key: KEY_BIOMETRIC_ENROLLED });
    return value === 'true';
  }
  return localStorage.getItem(KEY_BIOMETRIC_ENROLLED) === 'true';
}

export async function getBiometricUserId(): Promise<string | null> {
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key: KEY_BIOMETRIC_USER_ID });
    return value;
  }
  return localStorage.getItem(KEY_BIOMETRIC_USER_ID);
}
