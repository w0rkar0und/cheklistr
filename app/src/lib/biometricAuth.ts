import { isNative } from './capacitorPlatform';

interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if biometric authentication is available on this device.
 * Always returns false on web.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication.
 * No-op on web (returns success).
 */
export async function authenticateBiometric(reason: string): Promise<BiometricResult> {
  if (!isNative()) {
    return { success: true };
  }

  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Biometric authentication failed',
    };
  }
}
