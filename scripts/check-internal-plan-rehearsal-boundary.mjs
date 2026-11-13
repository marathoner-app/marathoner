import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sharedPlanAndAdaptationVersionText = [
  'beta-rules@0.3.0-draft',
  'beta-adaptation@0.3.0-draft',
]
const sharedProvisionalPlanBuildText = ['Create plan proposal']
const provisionalDogfoodBuildText = [
  'generateInternalAdaptationRecommendation',
  'Check recent training against the draft adjustment rules',
]
const closedBetaProvisionalBuildText = [
  'closed-beta-provisional-methodology@0.2.0',
  'beta-safety@0.1.0-draft',
  'founding_closed_beta',
]
const forbiddenBuildText = [
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
  'marathoner:internal-plan-rehearsal:frozen-activation:v1',
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

export async function findInternalPlanRehearsalLeaks(
  directory,
  {
    allowProvisionalPlanDogfood = false,
    allowClosedBetaProvisionalMethodology = false,
  } = {},
) {
  if (allowProvisionalPlanDogfood && allowClosedBetaProvisionalMethodology) {
    throw new Error(
      'A build cannot allow both development dogfood and closed-beta methodology artifacts.',
    )
  }

  const leaks = []
  const files = await collectTextFiles(directory)
  const forbiddenValues = [
    ...forbiddenBuildText,
    ...(allowProvisionalPlanDogfood ||
    allowClosedBetaProvisionalMethodology
      ? []
      : [...sharedPlanAndAdaptationVersionText, ...sharedProvisionalPlanBuildText]),
    ...(allowProvisionalPlanDogfood ? [] : provisionalDogfoodBuildText),
    ...(allowClosedBetaProvisionalMethodology
      ? []
      : closedBetaProvisionalBuildText),
  ]

  for (const file of files) {
    const contents = await readFile(file, 'utf8')
    for (const forbiddenText of forbiddenValues) {
      if (contents.includes(forbiddenText)) {
        leaks.push({ file, forbiddenText })
      }
    }
  }

  return leaks
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2]
  if (!outputDirectory) {
    throw new Error(
      'Pass the production or iOS build output directory to the internal rehearsal boundary check.',
    )
  }

  const resolvedOutputDirectory = path.resolve(outputDirectory)
  const flags = process.argv.slice(3)
  const supportedFlags = new Set([
    '--allow-provisional-plan-dogfood',
    '--allow-closed-beta-provisional-methodology',
  ])
  const unknownFlag = flags.find((flag) => !supportedFlags.has(flag))
  if (unknownFlag) {
    throw new Error(`Unknown methodology boundary flag: ${unknownFlag}`)
  }
  const allowProvisionalPlanDogfood = flags.includes(
    '--allow-provisional-plan-dogfood',
  )
  const allowClosedBetaProvisionalMethodology = flags.includes(
    '--allow-closed-beta-provisional-methodology',
  )
  const leaks = await findInternalPlanRehearsalLeaks(resolvedOutputDirectory, {
    allowProvisionalPlanDogfood,
    allowClosedBetaProvisionalMethodology,
  })

  if (leaks.length > 0) {
    const details = leaks
      .map(
        ({ file, forbiddenText }) =>
          `${path.relative(process.cwd(), file)} contains ${JSON.stringify(forbiddenText)}`,
      )
      .join('\n')
    throw new Error(
      `A methodology artifact crossed its allowed build boundary:\n${details}`,
    )
  }

  console.log(
    `Verified the methodology artifact boundary for ${path.relative(process.cwd(), resolvedOutputDirectory)}.`,
  )
}
