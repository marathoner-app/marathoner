import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const betaWebIdentityMarkers = Object.freeze([
  'marathonerapp-beta',
  'marathonerapp-beta.firebaseapp.com',
  '1:156851031272:web:a6ab19f6b760fcf5084d5d',
  'closed-beta-provisional-methodology@0.2.0',
  'founding_closed_beta',
])

export const developmentWebIdentityMarkers = Object.freeze([
  'marathoner-d9bf9',
  'marathoner-d9bf9.firebaseapp.com',
  '1:677998037771:web:9269b3b5f82909ccc3b00e',
])

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.txt'])

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(entryPath)))
    } else if (textExtensions.has(path.extname(entry.name))) {
      files.push(entryPath)
    }
  }

  return files
}

export async function inspectClosedBetaWebBoundary(directory) {
  const files = await collectTextFiles(directory)
  const foundBetaMarkers = new Set()
  const developmentLeaks = []

  for (const file of files) {
    const contents = await readFile(file, 'utf8')
    for (const marker of betaWebIdentityMarkers) {
      if (contents.includes(marker)) foundBetaMarkers.add(marker)
    }
    for (const marker of developmentWebIdentityMarkers) {
      if (contents.includes(marker)) {
        developmentLeaks.push({ file, marker })
      }
    }
  }

  return {
    developmentLeaks,
    missingBetaMarkers: betaWebIdentityMarkers.filter(
      (marker) => !foundBetaMarkers.has(marker),
    ),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2]
  if (!outputDirectory) {
    throw new Error('Pass the closed-beta web output directory to the boundary check.')
  }

  const resolvedOutputDirectory = path.resolve(outputDirectory)
  const result = await inspectClosedBetaWebBoundary(resolvedOutputDirectory)
  const violations = [
    ...result.missingBetaMarkers.map(
      (marker) => `missing required beta marker ${JSON.stringify(marker)}`,
    ),
    ...result.developmentLeaks.map(
      ({ file, marker }) =>
        `${path.relative(process.cwd(), file)} contains development marker ${JSON.stringify(marker)}`,
    ),
  ]

  if (violations.length > 0) {
    throw new Error(
      `Closed-beta web boundary violations:\n- ${violations.join('\n- ')}`,
    )
  }

  console.log(
    `Verified the shared beta Firebase and provisional-methodology boundary for ${path.relative(process.cwd(), resolvedOutputDirectory)}.`,
  )
}
