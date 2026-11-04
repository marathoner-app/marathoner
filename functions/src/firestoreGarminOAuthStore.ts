import type { DocumentData, Firestore } from 'firebase-admin/firestore'

import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'
import type {
  GarminCallbackReservation,
  GarminConnectionStatus,
  GarminDisconnectReservation,
  GarminOAuthEnvironment,
  GarminOAuthStore,
  GarminTokenGrant,
} from './garminOAuthHandler.js'

const stateSchemaVersion = 1
const connectionSchemaVersion = 1

function statePath(stateDigest: string): string {
  return `providerOAuthStates/${stateDigest}`
}

function connectionPath(ownerId: string): string {
  return `users/${ownerId}/providerConnections/garmin`
}

function storedGrant(data: DocumentData): GarminTokenGrant {
  if (
    typeof data.accessToken !== 'string' ||
    (data.refreshToken !== null && typeof data.refreshToken !== 'string') ||
    (data.expiresAt !== null && typeof data.expiresAt !== 'string')
  ) {
    throw new Error('The stored provider grant is invalid.')
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
  }
}

function storedPendingRevocationGrants(data: DocumentData): GarminTokenGrant[] {
  if (!Array.isArray(data.pendingRevocationGrants)) return []
  return data.pendingRevocationGrants.map((grant) =>
    storedGrant(grant as DocumentData),
  )
}

function isEnvironment(
  data: DocumentData | undefined,
  environment: GarminOAuthEnvironment,
): data is DocumentData {
  return data?.schemaVersion === stateSchemaVersion && data.environment === environment
}

export class FirestoreGarminOAuthStore implements GarminOAuthStore {
  constructor(private readonly database: Firestore) {}

  async createAuthorization(options: {
    createdAt: string
    environment: GarminOAuthEnvironment
    expiresAt: string
    ownerId: string
    stateDigest: string
    codeVerifier: string
  }): Promise<'created' | 'membership-required'> {
    const stateReference = this.database.doc(statePath(options.stateDigest))
    const membershipReference = this.database.doc(
      approvedBetaMembershipPath(options.ownerId),
    )
    return this.database.runTransaction(async (transaction) => {
      const membership = await transaction.get(membershipReference)
      if (!isApprovedBetaMembership(membership.data(), options.ownerId)) {
        return 'membership-required'
      }
      transaction.create(stateReference, {
        schemaVersion: stateSchemaVersion,
        provider: 'garmin_connect',
        status: 'pending',
        ownerId: options.ownerId,
        environment: options.environment,
        codeVerifier: options.codeVerifier,
        createdAt: options.createdAt,
        expiresAt: options.expiresAt,
      })
      return 'created'
    })
  }

  async reserveCallback(options: {
    codeDigest: string
    environment: GarminOAuthEnvironment
    now: string
    stateDigest: string
  }): Promise<GarminCallbackReservation> {
    const reference = this.database.doc(statePath(options.stateDigest))
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.data()
      if (
        !isEnvironment(data, options.environment) ||
        typeof data.expiresAt !== 'string'
      ) {
        return { kind: 'invalid' }
      }
      if (data.status === 'completed') {
        return data.codeDigest === options.codeDigest
          ? { kind: 'completed' }
          : { kind: 'invalid' }
      }
      if (
        typeof data.ownerId !== 'string' ||
        typeof data.codeVerifier !== 'string' ||
        data.expiresAt <= options.now
      ) {
        return { kind: 'invalid' }
      }
      if (data.status === 'processing') {
        return data.codeDigest === options.codeDigest
          ? { kind: 'processing' }
          : { kind: 'invalid' }
      }
      if (data.status !== 'pending') return { kind: 'invalid' }
      transaction.update(reference, {
        status: 'processing',
        codeDigest: options.codeDigest,
        processingAt: options.now,
      })
      return {
        kind: 'reserved',
        ownerId: data.ownerId,
        codeVerifier: data.codeVerifier,
      }
    })
  }

  async completeCallback(options: {
    connectedAt: string
    environment: GarminOAuthEnvironment
    grant: GarminTokenGrant
    ownerId: string
    stateDigest: string
  }): Promise<readonly GarminTokenGrant[]> {
    const stateReference = this.database.doc(statePath(options.stateDigest))
    const connectionReference = this.database.doc(
      connectionPath(options.ownerId),
    )
    const membershipReference = this.database.doc(
      approvedBetaMembershipPath(options.ownerId),
    )
    return this.database.runTransaction(async (transaction) => {
      const [state, connection, membership] = await Promise.all([
        transaction.get(stateReference),
        transaction.get(connectionReference),
        transaction.get(membershipReference),
      ])
      const stateData = state.data()
      if (
        !isEnvironment(stateData, options.environment) ||
        stateData.ownerId !== options.ownerId ||
        stateData.status !== 'processing'
      ) {
        throw new Error('The provider callback reservation is no longer valid.')
      }
      if (!isApprovedBetaMembership(membership.data(), options.ownerId)) {
        throw new Error('Approved beta membership is no longer active.')
      }
      const prior = connection.data()
      if (
        prior !== undefined &&
        (prior.schemaVersion !== connectionSchemaVersion ||
          prior.environment !== options.environment)
      ) {
        throw new Error('A provider grant from another environment exists.')
      }
      const sameEnvironmentConnection =
        prior?.schemaVersion === connectionSchemaVersion &&
        prior.environment === options.environment
      const pendingRevocationGrants = sameEnvironmentConnection
        ? storedPendingRevocationGrants(prior)
        : []
      const priorGrant =
        sameEnvironmentConnection &&
        (prior.status === 'connected' || prior.status === 'disconnecting')
          ? storedGrant(prior)
          : null
      const grantsToRevoke = priorGrant
        ? [...pendingRevocationGrants, priorGrant]
        : pendingRevocationGrants
      transaction.set(connectionReference, {
        schemaVersion: connectionSchemaVersion,
        provider: 'garmin_connect',
        status: 'connected',
        environment: options.environment,
        ownerId: options.ownerId,
        accessToken: options.grant.accessToken,
        refreshToken: options.grant.refreshToken,
        expiresAt: options.grant.expiresAt,
        connectedAt: options.connectedAt,
        updatedAt: options.connectedAt,
        pendingRevocationGrants: grantsToRevoke,
      })
      transaction.update(stateReference, {
        status: 'completed',
        completedAt: options.connectedAt,
        ownerId: null,
        codeVerifier: null,
      })
      return grantsToRevoke
    })
  }

  async completePriorGrantRevocations(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
    revokedGrants: readonly GarminTokenGrant[]
  }): Promise<void> {
    const reference = this.database.doc(connectionPath(options.ownerId))
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.data()
      if (
        data?.schemaVersion === connectionSchemaVersion &&
        data.environment === options.environment
      ) {
        const revoked = new Set(
          options.revokedGrants.map(
            (grant) => `${grant.accessToken}\u0000${grant.refreshToken ?? ''}`,
          ),
        )
        const remaining = storedPendingRevocationGrants(data).filter(
          (grant) =>
            !revoked.has(
              `${grant.accessToken}\u0000${grant.refreshToken ?? ''}`,
            ),
        )
        transaction.update(reference, { pendingRevocationGrants: remaining })
      }
    })
  }

  async failCallback(options: {
    failedAt: string
    stateDigest: string
  }): Promise<void> {
    await this.database.doc(statePath(options.stateDigest)).update({
      status: 'failed',
      failedAt: options.failedAt,
      ownerId: null,
      codeVerifier: null,
      codeDigest: null,
    })
  }

  async readStatus(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminConnectionStatus> {
    const snapshot = await this.database.doc(connectionPath(options.ownerId)).get()
    const data = snapshot.data()
    if (
      data?.schemaVersion !== connectionSchemaVersion ||
      data.environment !== options.environment
    ) {
      return { status: 'disconnected', connectedAt: null }
    }
    if (data.status === 'disconnecting') {
      return {
        status: 'disconnecting',
        connectedAt: typeof data.connectedAt === 'string' ? data.connectedAt : null,
      }
    }
    if (data.status !== 'connected') {
      return { status: 'disconnected', connectedAt: null }
    }
    return {
      status: 'connected',
      connectedAt: typeof data.connectedAt === 'string' ? data.connectedAt : null,
    }
  }

  async reserveDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<GarminDisconnectReservation> {
    const reference = this.database.doc(connectionPath(options.ownerId))
    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.data()
      if (
        data?.schemaVersion !== connectionSchemaVersion ||
        data.environment !== options.environment
      ) {
        return { kind: 'disconnected' }
      }
      if (data.status === 'disconnecting') {
        return {
          kind: 'reserved',
          grants: [
            storedGrant(data),
            ...storedPendingRevocationGrants(data),
          ],
        }
      }
      if (data.status !== 'connected') return { kind: 'disconnected' }
      const grant = storedGrant(data)
      transaction.update(reference, {
        status: 'disconnecting',
        updatedAt: new Date().toISOString(),
      })
      return {
        kind: 'reserved',
        grants: [grant, ...storedPendingRevocationGrants(data)],
      }
    })
  }

  async completeDisconnect(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
  }): Promise<void> {
    const reference = this.database.doc(connectionPath(options.ownerId))
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.data()
      if (
        data?.schemaVersion === connectionSchemaVersion &&
        data.environment === options.environment &&
        data.status === 'disconnecting'
      ) {
        transaction.delete(reference)
      }
    })
  }
}
