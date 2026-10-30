import { describe, expect, it } from 'vitest'

import {
  assertRuntimeFirestoreRole,
  assertServicePrerequisites,
  assertTransportResponse,
  parsePostdeployArguments,
} from './verify-material-command-postdeploy.mjs'

const runtimeServiceAccount = 'runtime-service-account@example.invalid'

describe('material-command post-deploy verification', () => {
  it('pins development and beta to fixed projects and committed receipt statuses', () => {
    expect(
      parsePostdeployArguments([
        'development',
        '--receipt-status',
        'plan_approved',
      ]),
    ).toEqual({
      environmentName: 'development',
      projectId: 'marathoner-d9bf9',
      receiptStatus: 'plan_approved',
      expectedReceiptStatuses: [
        'plan_approved',
        'run_completed',
        'run_updated',
        'run_deleted',
      ],
    })
    expect(() =>
      parsePostdeployArguments(['production', '--receipt-status', 'committed']),
    ).toThrow('Choose exactly one post-deploy environment')
    expect(() => parsePostdeployArguments(['beta'])).toThrow(
      'Confirm one real authenticated Firestore receipt',
    )
  })

  it('requires the scoped Domain Restricted Sharing transport annotation', () => {
    expect(
      assertServicePrerequisites({
        metadata: {
          annotations: { 'run.googleapis.com/invoker-iam-disabled': 'true' },
        },
        spec: { template: { spec: { serviceAccountName: runtimeServiceAccount } } },
      }),
    ).toBe(runtimeServiceAccount)
    expect(() =>
      assertServicePrerequisites({
        metadata: { annotations: {} },
        spec: { template: { spec: { serviceAccountName: runtimeServiceAccount } } },
      }),
    ).toThrow('Domain Restricted Sharing recovery')
  })

  it('requires runtime Firestore access and a typed authentication boundary', () => {
    expect(() =>
      assertRuntimeFirestoreRole(
        {
          bindings: [
            {
              role: 'roles/datastore.user',
              members: [`serviceAccount:${runtimeServiceAccount}`],
            },
          ],
        },
        runtimeServiceAccount,
      ),
    ).not.toThrow()
    expect(() =>
      assertRuntimeFirestoreRole({ bindings: [] }, runtimeServiceAccount),
    ).toThrow('missing roles/datastore.user')

    expect(() =>
      assertTransportResponse({
        result: {
          status: 'authentication_error',
          code: 'authentication-required',
        },
      }),
    ).not.toThrow()
    expect(() => assertTransportResponse({ result: {} })).toThrow(
      'did not reach the Marathoner authentication boundary',
    )
  })
})
