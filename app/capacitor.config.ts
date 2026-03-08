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
      launchShowDuration: 0,
      autoHide: true,
    },
  },

  ios: {
    contentInset: 'automatic',
  },

  android: {
    backgroundColor: '#F8FAFC',
  },
};

export default config;
