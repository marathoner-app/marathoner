import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'

import {
  findCopiedBundleViolations,
  findIosProjectViolations,
} from './ios-boundary-policy.mjs'

const validProject = {
  capacitorConfig: `appId: 'com.marathonerapp.marathoner'\nappName: 'Marathoner'\nwebDir: 'dist-ios'`,
  debugConfig: '#include? "local.xcconfig"',
  infoPlist: '<string>Marathoner</string>',
  packageJson: {
    dependencies: {
      '@capacitor/core': '8.5.2',
      '@capacitor/ios': '8.5.2',
    },
    devDependencies: { '@capacitor/cli': '8.5.2' },
  },
  packageManifest: 'exact: "8.5.2"',
  trackedPaths: ['ios/App/App/AppDelegate.swift'],
  xcodeProject:
    'PRODUCT_BUNDLE_IDENTIFIER = com.marathonerapp.marathoner;',
}

describe('iOS boundary policy', () => {
  it('accepts the production-shaped unsigned project', () => {
    expect(findIosProjectViolations(validProject)).toEqual([])
  })

  it('rejects account-local signing and generated files', () => {
    expect(
      findIosProjectViolations({
        ...validProject,
        trackedPaths: [
          'ios/App/App/public/index.html',
          'ios/signing.mobileprovision',
        ],
        xcodeProject: `${validProject.xcodeProject}\nDEVELOPMENT_TEAM = ABC123;`,
      }),
    ).toEqual(
      expect.arrayContaining([
        'Xcode project commits a development team',
        'ios/App/App/public/index.html is generated or account-local data',
        'ios/signing.mobileprovision is a forbidden signing artifact',
      ]),
    )
  })

  it('accepts an exact copied development bundle', () => {
    const builtFiles = new Map([
      ['index.html', Buffer.from('<script src="./assets/app.js"></script>')],
      ['assets/app.js', Buffer.from('project="marathoner-d9bf9"')],
    ])

    expect(
      findCopiedBundleViolations({
        builtFiles,
        copiedFiles: new Map(builtFiles),
        capacitorRuntimeConfig: JSON.stringify({
          appId: 'com.marathonerapp.marathoner',
          appName: 'Marathoner',
          webDir: 'dist-ios',
        }),
      }),
    ).toEqual([])
  })

  it('rejects beta configuration and a changed copied asset', () => {
    expect(
      findCopiedBundleViolations({
        builtFiles: new Map([
          ['index.html', Buffer.from('<script src="/marathoner/app.js"></script>')],
          [
            'app.js',
            Buffer.from('marathoner-d9bf9 marathonerapp-beta'),
          ],
        ]),
        copiedFiles: new Map([
          ['index.html', Buffer.from('different')],
          ['app.js', Buffer.from('marathoner-d9bf9 marathonerapp-beta')],
        ]),
        capacitorRuntimeConfig: '{}',
      }),
    ).toEqual(
      expect.arrayContaining([
        'iOS bundle contains marathonerapp-beta',
        'iOS index.html contains the GitHub Pages base path',
        'copied iOS bundle changed index.html',
      ]),
    )
  })
})
