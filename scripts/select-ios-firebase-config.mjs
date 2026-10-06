import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  findIosFirebaseConfigurationViolations,
  iosFirebaseConfigurationBoundary,
} from './ios-firebase-config-policy.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function selectedEnvironment(argv) {
  const environmentIndex = argv.indexOf('--environment')
  const environmentName =
    environmentIndex === -1 ? undefined : argv[environmentIndex + 1]
  if (!iosFirebaseConfigurationBoundary.environments[environmentName]) {
    throw new Error(
      'Use --environment development or --environment beta when selecting the native Firebase configuration.',
    )
  }

  return environmentName
}

async function run() {
  const environmentName = selectedEnvironment(process.argv.slice(2))
  const configurationSources = Object.fromEntries(
    await Promise.all(
      Object.entries(iosFirebaseConfigurationBoundary.environments).map(
        async ([candidateEnvironment, boundary]) => [
          candidateEnvironment,
          await readFile(path.join(repositoryRoot, boundary.sourcePath), 'utf8'),
        ],
      ),
    ),
  )
  const selectedSource = configurationSources[environmentName]
  const violations = findIosFirebaseConfigurationViolations({
    configurationSources,
    environmentName,
    selectedSource,
  })
  if (violations.length > 0) {
    throw new Error(
      `Native Firebase configuration violations:\n- ${violations.join('\n- ')}`,
    )
  }

  const destinationPath = path.join(
    repositoryRoot,
    iosFirebaseConfigurationBoundary.destinationPath,
  )
  const temporaryPath = `${destinationPath}.tmp`
  await writeFile(temporaryPath, selectedSource, { mode: 0o644 })
  await rename(temporaryPath, destinationPath)

  console.log(
    `Selected the validated ${environmentName} native Firebase configuration for Xcode.`,
  )
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
