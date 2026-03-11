import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cheklistr.app',
  appName: 'Cheklistr',
  webDir: 'dist',
  plugins: {
    Camera: {
      presentationStyle: 'popover',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#F1F5F9',
  },
};

export default config;
