import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAuthStore } from '../../stores/authStore';

/**
 * A dismissible banner prompting the user to install Cheklistr as a PWA.
 * Only shows when:
 *  - The user is logged in
 *  - The browser supports PWA install (or is iOS Safari)
 *  - The app isn't already installed
 *  - The user hasn't previously dismissed the banner
 *
 * On iOS, shows manual instructions (Share → Add to Home Screen)
 * since Safari doesn't support beforeinstallprompt.
 */
export function PwaInstallBanner() {
  const { canPrompt, isIos, promptInstall, dismiss } = usePwaInstall();
  const profile = useAuthStore((s) => s.profile);

  if (!canPrompt || !profile) return null;

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-text">
          <strong>Install Cheklistr</strong>
          {isIos ? (
            <span>
              Tap{' '}
              <span className="pwa-ios-icon" aria-label="Share">
                {/* iOS share icon (box with arrow) */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              {' '}then <strong>"Add to Home Screen"</strong>
            </span>
          ) : (
            <span>Add to your home screen for quick access</span>
          )}
        </div>
        <div className="pwa-install-actions">
          {!isIos && (
            <button className="btn-primary btn-small" onClick={promptInstall}>
              Install
            </button>
          )}
          <button className="btn-ghost btn-small" onClick={dismiss}>
            {isIos ? 'Got it' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
}
