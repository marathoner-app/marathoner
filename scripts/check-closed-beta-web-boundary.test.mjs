import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  betaWebIdentityMarkers,
  developmentWebIdentityMarkers,
  inspectClosedBetaWebBoundary,
} from './check-closed-beta-web-boundary.mjs'

const temporaryDirectories = []

async function artifactWith(contents) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'closed-beta-web-'))
  temporaryDirectories.push(directory)
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'assets', 'app.js'), contents)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  )
})

describe('closed-beta web artifact boundary', () => {
  it('accepts an artifact containing the beta identity and pinned disclosure', async () => {
    const directory = await artifactWith(betaWebIdentityMarkers.join(' '))

    await expect(inspectClosedBetaWebBoundary(directory)).resolves.toEqual({
      developmentLeaks: [],
      missingBetaMarkers: [],
    })
  })

  it('reports a missing beta identity marker', async () => {
    const missingMarker = betaWebIdentityMarkers[2]
    const directory = await artifactWith(
      betaWebIdentityMarkers.filter((marker) => marker !== missingMarker).join(' '),
    )

    const result = await inspectClosedBetaWebBoundary(directory)

    expect(result.missingBetaMarkers).toEqual([missingMarker])
  })

  it('rejects every development identity marker even when beta markers exist', async () => {
    const directory = await artifactWith(
      [...betaWebIdentityMarkers, ...developmentWebIdentityMarkers].join(' '),
    )

    const result = await inspectClosedBetaWebBoundary(directory)

    expect(result.developmentLeaks.map(({ marker }) => marker)).toEqual(
      developmentWebIdentityMarkers,
    )
  })
})
