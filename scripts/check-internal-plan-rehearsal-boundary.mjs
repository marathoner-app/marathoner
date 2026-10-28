import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const forbiddenBuildText = [
  'beta-rules@0.1.0-draft',
  'beta-adaptation@0.1.0-draft',
  'beta-safety@0.1.0-draft',
  'Internal draft plan rehearsal',
  'Internal draft adaptation rehearsal',
  'Internal live adaptation history',
  'Pain and unusual-symptom escalation',
  'SAFETY-STOP-EMERGENCY',
  'Evaluate live draft evidence',
  'Active only in this rehearsal',
  'Session choice recorded:',
  'Draft plan projection',
  'Projection refused',
  'Session-only projected plan',
  'Calendar preview refused',
  'internal-plan-rehearsal',
  'Owner-only dogfood workspace',
  'Internal dogfood journey',
  'Session-only plan calendar',
  'Owner-only session projection',
  'Owner-only session draft',
  'Rehearsal preview, not a saved plan',
  'The next-workout card is previewing this draft.',
  'The Plan calendar is previewing this draft.',
  'Activating previews this draft in the home next-workout card',
  'session-only preview in home and Plan',
  'Owner-only daily comparison',
  'Today in the session draft',
  'Same-date comparison only',
  'internal-eligible-profile@1.0.0',
  'internal-eligible-run@1.0.0',
  'Frozen eligible rehearsal profile',
  'Frozen completed-run evidence',
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
