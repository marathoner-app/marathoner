import type { Firestore } from 'firebase-admin/firestore'

import type {
  GarminPushDelivery,
  GarminPushStore,
} from './garminActivityPush.js'
import { FirestoreGarminOAuthStore } from './firestoreGarminOAuthStore.js'

const queueSchemaVersion = 1

function queuePath(deliveryId: string): string {
  return `garminPushDeliveries/${deliveryId}`
}

function queueDocument(delivery: GarminPushDelivery) {
  return {
    ...delivery,
    queueSchemaVersion,
    status: 'pending',
  }
}

export function garminPushDeliveryFromDocument(
  deliveryId: string,
  value: unknown,
): GarminPushDelivery | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const data = value as Record<string, unknown>
  if (
    data.queueSchemaVersion !== queueSchemaVersion ||
    data.schemaVersion !== 1 ||
    data.deliveryId !== deliveryId ||
    typeof data.providerAccountDigest !== 'string' ||
    typeof data.observedAt !== 'string'
  ) {
    return null
  }
  if (data.kind === 'deregistration') {
    return {
      schemaVersion: 1,
      kind: 'deregistration',
      deliveryId,
      providerAccountDigest: data.providerAccountDigest,
      observedAt: data.observedAt,
    }
  }
  if (
    data.kind !== 'activity' ||
    typeof data.providerActivityId !== 'string' ||
    typeof data.startedAt !== 'string' ||
    !Number.isSafeInteger(data.durationSeconds) ||
    Number(data.durationSeconds) <= 0 ||
    !Number.isSafeInteger(data.distanceMeters) ||
    Number(data.distanceMeters) <= 0
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    kind: 'activity',
    deliveryId,
    providerAccountDigest: data.providerAccountDigest,
    providerActivityId: data.providerActivityId,
    observedAt: data.observedAt,
    startedAt: data.startedAt,
    durationSeconds: Number(data.durationSeconds),
    distanceMeters: Number(data.distanceMeters),
  }
}

export class FirestoreGarminActivityPushStore implements GarminPushStore {
  private readonly oauthStore: FirestoreGarminOAuthStore

  constructor(private readonly database: Firestore) {
    this.oauthStore = new FirestoreGarminOAuthStore(database)
  }

  async enqueue(deliveries: readonly GarminPushDelivery[]): Promise<number> {
    const outcomes = await Promise.all(
      deliveries.map((delivery) =>
        this.database.runTransaction(async (transaction) => {
          const reference = this.database.doc(queuePath(delivery.deliveryId))
          const existing = await transaction.get(reference)
          if (existing.exists) return false
          transaction.create(reference, queueDocument(delivery))
          return true
        }),
      ),
    )
    return outcomes.filter(Boolean).length
  }

  resolveOwner(options: Parameters<GarminPushStore['resolveOwner']>[0]) {
    return this.oauthStore.resolvePushOwner(options)
  }

  completeDeregistration(
    options: Parameters<GarminPushStore['completeDeregistration']>[0],
  ) {
    return this.oauthStore.completeProviderDeregistration(options)
  }

  async markProcessed(
    options: Parameters<GarminPushStore['markProcessed']>[0],
  ): Promise<void> {
    await this.database.doc(queuePath(options.deliveryId)).update({
      status: 'processed',
      outcome: options.outcome,
      processedAt: options.processedAt,
    })
  }
}
