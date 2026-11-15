import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore'

import { parseActiveAccountDeletionRequest } from './accountDeletionManifest.js'
import type { AccountDeletionPrivateRecordGateway } from './accountDeletionRunner.js'
import { FirestoreGarminOAuthStore } from './firestoreGarminOAuthStore.js'
import {
  GarminRevocationFailure,
  type GarminOAuthEnvironment,
  type GarminOAuthProvider,
} from './garminOAuthHandler.js'

const providerAccountDigestPattern = /^[A-Za-z0-9_-]{43}$/u

function requestPath(requestId: string): string {
  return `accountDeletionRequests/${requestId}`
}

function connectionPath(userId: string): string {
  return `users/${userId}/providerConnections/garmin`
}

function connectionEnvironment(
  data: DocumentData | undefined,
  userId: string,
): GarminOAuthEnvironment | null {
  if (data === undefined) return null
  if (
    data.schemaVersion !== 1 ||
    data.provider !== 'garmin_connect' ||
    data.ownerId !== userId ||
    (data.environment !== 'beta' && data.environment !== 'development')
  ) {
    throw new Error('The stored Garmin connection is invalid.')
  }
  return data.environment
}

function connectionDigest(data: DocumentData | undefined): string | null {
  if (data === undefined) return null
  if (
    typeof data.providerAccountDigest !== 'string' ||
    !providerAccountDigestPattern.test(data.providerAccountDigest)
  ) {
    throw new Error('The stored Garmin account digest is invalid.')
  }
  return data.providerAccountDigest
}

async function deleteReferences(
  references: readonly DocumentReference[],
): Promise<void> {
  const unique = new Map(
    references.map((reference) => [reference.path, reference]),
  )
  await Promise.all([...unique.values()].map((reference) => reference.delete()))
}

export class FirestoreGarminAccountDeletionGateway
  implements AccountDeletionPrivateRecordGateway
{
  private readonly oauthStore: FirestoreGarminOAuthStore

  constructor(
    private readonly database: Firestore,
    private readonly provider: Pick<GarminOAuthProvider, 'revoke'>,
  ) {
    this.oauthStore = new FirestoreGarminOAuthStore(database)
  }

  private async persistDigests(options: {
    requestId: string
    userId: string
    digests: readonly string[]
  }): Promise<string[]> {
    const reference = this.database.doc(requestPath(options.requestId))
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const request = parseActiveAccountDeletionRequest(
        snapshot.data(),
        options.requestId,
      )
      if (request.userId !== options.userId) {
        throw new Error('The protected deletion owner changed unexpectedly.')
      }
      const digests = [
        ...new Set([
          ...(request.garminProviderAccountDigests ?? []),
          ...options.digests,
        ]),
      ].sort()
      if (digests.some((digest) => !providerAccountDigestPattern.test(digest))) {
        throw new Error('A Garmin account digest is invalid.')
      }
      transaction.update(reference, { garminProviderAccountDigests: digests })
      return digests
    })
  }

  private async readPersistedDigests(options: {
    requestId: string
    userId: string
  }): Promise<string[]> {
    const snapshot = await this.database.doc(requestPath(options.requestId)).get()
    const request = parseActiveAccountDeletionRequest(
      snapshot.data(),
      options.requestId,
    )
    if (request.userId !== options.userId) {
      throw new Error('The protected deletion owner changed unexpectedly.')
    }
    return request.garminProviderAccountDigests ?? []
  }

  private async discoverDigests(options: {
    requestId: string
    userId: string
  }): Promise<{
    connectionData: DocumentData | undefined
    digests: string[]
  }> {
    const [connection, links, persisted] = await Promise.all([
      this.database.doc(connectionPath(options.userId)).get(),
      this.database
        .collection('providerAccountLinks')
        .where('ownerId', '==', options.userId)
        .get(),
      this.readPersistedDigests(options),
    ])
    const connectionData = connection.data()
    const digest = connectionDigest(connectionData)
    return {
      connectionData,
      digests: [
        ...new Set([
          ...persisted,
          ...links.docs.map(({ id }) => id),
          ...(digest === null ? [] : [digest]),
        ]),
      ],
    }
  }

  private async revokeConnection(options: {
    connectionData: DocumentData | undefined
    userId: string
  }): Promise<GarminOAuthEnvironment | null> {
    const environment = connectionEnvironment(
      options.connectionData,
      options.userId,
    )
    if (environment === null) return null
    const reservation = await this.oauthStore.reserveDisconnect({
      environment,
      ownerId: options.userId,
    })
    if (reservation.kind === 'disconnected') return environment
    if (reservation.kind !== 'reserved') {
      throw new Error('The Garmin disconnect is already being processed.')
    }
    for (const grant of reservation.grants) {
      try {
        await this.provider.revoke(grant)
      } catch (error) {
        if (
          error instanceof GarminRevocationFailure &&
          error.retryGrant !== null
        ) {
          await this.oauthStore.replaceDisconnectGrant({
            environment,
            ownerId: options.userId,
            previousGrant: grant,
            replacementGrant: error.retryGrant,
          })
        }
        throw error
      }
    }
    return environment
  }

  private async deleteGlobalRecords(options: {
    digests: readonly string[]
    userId: string
  }): Promise<void> {
    const [states, links, deliveries] = await Promise.all([
      this.database
        .collection('providerOAuthStates')
        .where('ownerId', '==', options.userId)
        .get(),
      this.database
        .collection('providerAccountLinks')
        .where('ownerId', '==', options.userId)
        .get(),
      Promise.all(
        options.digests.map((digest) =>
          this.database
            .collection('garminPushDeliveries')
            .where('providerAccountDigest', '==', digest)
            .get(),
        ),
      ),
    ])
    await deleteReferences([
      ...states.docs.map(({ ref }) => ref),
      ...deliveries.flatMap(({ docs }) => docs.map(({ ref }) => ref)),
    ])
    await deleteReferences([
      ...links.docs.map(({ ref }) => ref),
      ...options.digests.map((digest) =>
        this.database.doc(`providerAccountLinks/${digest}`),
      ),
    ])
  }

  private async verifyAbsent(options: {
    digests: readonly string[]
    userId: string
  }): Promise<void> {
    const [connection, states, links, deliveries, directLinks] =
      await Promise.all([
        this.database.doc(connectionPath(options.userId)).get(),
        this.database
          .collection('providerOAuthStates')
          .where('ownerId', '==', options.userId)
          .get(),
        this.database
          .collection('providerAccountLinks')
          .where('ownerId', '==', options.userId)
          .get(),
        Promise.all(
          options.digests.map((digest) =>
            this.database
              .collection('garminPushDeliveries')
              .where('providerAccountDigest', '==', digest)
              .get(),
          ),
        ),
        Promise.all(
          options.digests.map((digest) =>
            this.database.doc(`providerAccountLinks/${digest}`).get(),
          ),
        ),
      ])
    if (
      connection.exists ||
      !states.empty ||
      !links.empty ||
      deliveries.some((snapshot) => !snapshot.empty) ||
      directLinks.some((snapshot) => snapshot.exists)
    ) {
      throw new Error('Garmin participant records remain after deletion.')
    }
  }

  async deleteDeclaredRecords(options: {
    requestId: string
    userId: string
  }): Promise<void> {
    const discovered = await this.discoverDigests(options)
    const digests = await this.persistDigests({
      ...options,
      digests: discovered.digests,
    })
    const environment = await this.revokeConnection({
      connectionData: discovered.connectionData,
      userId: options.userId,
    })
    await this.deleteGlobalRecords({ digests, userId: options.userId })
    if (environment !== null) {
      await this.oauthStore.completeDisconnect({
        environment,
        ownerId: options.userId,
      })
    } else {
      await this.database.doc(connectionPath(options.userId)).delete()
    }
    await this.verifyAbsent({ digests, userId: options.userId })
  }

  async verifyDeclaredRecordsAbsent(options: {
    requestId: string
    userId: string
  }): Promise<void> {
    const digests = await this.readPersistedDigests(options)
    await this.verifyAbsent({ digests, userId: options.userId })
  }
}
