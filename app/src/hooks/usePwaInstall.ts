import { useEffect, useState, useCallback } from 'react';

const DISMISSED_KEY = 'cheklistr-pwa-install-dismissed';

/**
 * Detect iOS Safari (which doesn't support beforeinstallprompt).
 */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Exclude Chrome/Firefox/Edge on iOS (they also can't install PWAs, but
  // the guidance is the same — use Safari's Add to Home Screen)
  return isIos && !window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Captures the browser's `beforeinstallprompt` event and provides
 * a method to trigger the native PWA install dialog.
 *
 * On iOS, where beforeinstallprompt doesn't exist, exposes an
 * `isIos` flag so the banner can show manual instructions instead.
 *
 * The prompt is suppressed if:
 *  - The app is already running in standalone/PWA mode
 *  - The user has previously dismissed the banner
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos] = useState(() => isIosSafari());
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }, []);

  // Show banner if: (has deferred prompt OR is iOS) AND not installed AND not dismissed
  const canPrompt = (!!deferredPrompt || isIos) && !isInstalled && !isDismissed;

  return { canPrompt, isInstalled, isIos, promptInstall, dismiss };
}

/**
 * Type augmentation for the BeforeInstallPromptEvent which isn't
 * in the standard TypeScript DOM lib yet.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
