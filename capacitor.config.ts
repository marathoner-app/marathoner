import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.marathonerapp.marathoner',
  appName: 'Marathoner',
  webDir: 'dist-ios',
  ios: {
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  server: {
    errorPath: 'startup-error.html',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#ffffffff',
      launchAutoHide: true,
      launchShowDuration: 10_000,
      showSpinner: false,
    },
  },
}

export default config
