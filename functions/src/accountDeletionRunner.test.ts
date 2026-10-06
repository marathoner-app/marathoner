import { describe, expect, it } from 'vitest'

import type {
  ActiveAccountDeletionRequest,
  CompletedAccountDeletionReceipt,
} from './accountDeletionManifest.js'
import {
  ACCOUNT_DELETION_RUNNER_STEPS,
  AccountDeletionRunner,
  AccountDeletionRunnerError,
  type AccountDeletionAuthGateway,
  type AccountDeletionPrivateRecordGateway,
  type AccountDeletionRunnerLogEntry,
  type AccountDeletionRunnerStep,
  type AccountDeletionWorkflowStore,
} from './accountDeletionRunner.js'

const requestId = '11111111-1111-4111-8111-111111111111'
const userId = 'fictional-runner'
const commandId = 'delete-command-unit-fixture'
const completedAt = '2027-01-16T08:00:00.000Z'

function activeRequest(): ActiveAccountDeletionRequest {
  return {
    schemaVersion: 1,
    manifestVersion: 1,
    requestId,
    userId,
    commandId,
    status: 'auth_lock_failed',
    stage: 'membership_locked',
    attemptCount: 1,
    requestedAt: '2027-01-15T08:00:00.000Z',
    completionDueAt: '2027-01-22T08:00:00.000Z',
    updatedAt: '2027-01-15T08:00:00.000Z',
  }
}

class InMemoryWorkflowStore implements AccountDeletionWorkflowStore {
  events: string[] = []
  request = activeRequest()
  receipt: CompletedAccountDeletionReceipt | null = null
  failureCode: string | null = null
  verificationFailure = false

  async beginAttempt() {
    this.events.push('begin')
    if (this.receipt) {
      return { kind: 'completed' as const, receipt: this.receipt }
    }
    this.request.attemptCount += 1
    this.request.status = 'deletion_in_progress'
    return { kind: 'active' as const, request: this.request }
  }

  async checkpoint(options: {
    stage: ActiveAccountDeletionRequest['stage']
    updatedAt: string
  }) {
    this.request.stage = options.stage
    this.request.updatedAt = options.updatedAt
    this.events.push(`checkpoint:${options.stage}`)
  }

  async recordFailure(options: { errorCode: string }) {
    this.failureCode = options.errorCode
    this.request.status = 'deletion_failed'
    this.events.push('failure')
  }

  async deleteUserTree() {
    this.events.push('delete-user-tree')
  }

  async deleteServerRecords() {
    this.events.push('delete-server-records')
  }

  async deleteMembership() {
    this.events.push('delete-membership')
  }

  async verifyManifestEmpty() {
    this.events.push('verify-manifest')
    if (this.verificationFailure) throw new Error('remaining record')
  }

  async anonymize(options: { completedAt: string; expiresAt: string }) {
    this.events.push('anonymize')
    this.receipt = {
      schemaVersion: 1,
      manifestVersion: 1,
      requestId,
      status: 'completed',
      requestedAt: this.request.requestedAt,
      completedAt: options.completedAt,
      expiresAt: options.expiresAt,
    }
    return this.receipt
  }

  async readCompletedReceipt() {
    return this.receipt
  }

  async purgeExpiredReceipt() {
    this.receipt = null
  }
}

class InMemoryAuthGateway implements AccountDeletionAuthGateway {
  constructor(private readonly events: string[]) {}

  async disableAndRevoke() {
    this.events.push('lock-auth')
  }

  async deleteIfExists() {
    this.events.push('delete-auth')
  }
}

class InMemoryPrivateGateway implements AccountDeletionPrivateRecordGateway {
  constructor(private readonly events: string[]) {}

  async deleteDeclaredRecords() {
    this.events.push('delete-private-records')
  }

  async verifyDeclaredRecordsAbsent() {
    this.events.push('verify-private-records')
  }
}

function createFixture(options: {
  afterStep?: (step: AccountDeletionRunnerStep) => Promise<void>
  store?: InMemoryWorkflowStore
} = {}) {
  const store = options.store ?? new InMemoryWorkflowStore()
  const logs: AccountDeletionRunnerLogEntry[] = []
  return {
    logs,
    store,
    runner: new AccountDeletionRunner({
      accountAccess: new InMemoryAuthGateway(store.events),
      privateRecords: new InMemoryPrivateGateway(store.events),
      store,
      now: () => new Date(completedAt),
      log: (entry) => logs.push(entry),
      ...(options.afterStep ? { afterStep: options.afterStep } : {}),
    }),
  }
}

describe('account-deletion runner orchestration', () => {
  it('verifies the complete manifest before deleting Auth and retains no identity', async () => {
    const { logs, runner, store } = createFixture()

    await expect(runner.run(requestId)).resolves.toEqual(
      expect.objectContaining({ status: 'completed', requestId }),
    )

    expect(store.events.indexOf('verify-manifest')).toBeLessThan(
      store.events.indexOf('delete-auth'),
    )
    expect(store.events.indexOf('verify-private-records')).toBeLessThan(
      store.events.indexOf('delete-auth'),
    )
    expect(store.receipt).toEqual({
      schemaVersion: 1,
      manifestVersion: 1,
      requestId,
      status: 'completed',
      requestedAt: '2027-01-15T08:00:00.000Z',
      completedAt,
      expiresAt: '2027-02-15T08:00:00.000Z',
    })
    const output = JSON.stringify({ logs, receipt: store.receipt })
    expect(output).not.toContain(userId)
    expect(output).not.toContain(commandId)
  })

  it.each(ACCOUNT_DELETION_RUNNER_STEPS)(
    'resumes the same request after an interruption following %s',
    async (interruptedStep) => {
      const store = new InMemoryWorkflowStore()
      let shouldInterrupt = true
      const first = createFixture({
        store,
        afterStep: async (step) => {
          if (shouldInterrupt && step === interruptedStep) {
            shouldInterrupt = false
            throw new Error('injected')
          }
        },
      }).runner

      if (interruptedStep === 'completed') {
        await expect(first.run(requestId)).resolves.toEqual(
          expect.objectContaining({ status: 'completed' }),
        )
      } else {
        await expect(first.run(requestId)).rejects.toBeInstanceOf(
          AccountDeletionRunnerError,
        )
        expect(store.failureCode).toBe('operator-interrupted')
      }

      const retry = createFixture({ store }).runner
      await expect(retry.run(requestId)).resolves.toEqual(
        expect.objectContaining({
          status:
            interruptedStep === 'completed'
              ? 'already_completed'
              : 'completed',
        }),
      )
    },
  )

  it('stops before Authentication deletion when verification fails', async () => {
    const store = new InMemoryWorkflowStore()
    store.verificationFailure = true
    const { runner } = createFixture({ store })

    await expect(runner.run(requestId)).rejects.toMatchObject({
      code: 'manifest-verification-failed',
    })
    expect(store.events).not.toContain('delete-auth')
    expect(store.request.stage).toBe('membership_removed')
  })

  it('rejects a path-like request ID before reading or logging it', async () => {
    const { logs, runner, store } = createFixture()

    await expect(runner.run('../users/another-runner')).rejects.toMatchObject({
      code: 'request-invalid',
    })
    expect(store.events).toEqual([])
    expect(logs).toEqual([])
  })
})
