export const expectedIosBoundary = {
  appId: 'com.marathonerapp.marathoner',
  appName: 'Marathoner',
  capacitorVersion: '8.5.2',
  splashScreenVersion: '8.0.2',
  developmentProjectId: 'marathoner-d9bf9',
  betaProjectId: 'marathonerapp-beta',
  launchBackgroundColor: '#ffffff',
  startupErrorPath: 'startup-error.html',
  webDir: 'dist-ios',
}

const forbiddenNativeValues = [
  'marathonerapp-beta',
  '156851031272',
  'com.marathonerapp.spike',
  'Disposable architecture spike',
]

const environmentBundleBoundaries = {
  development: {
    projectId: expectedIosBoundary.developmentProjectId,
    forbiddenValues: [expectedIosBoundary.betaProjectId, '156851031272'],
  },
  beta: {
    projectId: expectedIosBoundary.betaProjectId,
    forbiddenValues: [expectedIosBoundary.developmentProjectId, '677998037771'],
  },
}

const alwaysForbiddenBundleValues = [
  'com.marathonerapp.spike',
  'Disposable architecture spike',
]

const forbiddenTrackedExtensions = [
  '.cer',
  '.key',
  '.mobileprovision',
  '.p12',
  '.pem',
  '.provisionprofile',
]

function requireText(violations, source, expected, label) {
  if (!source.includes(expected)) {
    violations.push(`${label} is missing ${expected}`)
  }
}

export function findIosProjectViolations({
  capacitorConfig,
  bridgeViewController,
  debugConfig,
  infoPlist,
  launchStoryboard,
  mainStoryboard,
  packageJson,
  packageManifest,
  sceneDelegate,
  trackedPaths,
  xcodeProject,
}) {
  const violations = []

  requireText(
    violations,
    capacitorConfig,
    `appId: '${expectedIosBoundary.appId}'`,
    'capacitor.config.ts',
  )
  for (const requiredSplashConfig of [
    'launchAutoHide: true',
    'launchShowDuration: 10_000',
    "backgroundColor: '#ffffffff'",
  ]) {
    requireText(
      violations,
      capacitorConfig,
      requiredSplashConfig,
      'capacitor.config.ts',
    )
  }
  requireText(
    violations,
    debugConfig,
    '#include? "local.xcconfig"',
    'debug.xcconfig',
  )
  requireText(
    violations,
    capacitorConfig,
    `appName: '${expectedIosBoundary.appName}'`,
    'capacitor.config.ts',
  )
  requireText(
    violations,
    capacitorConfig,
    `webDir: '${expectedIosBoundary.webDir}'`,
    'capacitor.config.ts',
  )
  requireText(
    violations,
    capacitorConfig,
    `backgroundColor: '${expectedIosBoundary.launchBackgroundColor}'`,
    'capacitor.config.ts',
  )
  requireText(
    violations,
    capacitorConfig,
    `errorPath: '${expectedIosBoundary.startupErrorPath}'`,
    'capacitor.config.ts',
  )
  requireText(
    violations,
    xcodeProject,
    `PRODUCT_BUNDLE_IDENTIFIER = ${expectedIosBoundary.appId};`,
    'Xcode project',
  )
  requireText(
    violations,
    infoPlist,
    `<string>${expectedIosBoundary.appName}</string>`,
    'Info.plist',
  )
  requireText(
    violations,
    infoPlist,
    '<key>UIUserInterfaceStyle</key>',
    'Info.plist',
  )
  requireText(
    violations,
    infoPlist,
    '<string>Light</string>',
    'Info.plist',
  )
  requireText(
    violations,
    launchStoryboard,
    'text="Marathoner."',
    'LaunchScreen.storyboard',
  )
  requireText(
    violations,
    launchStoryboard,
    'text="Loading your session..."',
    'LaunchScreen.storyboard',
  )
  requireText(
    violations,
    launchStoryboard,
    '<color key="backgroundColor" white="1"',
    'LaunchScreen.storyboard',
  )

  if (
    launchStoryboard.includes('image="Splash"') ||
    launchStoryboard.includes('systemBackgroundColor')
  ) {
    violations.push(
      'LaunchScreen.storyboard uses a disposable or adaptive launch background',
    )
  }
  requireText(
    violations,
    mainStoryboard,
    'customClass="MarathonerBridgeViewController"',
    'Main.storyboard',
  )
  for (const startupBridgeValue of [
    'installStartupOverlay()',
    'registerPluginInstance(StartupOverlayPlugin())',
    'DispatchQueue.main.asyncAfter(deadline: .now() + 10',
  ]) {
    requireText(
      violations,
      bridgeViewController,
      startupBridgeValue,
      'MarathonerBridgeViewController.swift',
    )
  }
  requireText(
    violations,
    sceneDelegate,
    'guard let sceneWindow = window',
    'SceneDelegate.swift',
  )
  if (
    sceneDelegate.includes('UIWindow(windowScene:') ||
    sceneDelegate.includes('CAPBridgeViewController()')
  ) {
    violations.push(
      'SceneDelegate.swift replaces the storyboard-provided Capacitor window',
    )
  }
  requireText(
    violations,
    packageManifest,
    `exact: "${expectedIosBoundary.capacitorVersion}"`,
    'CapApp-SPM Package.swift',
  )

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  for (const packageName of [
    '@capacitor/cli',
    '@capacitor/core',
    '@capacitor/ios',
  ]) {
    if (dependencies[packageName] !== expectedIosBoundary.capacitorVersion) {
      violations.push(
        `${packageName} must be pinned to ${expectedIosBoundary.capacitorVersion}`,
      )
    }
  }
  if (
    dependencies['@capacitor/splash-screen'] !==
    expectedIosBoundary.splashScreenVersion
  ) {
    violations.push(
      `@capacitor/splash-screen must be pinned to ${expectedIosBoundary.splashScreenVersion}`,
    )
  }

  if (/\bDEVELOPMENT_TEAM\s*=\s*[^;\s]+\s*;/u.test(xcodeProject)) {
    violations.push('Xcode project commits a development team')
  }
  if (/\bPROVISIONING_PROFILE(?:_SPECIFIER)?\s*=\s*[^;\s]+\s*;/u.test(xcodeProject)) {
    violations.push('Xcode project commits a provisioning profile')
  }

  for (const trackedPath of trackedPaths) {
    const normalizedPath = trackedPath.toLowerCase()
    if (
      forbiddenTrackedExtensions.some((extension) =>
        normalizedPath.endsWith(extension),
      )
    ) {
      violations.push(`${trackedPath} is a forbidden signing artifact`)
    }
    if (
      normalizedPath.includes('/xcuserdata/') ||
      normalizedPath.endsWith('/local.xcconfig') ||
      normalizedPath.includes('/app/app/public/') ||
      normalizedPath.endsWith('/capacitor.config.json') ||
      normalizedPath.endsWith('/config.xml')
    ) {
      violations.push(`${trackedPath} is generated or account-local data`)
    }
  }

  for (const forbiddenValue of forbiddenNativeValues) {
    if (
      capacitorConfig.includes(forbiddenValue) ||
      debugConfig.includes(forbiddenValue) ||
      infoPlist.includes(forbiddenValue) ||
      packageManifest.includes(forbiddenValue) ||
      xcodeProject.includes(forbiddenValue)
    ) {
      violations.push(`native source contains ${forbiddenValue}`)
    }
  }

  return [...new Set(violations)].sort()
}

export function findCopiedBundleViolations({
  builtFiles,
  capacitorRuntimeConfig,
  copiedFiles,
  environmentName = 'development',
}) {
  const violations = []
  const environmentBoundary = environmentBundleBoundaries[environmentName]
  if (!environmentBoundary) {
    return [`Unsupported iOS bundle environment ${environmentName}`]
  }
  const indexHtml = builtFiles.get('index.html')?.toString('utf8') ?? ''
  const startupErrorHtml = builtFiles
    .get(expectedIosBoundary.startupErrorPath)
    ?.toString('utf8') ?? ''
  const builtText = [...builtFiles.entries()]
    .filter(([file]) => /\.(?:css|html|js|json|txt|xml)$/u.test(file))
    .map(([, contents]) => contents.toString('utf8'))
    .join('\n')

  if (!indexHtml.includes('./assets/')) {
    violations.push('iOS index.html does not use relative asset paths')
  }
  if (indexHtml.includes('/marathoner/')) {
    violations.push('iOS index.html contains the GitHub Pages base path')
  }
  for (const expectedStartupValue of [
    'data-marathoner-startup',
    'Loading your session...',
    'data-startup-recovery',
    '10000',
  ]) {
    if (!indexHtml.includes(expectedStartupValue)) {
      violations.push(
        `iOS index.html is missing startup marker ${expectedStartupValue}`,
      )
    }
  }
  for (const expectedErrorValue of [
    'Marathoner could not start',
    'Reload Marathoner',
  ]) {
    if (!startupErrorHtml.includes(expectedErrorValue)) {
      violations.push(
        `${expectedIosBoundary.startupErrorPath} is missing ${expectedErrorValue}`,
      )
    }
  }
  if (!builtText.includes(environmentBoundary.projectId)) {
    violations.push(
      `iOS bundle does not contain the ${environmentName} project`,
    )
  }
  for (const forbiddenValue of [
    ...environmentBoundary.forbiddenValues,
    ...alwaysForbiddenBundleValues,
  ]) {
    if (builtText.includes(forbiddenValue)) {
      violations.push(`iOS bundle contains ${forbiddenValue}`)
    }
  }

  for (const [file, contents] of builtFiles) {
    const copiedContents = copiedFiles.get(file)
    if (!copiedContents) {
      violations.push(`copied iOS bundle is missing ${file}`)
    } else if (!contents.equals(copiedContents)) {
      violations.push(`copied iOS bundle changed ${file}`)
    }
  }

  let runtimeConfig
  try {
    runtimeConfig = JSON.parse(capacitorRuntimeConfig)
  } catch {
    violations.push('generated capacitor.config.json is not valid JSON')
    return [...new Set(violations)].sort()
  }

  for (const field of ['appId', 'appName', 'webDir']) {
    if (runtimeConfig[field] !== expectedIosBoundary[field]) {
      violations.push(
        `generated capacitor.config.json has unexpected ${field}`,
      )
    }
  }
  if (
    runtimeConfig.ios?.backgroundColor !==
    expectedIosBoundary.launchBackgroundColor
  ) {
    violations.push(
      'generated capacitor.config.json has unexpected iOS backgroundColor',
    )
  }
  if (runtimeConfig.server?.errorPath !== expectedIosBoundary.startupErrorPath) {
    violations.push(
      'generated capacitor.config.json has unexpected server errorPath',
    )
  }
  if (
    runtimeConfig.plugins?.SplashScreen?.launchAutoHide !== true ||
    runtimeConfig.plugins?.SplashScreen?.launchShowDuration !== 10_000 ||
    runtimeConfig.plugins?.SplashScreen?.backgroundColor !== '#ffffffff'
  ) {
    violations.push(
      'generated capacitor.config.json has unexpected SplashScreen startup policy',
    )
  }

  return [...new Set(violations)].sort()
}
