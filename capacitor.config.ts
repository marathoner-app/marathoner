import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.marathonerapp.marathoner',
  appName: 'Marathoner',
  webDir: 'dist-ios',
  ios: {
    backgroundColor: '#101114',
    contentInset: 'never',
    preferredContentMode: 'mobile',
  },
  server: {
    errorPath: 'startup-error.html',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#101114ff',
      launchAutoHide: true,
      launchShowDuration: 10_000,
      showSpinner: false,
    },
  },
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/app-check': {
            symlink: true,
          },
        },
      },
    },
  },
}

export default config
