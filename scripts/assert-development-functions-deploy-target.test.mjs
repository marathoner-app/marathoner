import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertDevelopmentFunctionsDeployTarget,
  DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
  DEVELOPMENT_FUNCTIONS_PROJECT_ID,
} from './assert-development-functions-deploy-target.mjs'

const guardScriptPath = path.join(
  process.cwd(),
  'scripts/assert-development-functions-deploy-target.mjs',
)

function runGuardScript({
  actualProjectId,
  environmentName,
  operatorConfirmation,
}) {
  const environment = { ...process.env }
  delete environment.GCLOUD_PROJECT
  delete environment.MARATHONER_DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION

  if (actualProjectId !== undefined) {
    environment.GCLOUD_PROJECT = actualProjectId
  }
  if (operatorConfirmation !== undefined) {
    environment.MARATHONER_DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION =
      operatorConfirmation
  }

  return spawnSync(process.execPath, [guardScriptPath, environmentName], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment,
  })
}

describe('development Functions deployment guard', () => {
  it('accepts only the exact development project with explicit owner intent', () => {
    expect(() =>
      assertDevelopmentFunctionsDeployTarget({
        actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
        environmentName: 'development',
        operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      }),
    ).not.toThrow()
  })

  it.each([
    {
      label: 'missing project',
      actualProjectId: undefined,
      environmentName: 'development',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'GCLOUD_PROJECT is missing',
    },
    {
      label: 'beta project',
      actualProjectId: 'marathonerapp-beta',
      environmentName: 'development',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: `expected "${DEVELOPMENT_FUNCTIONS_PROJECT_ID}"`,
    },
    {
      label: 'wrong environment',
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'beta',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'blocked outside firebase.json',
    },
    {
      label: 'missing owner intent',
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'development',
      operatorConfirmation: undefined,
      expectedError: 'only after the owner approves',
    },
    {
      label: 'wrong owner intent',
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'development',
      operatorConfirmation: 'DEPLOY-DEVELOPMENT-FUNCTIONS',
      expectedError: 'only after the owner approves',
    },
  ])('rejects $label', (scenario) => {
    expect(() =>
      assertDevelopmentFunctionsDeployTarget({
        actualProjectId: scenario.actualProjectId,
        environmentName: scenario.environmentName,
        operatorConfirmation: scenario.operatorConfirmation,
      }),
    ).toThrow(scenario.expectedError)
  })
})

describe('development Functions predeploy entry point', () => {
  it('exits successfully only for the configured development invocation', () => {
    const result = runGuardScript({
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'development',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain(
      `Verified explicit development Functions deployment intent for ${DEVELOPMENT_FUNCTIONS_PROJECT_ID}.`,
    )
  })

  it.each([
    {
      label: 'missing project',
      actualProjectId: undefined,
      environmentName: 'development',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'GCLOUD_PROJECT is missing',
    },
    {
      label: 'wrong project',
      actualProjectId: 'marathonerapp-beta',
      environmentName: 'development',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: `expected "${DEVELOPMENT_FUNCTIONS_PROJECT_ID}"`,
    },
    {
      label: 'wrong environment',
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'beta',
      operatorConfirmation: DEVELOPMENT_FUNCTIONS_DEPLOY_CONFIRMATION,
      expectedError: 'blocked outside firebase.json',
    },
    {
      label: 'missing owner intent',
      actualProjectId: DEVELOPMENT_FUNCTIONS_PROJECT_ID,
      environmentName: 'development',
      operatorConfirmation: undefined,
      expectedError: 'only after the owner approves',
    },
  ])('exits nonzero for $label', (scenario) => {
    const result = runGuardScript(scenario)

    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(scenario.expectedError)
  })
})
