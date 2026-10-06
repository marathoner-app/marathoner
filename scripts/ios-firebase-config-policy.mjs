export const iosFirebaseConfigurationBoundary = {
  bundleId: 'com.marathonerapp.marathoner',
  destinationPath: 'ios/App/App/GoogleService-Info.plist',
  environments: {
    development: {
      appId: '1:677998037771:ios:71c7b70132f83f57c3b00e',
      projectId: 'marathoner-d9bf9',
      senderId: '677998037771',
      sourcePath:
        'ios/firebase/development/GoogleService-Info.plist',
      storageBucket: 'marathoner-d9bf9.firebasestorage.app',
    },
    beta: {
      appId: '1:156851031272:ios:8ad247902c872823084d5d',
      projectId: 'marathonerapp-beta',
      senderId: '156851031272',
      sourcePath: 'ios/firebase/beta/GoogleService-Info.plist',
      storageBucket: 'marathonerapp-beta.firebasestorage.app',
    },
  },
}

const requiredStringFields = [
  'API_KEY',
  'BUNDLE_ID',
  'GCM_SENDER_ID',
  'GOOGLE_APP_ID',
  'PROJECT_ID',
  'STORAGE_BUCKET',
]

const forbiddenFieldNames = [
  'APP_CHECK_DEBUG_TOKEN',
  'CLIENT_SECRET',
  'PRIVATE_KEY',
  'SERVICE_ACCOUNT',
]

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function plistString(source, field) {
  const escapedField = escapeRegularExpression(field)
  const match = source.match(
    new RegExp(
      `<key>\\s*${escapedField}\\s*</key>\\s*<string>([^<]*)</string>`,
      'u',
    ),
  )

  return match ? decodeXml(match[1].trim()) : null
}

export function parseIosFirebaseConfiguration(source) {
  return Object.fromEntries(
    requiredStringFields.map((field) => [field, plistString(source, field)]),
  )
}

function inspectEnvironmentConfiguration(environmentName, source) {
  const expected =
    iosFirebaseConfigurationBoundary.environments[environmentName]
  const values = parseIosFirebaseConfiguration(source)
  const violations = []

  for (const field of requiredStringFields) {
    if (!values[field]) {
      violations.push(
        `${environmentName} GoogleService-Info.plist is missing ${field}`,
      )
    }
  }

  const expectedFields = {
    BUNDLE_ID: iosFirebaseConfigurationBoundary.bundleId,
    GCM_SENDER_ID: expected.senderId,
    GOOGLE_APP_ID: expected.appId,
    PROJECT_ID: expected.projectId,
    STORAGE_BUCKET: expected.storageBucket,
  }
  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    if (values[field] && values[field] !== expectedValue) {
      violations.push(
        `${environmentName} GoogleService-Info.plist has unexpected ${field}`,
      )
    }
  }

  if (values.API_KEY && !/^AIza[\w-]+$/u.test(values.API_KEY)) {
    violations.push(
      `${environmentName} GoogleService-Info.plist has an invalid Firebase API_KEY`,
    )
  }

  for (const field of forbiddenFieldNames) {
    if (source.includes(`<key>${field}</key>`)) {
      violations.push(
        `${environmentName} GoogleService-Info.plist contains forbidden field ${field}`,
      )
    }
  }

  return { values, violations }
}

export function findIosFirebaseConfigurationViolations({
  configurationSources,
  environmentName,
  selectedSource,
}) {
  const selectedBoundary =
    iosFirebaseConfigurationBoundary.environments[environmentName]
  if (!selectedBoundary) {
    return [`Unsupported iOS Firebase environment ${environmentName}`]
  }

  const inspections = {}
  const violations = []
  for (const candidateEnvironment of Object.keys(
    iosFirebaseConfigurationBoundary.environments,
  )) {
    const source = configurationSources[candidateEnvironment]
    if (typeof source !== 'string') {
      violations.push(
        `${candidateEnvironment} GoogleService-Info.plist is missing`,
      )
      continue
    }

    const inspection = inspectEnvironmentConfiguration(
      candidateEnvironment,
      source,
    )
    inspections[candidateEnvironment] = inspection
    violations.push(...inspection.violations)
  }

  const developmentValues = inspections.development?.values
  const betaValues = inspections.beta?.values
  if (
    developmentValues?.GOOGLE_APP_ID &&
    developmentValues.GOOGLE_APP_ID === betaValues?.GOOGLE_APP_ID
  ) {
    violations.push(
      'development and beta GoogleService-Info.plist reuse GOOGLE_APP_ID',
    )
  }
  if (
    developmentValues?.API_KEY &&
    developmentValues.API_KEY === betaValues?.API_KEY
  ) {
    violations.push(
      'development and beta GoogleService-Info.plist reuse API_KEY',
    )
  }

  if (
    selectedSource !== undefined &&
    selectedSource !== configurationSources[environmentName]
  ) {
    violations.push(
      `generated GoogleService-Info.plist does not match ${environmentName}`,
    )
  }

  return [...new Set(violations)].sort()
}
