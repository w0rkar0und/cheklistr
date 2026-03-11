import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './stores/authStore';
import { SessionExpiryOverlay } from './components/common/SessionExpiryOverlay';
import { PwaInstallBanner } from './components/common/PwaInstallBanner';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { requestLocationPermission } from './lib/nativeGeolocation';
import { router } from './router';
import './styles/global.css';

function App() {
  // Initialise auth listener (runs once)
  const { startSessionChecks } = useAuth();
  const appSession = useAuthStore((s) => s.appSession);
  const isSessionExpired = useAuthStore((s) => s.isSessionExpired);

  // Start session validity checks whenever we have an active session
  useEffect(() => {
    if (appSession?.id) {
      startSessionChecks(appSession.id);
    }
  }, [appSession?.id, startSessionChecks]);

  // Request location permission early on native platforms
  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <>
      <OfflineIndicator />
      <RouterProvider router={router} />
      <PwaInstallBanner />
      {isSessionExpired && <SessionExpiryOverlay />}
    </>
  );
}

export default App;
