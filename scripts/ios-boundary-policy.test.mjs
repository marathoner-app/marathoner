import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'

import {
  findCopiedBundleViolations,
  findIosProjectViolations,
} from './ios-boundary-policy.mjs'

const validProject = {
  appDelegate: `
    #if DEBUG
    AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
    #else
    AppCheck.setAppCheckProviderFactory(CustomAppCheckProviderFactory())
    #endif
    FirebaseApp.configure()
  `,
  appEntitlements:
    '<key>com.apple.developer.devicecheck.appattest-environment</key><string>production</string>',
  bridgeViewController:
    'installStartupOverlay() registerPluginInstance(StartupOverlayPlugin()) DispatchQueue.main.asyncAfter(deadline: .now() + 10',
  capacitorConfig: `appId: 'com.marathonerapp.marathoner'\nappName: 'Marathoner'\nwebDir: 'dist-ios'\nbackgroundColor: '#ffffff'\ncontentInset: 'always'\nerrorPath: 'startup-error.html'\nlaunchAutoHide: true\nlaunchShowDuration: 10_000\nbackgroundColor: '#ffffffff'\n'@capacitor-firebase/app-check'\nsymlink: true`,
  debugConfig: '#include? "local.xcconfig"',
  infoPlist:
    '<string>Marathoner</string><key>UIUserInterfaceStyle</key><string>Light</string>',
  launchStoryboard:
    '<view><label text="Marathoner."/><label text="Loading your session..."/><color key="backgroundColor" white="1"/></view>',
  mainStoryboard:
    '<viewController customClass="MarathonerBridgeViewController"/>',
  packageJson: {
    dependencies: {
      '@capacitor/core': '8.5.2',
      '@capacitor-firebase/app-check': '8.5.2',
      '@capacitor/ios': '8.5.2',
      '@capacitor/splash-screen': '8.0.2',
      firebase: '^12.19.0',
    },
    devDependencies: {
      '@capacitor/cli': '8.5.2',
      '@firebase/rules-unit-testing': '^5.0.2',
    },
  },
  packageManifest:
    'exact: "8.5.2"\n.package(name: "CapacitorFirebaseAppCheck", path: "symlinks/CapacitorFirebaseAppCheck")\n.product(name: "CapacitorFirebaseAppCheck", package: "CapacitorFirebaseAppCheck")',
  packageResolution:
    '"identity" : "firebase-ios-sdk"\n"version" : "12.19.2"',
  sceneDelegate: 'guard let sceneWindow = window',
  trackedPaths: ['ios/App/App/AppDelegate.swift'],
  xcodeProject: `
    PRODUCT_BUNDLE_IDENTIFIER = com.marathonerapp.marathoner;
    GoogleService-Info.plist in Resources
    APPDEBUG0001 /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        CODE_SIGN_STYLE = Automatic;
      };
      name = Debug;
    };
    APPRELEASE01 /* Release */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
      };
      name = Release;
    };
    APPCONFIG001 /* Build configuration list for PBXNativeTarget "App" */ = {
      isa = XCConfigurationList;
      buildConfigurations = (
        APPDEBUG0001 /* Debug */,
        APPRELEASE01 /* Release */,
      );
    };
  `,
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
          'ios/App/App/GoogleService-Info.plist',
          'ios/signing.mobileprovision',
        ],
        xcodeProject: `${validProject.xcodeProject}\nDEVELOPMENT_TEAM = ABC123;`,
      }),
    ).toEqual(
      expect.arrayContaining([
        'Xcode project commits a development team',
        'ios/App/App/GoogleService-Info.plist is generated or account-local data',
        'ios/App/App/public/index.html is generated or account-local data',
        'ios/signing.mobileprovision is a forbidden signing artifact',
      ]),
    )
  })

  it('rejects App Check dependency drift and generated SPM symlinks', () => {
    expect(
      findIosProjectViolations({
        ...validProject,
        capacitorConfig: validProject.capacitorConfig.replace(
          'symlink: true',
          'symlink: false',
        ),
        packageJson: {
          ...validProject.packageJson,
          dependencies: {
            ...validProject.packageJson.dependencies,
            '@capacitor-firebase/app-check': '^8.5.2',
            firebase: '^11.10.0',
          },
        },
        packageManifest: 'exact: "8.5.2"',
        packageResolution: '{}',
        trackedPaths: [
          'ios/App/CapApp-SPM/symlinks/CapacitorFirebaseAppCheck',
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        'capacitor.config.ts is missing symlink: true',
        '@capacitor-firebase/app-check must be pinned to 8.5.2',
        'firebase must use ^12.19.0',
        'CapApp-SPM Package.swift is missing .package(name: "CapacitorFirebaseAppCheck", path: "symlinks/CapacitorFirebaseAppCheck")',
        'Package.resolved is missing "identity" : "firebase-ios-sdk"',
        'ios/App/CapApp-SPM/symlinks/CapacitorFirebaseAppCheck is generated or account-local data',
      ]),
    )
  })

  it('rejects Firebase configuration before the native provider boundary', () => {
    expect(
      findIosProjectViolations({
        ...validProject,
        appDelegate: 'FirebaseApp.configure()',
      }),
    ).toContain(
      'AppDelegate must select Debug and Release App Check providers before FirebaseApp.configure()',
    )
  })

  it('rejects a native shell that can render beneath the iOS safe area', () => {
    expect(
      findIosProjectViolations({
        ...validProject,
        capacitorConfig: validProject.capacitorConfig.replace(
          "contentInset: 'always'",
          "contentInset: 'never'",
        ),
      }),
    ).toContain("capacitor.config.ts is missing contentInset: 'always'")
  })

  it('rejects an App Attest entitlement that is not bound to production', () => {
    expect(
      findIosProjectViolations({
        ...validProject,
        appEntitlements:
          '<key>com.apple.developer.devicecheck.appattest-environment</key><string>development</string>',
      }),
    ).toContain(
      'App.entitlements must bind com.apple.developer.devicecheck.appattest-environment to production',
    )
  })

  it('rejects a Debug target that requests the production App Attest entitlement', () => {
    const xcodeProject = validProject.xcodeProject.replace(
      'CODE_SIGN_STYLE = Automatic;',
      'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;',
    )

    expect(
      findIosProjectViolations({ ...validProject, xcodeProject }),
    ).toContain(
      'App target Debug configuration must not request the production App Attest entitlement',
    )
  })

  it('rejects a Release target without the production App Attest entitlement', () => {
    const xcodeProject = validProject.xcodeProject.replace(
      /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/u,
      '',
    )

    expect(
      findIosProjectViolations({ ...validProject, xcodeProject }),
    ).toContain(
      'App target Release configuration is missing CODE_SIGN_ENTITLEMENTS = App/App.entitlements;',
    )
  })

  it('accepts an exact copied development bundle', () => {
    const builtFiles = new Map([
      [
        'index.html',
        Buffer.from(
          '<main data-marathoner-startup>Loading your session...<a data-startup-recovery>Reload</a></main><script>10000</script><script src="./assets/app.js"></script>',
        ),
      ],
      [
        'startup-error.html',
        Buffer.from('Marathoner could not start. Reload Marathoner'),
      ],
      [
        'assets/app.js',
        Buffer.from(
          'project="marathoner-d9bf9" Live run-command rehearsal',
        ),
      ],
    ])

    expect(
      findCopiedBundleViolations({
        builtFiles,
        copiedFiles: new Map(builtFiles),
        capacitorRuntimeConfig: JSON.stringify({
          appId: 'com.marathonerapp.marathoner',
          appName: 'Marathoner',
          webDir: 'dist-ios',
          ios: {
            backgroundColor: '#ffffff',
            contentInset: 'always',
          },
          server: { errorPath: 'startup-error.html' },
          plugins: {
            SplashScreen: {
              backgroundColor: '#ffffffff',
              launchAutoHide: true,
              launchShowDuration: 10_000,
            },
          },
        }),
      }),
    ).toEqual([])
  })

  it('accepts an exact copied beta bundle and rejects development identity', () => {
    const builtFiles = new Map([
      [
        'index.html',
        Buffer.from(
          '<main data-marathoner-startup>Loading your session...<a data-startup-recovery>Reload</a></main><script>10000</script><script src="./assets/app.js"></script>',
        ),
      ],
      [
        'startup-error.html',
        Buffer.from('Marathoner could not start. Reload Marathoner'),
      ],
      [
        'assets/app.js',
        Buffer.from(
          'project="marathonerapp-beta" Live run-command rehearsal',
        ),
      ],
    ])

    expect(
      findCopiedBundleViolations({
        builtFiles,
        copiedFiles: new Map(builtFiles),
        environmentName: 'beta',
        capacitorRuntimeConfig: JSON.stringify({
          appId: 'com.marathonerapp.marathoner',
          appName: 'Marathoner',
          webDir: 'dist-ios',
          ios: {
            backgroundColor: '#ffffff',
            contentInset: 'always',
          },
          server: { errorPath: 'startup-error.html' },
          plugins: {
            SplashScreen: {
              backgroundColor: '#ffffffff',
              launchAutoHide: true,
              launchShowDuration: 10_000,
            },
          },
        }),
      }),
    ).toEqual([])

    const mixedFiles = new Map(builtFiles)
    mixedFiles.set(
      'assets/app.js',
      Buffer.from('marathonerapp-beta marathoner-d9bf9'),
    )

    expect(
      findCopiedBundleViolations({
        builtFiles: mixedFiles,
        copiedFiles: new Map(mixedFiles),
        environmentName: 'beta',
        capacitorRuntimeConfig: JSON.stringify({}),
      }),
    ).toContain('iOS bundle contains marathoner-d9bf9')
  })

  it('requires the rehearsal in both owner iOS bundles', () => {
    const files = new Map([
      [
        'index.html',
        Buffer.from(
          '<main data-marathoner-startup>Loading your session...<a data-startup-recovery>Reload</a></main><script>10000</script><script src="./assets/app.js"></script>',
        ),
      ],
      [
        'startup-error.html',
        Buffer.from('Marathoner could not start. Reload Marathoner'),
      ],
      ['assets/app.js', Buffer.from('project="marathonerapp-beta"')],
    ])
    const runtimeConfig = JSON.stringify({
      appId: 'com.marathonerapp.marathoner',
      appName: 'Marathoner',
      webDir: 'dist-ios',
      ios: { backgroundColor: '#ffffff', contentInset: 'always' },
      server: { errorPath: 'startup-error.html' },
      plugins: {
        SplashScreen: {
          backgroundColor: '#ffffffff',
          launchAutoHide: true,
          launchShowDuration: 10_000,
        },
      },
    })

    expect(
      findCopiedBundleViolations({
        builtFiles: files,
        copiedFiles: new Map(files),
        environmentName: 'beta',
        capacitorRuntimeConfig: runtimeConfig,
      }),
    ).toContain('beta iOS bundle is missing the live run-command rehearsal')

    files.set(
      'assets/app.js',
      Buffer.from('project="marathoner-d9bf9" Live run-command rehearsal'),
    )
    expect(
      findCopiedBundleViolations({
        builtFiles: files,
        copiedFiles: new Map(files),
        capacitorRuntimeConfig: runtimeConfig,
      }),
    ).toEqual([])

    files.set('assets/app.js', Buffer.from('project="marathoner-d9bf9"'))
    expect(
      findCopiedBundleViolations({
        builtFiles: files,
        copiedFiles: new Map(files),
        capacitorRuntimeConfig: runtimeConfig,
      }),
    ).toContain(
      'development iOS bundle is missing the live run-command rehearsal',
    )
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
        'iOS index.html contains the legacy project-site base path',
        'copied iOS bundle changed index.html',
      ]),
    )
  })

  it('rejects a copied native config without the shared safe-area boundary', () => {
    const builtFiles = new Map([
      [
        'index.html',
        Buffer.from(
          '<main data-marathoner-startup>Loading your session...<a data-startup-recovery>Reload</a></main><script>10000</script><script src="./assets/app.js"></script>',
        ),
      ],
      [
        'startup-error.html',
        Buffer.from('Marathoner could not start. Reload Marathoner'),
      ],
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
          ios: {
            backgroundColor: '#ffffff',
            contentInset: 'never',
          },
          server: { errorPath: 'startup-error.html' },
          plugins: {
            SplashScreen: {
              backgroundColor: '#ffffffff',
              launchAutoHide: true,
              launchShowDuration: 10_000,
            },
          },
        }),
      }),
    ).toContain(
      'generated capacitor.config.json has unexpected iOS contentInset',
    )
  })
})
