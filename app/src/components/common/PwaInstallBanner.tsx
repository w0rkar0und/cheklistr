import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAuthStore } from '../../stores/authStore';

/**
 * A dismissible banner prompting the user to install Cheklistr as a PWA.
 * Only shows when:
 *  - The user is logged in
 *  - The browser supports PWA install (beforeinstallprompt fired)
 *  - The app isn't already installed
 *  - The user hasn't previously dismissed the banner
 */
export function PwaInstallBanner() {
  const { canPrompt, promptInstall, dismiss } = usePwaInstall();
  const profile = useAuthStore((s) => s.profile);

  if (!canPrompt || !profile) return null;

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-text">
          <strong>Install Cheklistr</strong>
          <span>Add to your home screen for quick access</span>
        </div>
        <div className="pwa-install-actions">
          <button className="btn-primary btn-small" onClick={promptInstall}>
            Install
          </button>
          <button className="btn-ghost btn-small" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
