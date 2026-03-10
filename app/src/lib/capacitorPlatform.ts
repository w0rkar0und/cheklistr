import { Capacitor } from '@capacitor/core';

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (iOS or Android), false when running as a PWA in a browser.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: 'ios', 'android', or 'web'.
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
