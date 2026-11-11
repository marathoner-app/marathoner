import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findInternalPlanRehearsalLeaks } from './check-internal-plan-rehearsal-boundary.mjs'

const temporaryDirectories = []

async function createBuild(contents) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'marathoner-methodology-boundary-'),
  )
  temporaryDirectories.push(directory)
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'assets', 'index.js'), contents)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('methodology artifact build boundary', () => {
  it('rejects the closed-beta manifest from an ordinary build', async () => {
    const directory = await createBuild(
      'closed-beta-provisional-methodology@0.1.0',
    )

    await expect(findInternalPlanRehearsalLeaks(directory)).resolves.toEqual([
      expect.objectContaining({
        forbiddenText: 'closed-beta-provisional-methodology@0.1.0',
      }),
    ])
  })

  it('allows the pinned manifest only at the closed-beta boundary', async () => {
    const directory = await createBuild(
      'closed-beta-provisional-methodology@0.1.0',
    )

    await expect(
      findInternalPlanRehearsalLeaks(directory, {
        allowClosedBetaProvisionalMethodology: true,
      }),
    ).resolves.toEqual([])
  })

  it('keeps development dogfood out of a closed-beta build', async () => {
    const directory = await createBuild(
      'Check recent training against the draft adjustment rules',
    )

    await expect(
      findInternalPlanRehearsalLeaks(directory, {
        allowClosedBetaProvisionalMethodology: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        forbiddenText:
          'Check recent training against the draft adjustment rules',
      }),
    ])
  })

  it('keeps the closed-beta manifest out of a dogfood build', async () => {
    const directory = await createBuild(
      'closed-beta-provisional-methodology@0.1.0',
    )

    await expect(
      findInternalPlanRehearsalLeaks(directory, {
        allowProvisionalPlanDogfood: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        forbiddenText: 'closed-beta-provisional-methodology@0.1.0',
      }),
    ])
  })

  it('rejects a build that combines both private boundaries', async () => {
    const directory = await createBuild('ordinary build')

    await expect(
      findInternalPlanRehearsalLeaks(directory, {
        allowProvisionalPlanDogfood: true,
        allowClosedBetaProvisionalMethodology: true,
      }),
    ).rejects.toThrow('cannot allow both')
  })
})
