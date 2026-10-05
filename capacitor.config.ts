import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.marathonerapp.marathoner',
  appName: 'Marathoner',
  webDir: 'dist-ios',
  ios: {
    preferredContentMode: 'mobile',
  },
}

export default config
