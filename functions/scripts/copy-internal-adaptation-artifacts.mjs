import { copyFile, mkdir } from 'node:fs/promises'

const functionsRoot = new URL('../', import.meta.url)
const repositoryRoot = new URL('../', functionsRoot)
const targetRoot = new URL('lib/functions/artifacts/', functionsRoot)

await mkdir(targetRoot, { recursive: true })
await Promise.all([
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-rules/0.2.0-draft/beta-rules.json',
      repositoryRoot,
    ),
    new URL('beta-rules.json', targetRoot),
  ),
  copyFile(
    new URL(
      'docs/methodology/artifacts/beta-adaptation/0.2.0-draft/beta-adaptation.json',
      repositoryRoot,
    ),
    new URL('beta-adaptation.json', targetRoot),
  ),
])
