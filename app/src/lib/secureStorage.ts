import { isNative } from './capacitorPlatform';

/**
 * Secure key-value storage.
 * Uses Capacitor Preferences on native, localStorage on web.
 */
export async function setSecure(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function removeSecure(key: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}
