import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './stores/authStore';
import { SessionExpiryOverlay } from './components/common/SessionExpiryOverlay';
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

  return (
    <>
      <RouterProvider router={router} />
      {isSessionExpired && <SessionExpiryOverlay />}
    </>
  );
}

export default App;
