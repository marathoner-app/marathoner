import { describe, expect, it } from 'vitest'

import {
  findIosFirebaseConfigurationViolations,
  parseIosFirebaseConfiguration,
} from './ios-firebase-config-policy.mjs'

function plist({ apiKey, appId, projectId, senderId, storageBucket }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>API_KEY</key>
  <string>${apiKey}</string>
  <key>GCM_SENDER_ID</key>
  <string>${senderId}</string>
  <key>BUNDLE_ID</key>
  <string>com.marathonerapp.marathoner</string>
  <key>PROJECT_ID</key>
  <string>${projectId}</string>
  <key>STORAGE_BUCKET</key>
  <string>${storageBucket}</string>
  <key>GOOGLE_APP_ID</key>
  <string>${appId}</string>
</dict>
</plist>`
}

const development = plist({
  apiKey: 'AIza-development-public-key',
  appId: '1:677998037771:ios:71c7b70132f83f57c3b00e',
  projectId: 'marathoner-d9bf9',
  senderId: '677998037771',
  storageBucket: 'marathoner-d9bf9.firebasestorage.app',
})
const beta = plist({
  apiKey: 'AIza-beta-public-key',
  appId: '1:156851031272:ios:8ad247902c872823084d5d',
  projectId: 'marathonerapp-beta',
  senderId: '156851031272',
  storageBucket: 'marathonerapp-beta.firebasestorage.app',
})

describe('iOS Firebase configuration policy', () => {
  it('parses the public Firebase identifiers', () => {
    expect(parseIosFirebaseConfiguration(development)).toMatchObject({
      BUNDLE_ID: 'com.marathonerapp.marathoner',
      GCM_SENDER_ID: '677998037771',
      GOOGLE_APP_ID: '1:677998037771:ios:71c7b70132f83f57c3b00e',
      PROJECT_ID: 'marathoner-d9bf9',
    })
  })

  it.each([
    ['development', development],
    ['beta', beta],
  ])(
    'accepts the selected %s configuration',
    (environmentName, selectedSource) => {
      expect(
        findIosFirebaseConfigurationViolations({
          configurationSources: { development, beta },
          environmentName,
          selectedSource,
        }),
      ).toEqual([])
    },
  )

  it('rejects a missing native configuration', () => {
    expect(
      findIosFirebaseConfigurationViolations({
        configurationSources: { development },
        environmentName: 'development',
        selectedSource: development,
      }),
    ).toContain('beta GoogleService-Info.plist is missing')
  })

  it('rejects mismatched and cross-environment selection', () => {
    expect(
      findIosFirebaseConfigurationViolations({
        configurationSources: {
          development: development.replace(
            'com.marathonerapp.marathoner',
            'com.marathonerapp.wrong',
          ),
          beta,
        },
        environmentName: 'development',
        selectedSource: beta,
      }),
    ).toEqual(
      expect.arrayContaining([
        'development GoogleService-Info.plist has unexpected BUNDLE_ID',
        'generated GoogleService-Info.plist does not match development',
      ]),
    )
  })

  it('rejects another iOS app from the expected project', () => {
    expect(
      findIosFirebaseConfigurationViolations({
        configurationSources: {
          development: development.replace(
            '1:677998037771:ios:71c7b70132f83f57c3b00e',
            '1:677998037771:ios:anotherpublicappid',
          ),
          beta,
        },
        environmentName: 'development',
      }),
    ).toContain(
      'development GoogleService-Info.plist has unexpected GOOGLE_APP_ID',
    )
  })

  it('rejects shared credentials and secret-bearing fields', () => {
    const sharedBeta = beta
      .replace('AIza-beta-public-key', 'AIza-development-public-key')
      .replace(
        '</dict>',
        '<key>APP_CHECK_DEBUG_TOKEN</key><string>never-commit-me</string></dict>',
      )

    expect(
      findIosFirebaseConfigurationViolations({
        configurationSources: { development, beta: sharedBeta },
        environmentName: 'beta',
        selectedSource: sharedBeta,
      }),
    ).toEqual(
      expect.arrayContaining([
        'development and beta GoogleService-Info.plist reuse API_KEY',
        'beta GoogleService-Info.plist contains forbidden field APP_CHECK_DEBUG_TOKEN',
      ]),
    )
  })

  it('rejects an unsupported environment', () => {
    expect(
      findIosFirebaseConfigurationViolations({
        configurationSources: { development, beta },
        environmentName: 'production',
      }),
    ).toEqual(['Unsupported iOS Firebase environment production'])
  })
})
