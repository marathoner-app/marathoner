import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseClosedBetaProvisionalMethodologyManifest,
  type ClosedBetaProvisionalMethodologyManifest,
} from '../../src/domain/methodology/closedBetaProvisionalMethodology.js'

function manifestPath(): string {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url))
  const bundled = resolve(
    sourceDirectory,
    '..',
    'artifacts',
    'closed-beta-methodology-manifest.json',
  )
  return existsSync(bundled)
    ? bundled
    : resolve(
        sourceDirectory,
        '..',
        '..',
        'docs',
        'methodology',
        'artifacts',
        'closed-beta-provisional-methodology',
        '0.1.0',
        'manifest.json',
      )
}

export function loadPinnedClosedBetaMethodologyManifest(): ClosedBetaProvisionalMethodologyManifest {
  return parseClosedBetaProvisionalMethodologyManifest(
    readFileSync(manifestPath(), 'utf8'),
  )
}
