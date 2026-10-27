import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const forbiddenBuildText = [
  'beta-rules@0.1.0-draft',
  'beta-adaptation@0.1.0-draft',
  'Internal draft plan rehearsal',
  'Internal draft adaptation rehearsal',
  'Active only in this rehearsal',
  'Session choice recorded:',
  'internal-plan-rehearsal',
]
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

export async function findInternalPlanRehearsalLeaks(directory) {
  const leaks = []
  const files = await collectTextFiles(directory)

  for (const file of files) {
    const contents = await readFile(file, 'utf8')
    for (const forbiddenText of forbiddenBuildText) {
      if (contents.includes(forbiddenText)) {
        leaks.push({ file, forbiddenText })
      }
    }
  }

  return leaks
}

const outputDirectory = process.argv[2]
if (!outputDirectory) {
  throw new Error(
    'Pass the production or iOS build output directory to the internal rehearsal boundary check.',
  )
}

const resolvedOutputDirectory = path.resolve(outputDirectory)
const leaks = await findInternalPlanRehearsalLeaks(resolvedOutputDirectory)

if (leaks.length > 0) {
  const details = leaks
    .map(
      ({ file, forbiddenText }) =>
        `${path.relative(process.cwd(), file)} contains ${JSON.stringify(forbiddenText)}`,
    )
    .join('\n')
  throw new Error(
    `The internal plan rehearsal leaked into a distributable build:\n${details}`,
  )
}

console.log(
  `Verified that ${path.relative(process.cwd(), resolvedOutputDirectory)} excludes the internal methodology rehearsals.`,
)
