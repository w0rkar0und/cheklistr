import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Fixed banner shown when the device is offline.
 * Slides in from the top and informs the user that
 * submissions will be queued locally.
 */
export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-indicator">
      <span className="offline-indicator-dot" />
      You're offline — submissions will be saved locally
    </div>
  );
}
