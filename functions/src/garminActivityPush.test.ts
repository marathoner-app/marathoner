import { describe, expect, it, vi } from 'vitest'

import type { MaterialCommandResult } from '../../src/domain/materialCommands/contract.js'
import {
  garminProviderAccountDigest,
  garminPushClientIp,
  isTrustedGarminPushIp,
  processGarminPushDelivery,
  receiveGarminActivityPush,
  type GarminPushDelivery,
  type GarminPushStore,
} from './garminActivityPush.js'

const now = new Date('2026-11-04T20:00:00.000Z')
const runningPush = {
  activities: [
    {
      userId: 'synthetic-provider-user',
      summaryId: 'synthetic-summary-001',
      activityType: 'RUNNING',
      startTimeInSeconds: 1_793_822_400,
      startTimeOffsetInSeconds: -28_800,
      durationInSeconds: 3_600,
      distanceInMeters: 10_000.4,
      deviceName: 'Synthetic watch',
    },
  ],
}

function request(body: unknown = runningPush) {
  return {
    body,
    bodyBytes: JSON.stringify(body).length,
    clientId: 'synthetic-client-id',
    clientIp: '203.0.113.42',
    contentType: 'application/json; charset=utf-8',
    method: 'POST',
  }
}

function receiveDependencies() {
  const enqueue = vi.fn(async (deliveries: readonly GarminPushDelivery[]) =>
    deliveries.length,
  )
  return {
    dependencies: {
      clientId: 'synthetic-client-id',
      enabled: true,
      log: vi.fn(),
      now: () => now,
      store: { enqueue },
      trustedCidrs: ['203.0.113.0/24'],
    },
    enqueue,
  }
}

function importedResult(commandId: string): MaterialCommandResult {
  return {
    status: 'activity_imported',
    commandId,
    canonicalCommandId: commandId,
    operation: 'created',
    completedRunId: null,
    completedRunUpdatedAt: null,
    processedAt: '2026-11-04T20:00:01.000Z',
  } as MaterialCommandResult
}

describe('Garmin Activity push receipt', () => {
  it('authenticates the provider boundary before queueing anything', async () => {
    const { dependencies, enqueue } = receiveDependencies()

    await expect(
      receiveGarminActivityPush(
        { ...request(), clientId: 'wrong-client' },
        dependencies,
      ),
    ).resolves.toEqual({ httpStatus: 401, status: 'rejected' })
    await expect(
      receiveGarminActivityPush(
        { ...request(), clientIp: '198.51.100.10' },
        dependencies,
      ),
    ).resolves.toEqual({ httpStatus: 401, status: 'rejected' })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('queues one minimal running summary and strips raw provider identity', async () => {
    const { dependencies, enqueue } = receiveDependencies()

    await expect(
      receiveGarminActivityPush(request(), dependencies),
    ).resolves.toEqual({ httpStatus: 200, status: 'accepted' })
    expect(enqueue).toHaveBeenCalledTimes(1)
    const [delivery] = enqueue.mock.calls[0]?.[0] ?? []
    expect(delivery).toEqual({
      schemaVersion: 1,
      kind: 'activity',
      deliveryId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      providerAccountDigest: garminProviderAccountDigest(
        'synthetic-provider-user',
      ),
      providerActivityId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      observedAt: now.toISOString(),
      startedAt: '2026-11-04T20:00:00.000Z',
      durationSeconds: 3_600,
      distanceMeters: 10_000,
    })
    expect(JSON.stringify(delivery)).not.toContain('synthetic-provider-user')
    expect(JSON.stringify(delivery)).not.toContain('synthetic-summary-001')
    expect(delivery).not.toHaveProperty('deviceName')
    expect(delivery).not.toHaveProperty('startTimeOffsetInSeconds')
  })

  it('ignores unsupported activities and rejects malformed supported summaries', async () => {
    const { dependencies, enqueue } = receiveDependencies()
    await expect(
      receiveGarminActivityPush(
        request({
          activities: [
            { ...runningPush.activities[0], activityType: 'CYCLING' },
          ],
        }),
        dependencies,
      ),
    ).resolves.toEqual({ httpStatus: 200, status: 'ignored' })
    await expect(
      receiveGarminActivityPush(
        request({
          activities: [
            { ...runningPush.activities[0], distanceInMeters: null },
          ],
        }),
        dependencies,
      ),
    ).resolves.toEqual({ httpStatus: 400, status: 'rejected' })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('creates a stable delivery identity across provider retries', async () => {
    const first = receiveDependencies()
    const second = receiveDependencies()
    await receiveGarminActivityPush(request(), first.dependencies)
    await receiveGarminActivityPush(request(), second.dependencies)

    expect(first.enqueue.mock.calls[0]?.[0][0]?.deliveryId).toBe(
      second.enqueue.mock.calls[0]?.[0][0]?.deliveryId,
    )
  })

  it('accepts deregistration without retaining the raw provider user ID', async () => {
    const { dependencies, enqueue } = receiveDependencies()
    await expect(
      receiveGarminActivityPush(
        request({ deregistrations: [{ userId: 'synthetic-provider-user' }] }),
        dependencies,
      ),
    ).resolves.toEqual({ httpStatus: 200, status: 'accepted' })
    const [delivery] = enqueue.mock.calls[0]?.[0] ?? []
    expect(delivery?.kind).toBe('deregistration')
    expect(JSON.stringify(delivery)).not.toContain('synthetic-provider-user')
  })
})

describe('Garmin Activity push processing', () => {
  function processor(options: {
    owner: { ownerId: string; timeZone: string } | null
    result?: MaterialCommandResult
  }) {
    const markProcessed = vi.fn(async () => undefined)
    const completeDeregistration = vi.fn(async () => undefined)
    const resolveOwner = vi.fn(async () => options.owner)
    const submitImport = vi.fn(async (_ownerId, command) =>
      options.result ?? importedResult(command.commandId),
    )
    return {
      dependencies: {
        environment: 'beta' as const,
        log: vi.fn(),
        now: () => new Date('2026-11-04T20:00:01.000Z'),
        store: {
          resolveOwner,
          completeDeregistration,
          markProcessed,
        } satisfies Omit<GarminPushStore, 'enqueue'>,
        submitImport,
      },
      completeDeregistration,
      markProcessed,
      resolveOwner,
      submitImport,
    }
  }

  const activityDelivery: GarminPushDelivery = {
    schemaVersion: 1,
    kind: 'activity',
    deliveryId: 'delivery-001',
    providerAccountDigest: 'account-digest',
    providerActivityId: 'activity-digest',
    observedAt: '2026-11-04T20:00:00.000Z',
    startedAt: '2026-11-04T16:00:00.000Z',
    durationSeconds: 3_600,
    distanceMeters: 10_000,
  }

  it('resolves exactly one connected owner before submitting run.import-activity', async () => {
    const boundary = processor({
      owner: { ownerId: 'runner-one', timeZone: 'America/Los_Angeles' },
    })

    await processGarminPushDelivery(activityDelivery, boundary.dependencies)

    expect(boundary.submitImport).toHaveBeenCalledWith(
      'runner-one',
      expect.objectContaining({
        commandId: 'garmin-push-delivery-001',
        command: expect.objectContaining({
          type: 'run.import-activity',
          event: expect.objectContaining({
            provider: 'garmin_connect',
            providerActivityId: 'activity-digest',
            reportedOrigin: 'garmin',
            timeZone: 'America/Los_Angeles',
          }),
        }),
      }),
    )
    expect(boundary.markProcessed).toHaveBeenCalledWith({
      deliveryId: 'delivery-001',
      outcome: 'imported',
      processedAt: '2026-11-04T20:00:01.000Z',
    })
  })

  it('makes no training change when the provider account is unknown', async () => {
    const boundary = processor({ owner: null })
    await processGarminPushDelivery(activityDelivery, boundary.dependencies)
    expect(boundary.submitImport).not.toHaveBeenCalled()
    expect(boundary.markProcessed).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'ignored' }),
    )
  })

  it('removes server custody when Garmin reports deregistration', async () => {
    const boundary = processor({ owner: null })
    await processGarminPushDelivery(
      {
        schemaVersion: 1,
        kind: 'deregistration',
        deliveryId: 'deregistration-001',
        providerAccountDigest: 'account-digest',
        observedAt: now.toISOString(),
      },
      boundary.dependencies,
    )
    expect(boundary.completeDeregistration).toHaveBeenCalledWith({
      environment: 'beta',
      providerAccountDigest: 'account-digest',
    })
    expect(boundary.submitImport).not.toHaveBeenCalled()
  })
})

describe('Garmin callback network validation', () => {
  it('recognizes only the approved source ranges and Cloud Run client position', () => {
    expect(isTrustedGarminPushIp('203.0.113.1', ['203.0.113.0/24'])).toBe(true)
    expect(
      isTrustedGarminPushIp('::ffff:203.0.113.10', ['203.0.113.0/24']),
    ).toBe(true)
    expect(isTrustedGarminPushIp('198.51.100.10', ['203.0.113.0/24'])).toBe(
      false,
    )
    expect(
      garminPushClientIp({
        directIp: '10.0.0.1',
        forwardedFor: 'spoofed.invalid, 203.0.113.42, 169.254.1.1',
      }),
    ).toBe('203.0.113.42')
  })
})
