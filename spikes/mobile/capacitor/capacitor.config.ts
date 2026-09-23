import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.marathonerapp.spike.capacitor',
  appName: 'Marathoner Capacitor Spike',
  webDir: 'web',
  ios: {
    preferredContentMode: 'mobile',
  },
};

export default config;
