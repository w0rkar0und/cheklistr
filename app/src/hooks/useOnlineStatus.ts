import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { isNativePlatform } from '../lib/capacitorPlatform';

/**
 * Reactive hook that tracks device online/offline status.
 * On native: uses Capacitor Network plugin for reliable detection.
 * On web: uses navigator.onLine + event listeners.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (isNativePlatform()) {
      // Native: use Capacitor Network plugin
      let handle: { remove: () => void } | null = null;

      const setup = async () => {
        // Get initial status
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        // Listen for changes
        handle = await Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
      };

      setup();

      return () => {
        handle?.remove();
      };
    } else {
      // Web: use browser events
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return { isOnline };
}
