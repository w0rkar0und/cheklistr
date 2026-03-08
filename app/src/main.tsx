import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { isNativePlatform } from './lib/capacitorPlatform';
import App from './App.tsx';

// Register the service worker for PWA installability on web only.
// On native (Capacitor WebView), the SW is unnecessary — the native shell handles caching.
if (!isNativePlatform()) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
