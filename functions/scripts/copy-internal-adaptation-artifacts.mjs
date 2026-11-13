import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'

const functionsRoot = new URL('../', import.meta.url)
const repositoryRoot = new URL('../', functionsRoot)
const targetRoot = new URL('lib/functions/artifacts/', functionsRoot)
const closedBetaManifest = new URL(
  'docs/methodology/artifacts/closed-beta-provisional-methodology/0.2.0/manifest.json',
  repositoryRoot,
)

const manifestText = await readFile(closedBetaManifest, 'utf8')
const manifest = JSON.parse(manifestText)
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 4) {
  throw new Error('The closed-beta methodology manifest is incomplete.')
}
for (const artifact of manifest.artifacts) {
  const contents = await readFile(new URL(artifact.sourcePath, repositoryRoot))
  const digest = createHash('sha256').update(contents).digest('hex')
  if (digest !== artifact.sha256) {
    throw new Error(
      `The closed-beta ${artifact.kind} artifact no longer matches its pinned digest.`,
    )
  }
}

await mkdir(targetRoot, { recursive: true })
await Promise.all([
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-rules/0.3.0-draft/beta-rules.json',
      repositoryRoot,
    ),
    new URL('beta-rules.json', targetRoot),
  ),
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json',
      repositoryRoot,
    ),
    new URL('beta-rules-0.2.0-draft.json', targetRoot),
  ),
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-adaptation/0.3.0-draft/beta-adaptation.json',
      repositoryRoot,
    ),
    new URL('beta-adaptation.json', targetRoot),
  ),
  copyFile(
    closedBetaManifest,
    new URL('closed-beta-methodology-manifest.json', targetRoot),
  ),
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-safety/0.1.0-draft/beta-safety.json',
      repositoryRoot,
    ),
    new URL('beta-safety.json', targetRoot),
  ),
])
