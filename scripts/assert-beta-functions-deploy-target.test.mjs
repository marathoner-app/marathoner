import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertBetaFunctionsDeployTarget,
  BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
  BETA_FUNCTIONS_PROJECT_ID,
} from './assert-beta-functions-deploy-target.mjs'

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.join(process.cwd(), relativePath), 'utf8'),
  )
}

const guardScriptPath = path.join(
  process.cwd(),
  'scripts/assert-beta-functions-deploy-target.mjs',
)

function runGuardScript({
  actualProjectId,
  environmentName,
  operatorConfirmation,
}) {
  const environment = { ...process.env }
  delete environment.GCLOUD_PROJECT
  delete environment.MARATHONER_BETA_FUNCTIONS_DEPLOY_CONFIRMATION

  if (actualProjectId !== undefined) {
    environment.GCLOUD_PROJECT = actualProjectId
  }
  if (operatorConfirmation !== undefined) {
    environment.MARATHONER_BETA_FUNCTIONS_DEPLOY_CONFIRMATION =
      operatorConfirmation
  }

  return spawnSync(process.execPath, [guardScriptPath, environmentName], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment,
  })
}

describe('beta Functions deployment guard', () => {
  it('accepts only the exact beta project with explicit operator intent', () => {
    expect(() =>
      assertBetaFunctionsDeployTarget({
        actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
        environmentName: 'beta',
        operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      }),
    ).not.toThrow()
  })

  it('rejects the default development configuration even with beta intent', () => {
    expect(() =>
      assertBetaFunctionsDeployTarget({
        actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
        environmentName: 'development',
        operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      }),
    ).toThrow('blocked outside firebase.beta.json')
  })

  it('rejects missing, development, and unknown projects', () => {
    expect(() =>
      assertBetaFunctionsDeployTarget({
        actualProjectId: undefined,
        environmentName: 'beta',
        operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      }),
    ).toThrow('GCLOUD_PROJECT is missing')

    for (const actualProjectId of [
      'marathoner-d9bf9',
      'unknown-marathoner-project',
    ]) {
      expect(() =>
        assertBetaFunctionsDeployTarget({
          actualProjectId,
          environmentName: 'beta',
          operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
        }),
      ).toThrow(`expected "${BETA_FUNCTIONS_PROJECT_ID}"`)
    }
  })

  it('rejects missing or incorrect operator intent', () => {
    for (const operatorConfirmation of [undefined, '', 'DEPLOY-BETA-FUNCTIONS']) {
      expect(() =>
        assertBetaFunctionsDeployTarget({
          actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
          environmentName: 'beta',
          operatorConfirmation,
        }),
      ).toThrow('only after issues #143 and #204 are complete')
    }
  })
})

describe('beta Functions predeploy entry point', () => {
  it('exits successfully only for the configured beta invocation', () => {
    const result = runGuardScript({
      actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
      environmentName: 'beta',
      operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain(
      `Verified explicit beta Functions deployment intent for ${BETA_FUNCTIONS_PROJECT_ID}.`,
    )
  })

  it.each([
    {
      label: 'missing project',
      actualProjectId: undefined,
      environmentName: 'beta',
      operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'GCLOUD_PROJECT is missing',
    },
    {
      label: 'wrong project',
      actualProjectId: 'marathoner-d9bf9',
      environmentName: 'beta',
      operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: `expected "${BETA_FUNCTIONS_PROJECT_ID}"`,
    },
    {
      label: 'wrong environment',
      actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
      environmentName: 'development',
      operatorConfirmation: BETA_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'blocked outside firebase.beta.json',
    },
    {
      label: 'missing operator intent',
      actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
      environmentName: 'beta',
      operatorConfirmation: undefined,
      expectedError: 'only after issues #143 and #204 are complete',
    },
    {
      label: 'wrong operator intent',
      actualProjectId: BETA_FUNCTIONS_PROJECT_ID,
      environmentName: 'beta',
      operatorConfirmation: 'DEPLOY-BETA-FUNCTIONS',
      expectedError: 'only after issues #143 and #204 are complete',
    },
  ])('exits nonzero for $label', (scenario) => {
    const result = runGuardScript(scenario)

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(scenario.expectedError)
  })
})

describe('Firebase Functions deployment configuration', () => {
  it('adds the reviewed codebase only to the guarded beta configuration', async () => {
    const betaConfig = await readJson('firebase.beta.json')
    const developmentConfig = await readJson('firebase.json')

    expect(betaConfig.functions).toEqual([
      {
        source: 'functions',
        codebase: 'material-commands',
        runtime: 'nodejs22',
        predeploy: [
          'node scripts/assert-beta-functions-deploy-target.mjs beta',
          'npm run build:functions',
        ],
      },
    ])

    expect(developmentConfig.functions).toEqual([
      {
        source: 'functions',
        codebase: 'material-commands',
        runtime: 'nodejs22',
        predeploy: [
          'node scripts/assert-beta-functions-deploy-target.mjs development',
          'npm run build:functions',
        ],
      },
    ])
  })

  it('preserves the distinct Firestore deployment guards', async () => {
    const betaConfig = await readJson('firebase.beta.json')
    const developmentConfig = await readJson('firebase.json')

    expect(betaConfig.firestore.predeploy).toEqual([
      'node scripts/assert-firestore-deploy-target.mjs beta',
    ])
    expect(developmentConfig.firestore.predeploy).toEqual([
      'node scripts/assert-firestore-deploy-target.mjs development',
    ])
  })

  it('keeps the reviewed project aliases aligned with the hard-coded guard', async () => {
    const firebaseAliases = await readJson('.firebaserc')

    expect(firebaseAliases.projects).toEqual({
      development: 'marathoner-d9bf9',
      beta: BETA_FUNCTIONS_PROJECT_ID,
    })
  })
})
