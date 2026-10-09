import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  findCopiedBundleViolations,
  findIosProjectViolations,
} from './ios-boundary-policy.mjs'
import {
  findIosFirebaseConfigurationViolations,
  iosFirebaseConfigurationBoundary,
} from './ios-firebase-config-policy.mjs'

const executeFile = promisify(execFile)
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const environmentArgumentIndex = process.argv.indexOf('--environment')
const environmentName =
  environmentArgumentIndex === -1
    ? 'development'
    : process.argv[environmentArgumentIndex + 1]

if (environmentName !== 'development' && environmentName !== 'beta') {
  throw new Error(
    'Use --environment development or --environment beta when checking the iOS boundary.',
  )
}

async function fileEntriesBelow(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory()
        ? fileEntriesBelow(entryPath, root)
        : [[path.relative(root, entryPath), await readFile(entryPath)]]
    }),
  )

  return nested.flat()
}

async function filesBelow(directory) {
  return new Map(await fileEntriesBelow(directory, directory))
}

async function run() {
  const firebaseConfigurationEntries = await Promise.all(
    Object.entries(iosFirebaseConfigurationBoundary.environments).map(
      async ([candidateEnvironment, boundary]) => [
        candidateEnvironment,
        await readFile(path.join(repositoryRoot, boundary.sourcePath), 'utf8'),
      ],
    ),
  )
  const [
    appEntitlements,
    capacitorConfig,
    bridgeViewController,
    debugConfig,
    infoPlist,
    launchStoryboard,
    mainStoryboard,
    packageJson,
    packageManifest,
    packageResolution,
    sceneDelegate,
    xcodeProject,
    runtimeConfig,
    tracked,
    builtFiles,
    copiedFiles,
    selectedFirebaseConfiguration,
  ] = await Promise.all([
    readFile(path.join(repositoryRoot, 'ios/App/App/App.entitlements'), 'utf8'),
    readFile(path.join(repositoryRoot, 'capacitor.config.ts'), 'utf8'),
    readFile(
      path.join(
        repositoryRoot,
        'ios/App/App/MarathonerBridgeViewController.swift',
      ),
      'utf8',
    ),
    readFile(path.join(repositoryRoot, 'ios/debug.xcconfig'), 'utf8'),
    readFile(path.join(repositoryRoot, 'ios/App/App/Info.plist'), 'utf8'),
    readFile(
      path.join(
        repositoryRoot,
        'ios/App/App/Base.lproj/LaunchScreen.storyboard',
      ),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, 'ios/App/App/Base.lproj/Main.storyboard'),
      'utf8',
    ),
    readFile(path.join(repositoryRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(
      path.join(repositoryRoot, 'ios/App/CapApp-SPM/Package.swift'),
      'utf8',
    ),
    readFile(
      path.join(
        repositoryRoot,
        'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
      ),
      'utf8',
    ),
    readFile(path.join(repositoryRoot, 'ios/App/App/SceneDelegate.swift'), 'utf8'),
    readFile(
      path.join(repositoryRoot, 'ios/App/App.xcodeproj/project.pbxproj'),
      'utf8',
    ),
    readFile(
      path.join(repositoryRoot, 'ios/App/App/capacitor.config.json'),
      'utf8',
    ),
    executeFile(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', 'ios'],
      { cwd: repositoryRoot },
    ).then(
      ({ stdout }) => stdout.split('\n').filter(Boolean),
    ),
    filesBelow(path.join(repositoryRoot, 'dist-ios')),
    filesBelow(path.join(repositoryRoot, 'ios/App/App/public')),
    readFile(
      path.join(
        repositoryRoot,
        iosFirebaseConfigurationBoundary.destinationPath,
      ),
      'utf8',
    ),
  ])

  const violations = [
    ...findIosProjectViolations({
      appEntitlements,
      capacitorConfig,
      bridgeViewController,
      debugConfig,
      infoPlist,
      launchStoryboard,
      mainStoryboard,
      packageJson,
      packageManifest,
      packageResolution,
      sceneDelegate,
      trackedPaths: tracked,
      xcodeProject,
    }),
    ...findCopiedBundleViolations({
      builtFiles,
      capacitorRuntimeConfig: runtimeConfig,
      copiedFiles,
      environmentName,
    }),
    ...findIosFirebaseConfigurationViolations({
      configurationSources: Object.fromEntries(firebaseConfigurationEntries),
      environmentName,
      selectedSource: selectedFirebaseConfiguration,
    }),
  ]

  if (violations.length > 0) {
    throw new Error(`iOS boundary violations:\n- ${violations.join('\n- ')}`)
  }

  console.log(
    `The root Capacitor project and copied ${environmentName} bundle preserve the reviewed iOS boundary.`,
  )
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
