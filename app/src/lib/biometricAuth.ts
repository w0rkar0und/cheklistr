import {
  BiometricAuth,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth';
import { isNativePlatform } from './capacitorPlatform';

export interface BiometricAvailability {
  available: boolean;
  biometryType: string; // 'faceId' | 'touchId' | 'fingerprint' | 'faceAuthentication' | 'irisAuthentication' | 'none'
}

/**
 * Check whether the device supports and has biometric authentication
 * configured (e.g. Face ID enrolled, fingerprint registered).
 * On web: always returns { available: false }.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (!isNativePlatform()) {
    return { available: false, biometryType: 'none' };
  }

  try {
    await BiometricAuth.checkBiometry();
    const result = await BiometricAuth.checkBiometry();

    const typeMap: Record<number, string> = {
      [BiometryType.none]: 'none',
      [BiometryType.touchId]: 'touchId',
      [BiometryType.faceId]: 'faceId',
      [BiometryType.fingerprintAuthentication]: 'fingerprint',
      [BiometryType.faceAuthentication]: 'faceAuthentication',
      [BiometryType.irisAuthentication]: 'irisAuthentication',
    };

    const biometryType = typeMap[result.biometryType] ?? 'none';
    const available = result.isAvailable;

    return { available, biometryType };
  } catch {
    return { available: false, biometryType: 'none' };
  }
}

/**
 * Prompt the user to authenticate with biometrics.
 * Returns true on success, false on failure/cancel.
 */
export async function authenticateWithBiometric(
  reason: string = 'Unlock Cheklistr',
): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Use Password',
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable label for the biometric type
 * (e.g. "Face ID", "Fingerprint").
 */
export function getBiometricLabel(biometryType: string): string {
  switch (biometryType) {
    case 'faceId':
      return 'Face ID';
    case 'touchId':
      return 'Touch ID';
    case 'fingerprint':
    case 'faceAuthentication':
      return 'Biometric';
    default:
      return 'Biometric';
  }
}
