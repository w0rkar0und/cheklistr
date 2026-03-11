import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'web' | 'ios' | 'android' {
  return Capacitor.getPlatform() as 'web' | 'ios' | 'android';
}
