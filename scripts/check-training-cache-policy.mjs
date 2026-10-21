import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTrainingCachePolicyViolations } from './training-cache-policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const trainingRoots = [
  join(root, 'src/training'),
  join(root, 'src/persistence/firestore'),
]

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(path) : [path]
    }),
  )

  return files
    .flat()
    .filter((path) => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(path)))
}

const trainingSources = new Map()
for (const path of (await Promise.all(trainingRoots.map(sourceFiles))).flat()) {
  trainingSources.set(relative(root, path), await readFile(path, 'utf8'))
}

const firebaseClientFactory = await readFile(
  join(root, 'src/services/firebaseClientFactory.ts'),
  'utf8',
)
const violations = findTrainingCachePolicyViolations({
  firebaseClientFactory,
  trainingSources,
})

if (violations.length > 0) {
  throw new Error(
    `Training cache policy violations:\n- ${violations.join('\n- ')}`,
  )
}

console.log(
  'Training snapshots remain memory-only and training code contains no durable browser-storage path.',
)
