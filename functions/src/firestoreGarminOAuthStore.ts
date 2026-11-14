import { createHash } from 'node:crypto'

import type { DocumentData, Firestore } from 'firebase-admin/firestore'

import {
  approvedBetaMembershipPath,
  isApprovedBetaMembership,
} from './approvedBetaMembership.js'
import type {
  GarminCallbackReservation,
  GarminConnectionGrant,
  GarminConnectionStatus,
  GarminDisconnectReservation,
  GarminOAuthEnvironment,
  GarminOAuthStore,
  GarminTokenGrant,
} from './garminOAuthHandler.js'

const stateSchemaVersion = 1
const connectionSchemaVersion = 1
const providerAccountLinkSchemaVersion = 1

function statePath(stateDigest: string): string {
  return `providerOAuthStates/${stateDigest}`
}

function connectionPath(ownerId: string): string {
  return `users/${ownerId}/providerConnections/garmin`
}

export function garminProviderAccountDigest(providerUserId: string): string {
  return createHash('sha256')
    .update(`garmin-provider-account\u0000${providerUserId}`)
    .digest('base64url')
}

function providerAccountLinkPath(providerAccountDigest: string): string {
  return `providerAccountLinks/${providerAccountDigest}`
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

function sameGrant(left: GarminTokenGrant, right: GarminTokenGrant): boolean {
  return (
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken
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
    grant: GarminConnectionGrant
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
    const providerAccountDigest = garminProviderAccountDigest(
      options.grant.providerUserId,
    )
    const providerAccountReference = this.database.doc(
      providerAccountLinkPath(providerAccountDigest),
    )
    return this.database.runTransaction(async (transaction) => {
      const [state, connection, membership, providerAccount] = await Promise.all([
        transaction.get(stateReference),
        transaction.get(connectionReference),
        transaction.get(membershipReference),
        transaction.get(providerAccountReference),
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
      const linkedAccount = providerAccount.data()
      if (
        linkedAccount !== undefined &&
        (linkedAccount.schemaVersion !== providerAccountLinkSchemaVersion ||
          linkedAccount.provider !== 'garmin_connect' ||
          linkedAccount.environment !== options.environment ||
          linkedAccount.ownerId !== options.ownerId)
      ) {
        throw new Error('The provider account is already mapped elsewhere.')
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
      const priorProviderAccountDigest =
        sameEnvironmentConnection &&
        typeof prior.providerAccountDigest === 'string'
          ? prior.providerAccountDigest
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
        providerAccountDigest,
        accessToken: options.grant.accessToken,
        refreshToken: options.grant.refreshToken,
        expiresAt: options.grant.expiresAt,
        connectedAt: options.connectedAt,
        updatedAt: options.connectedAt,
        pendingRevocationGrants: grantsToRevoke,
      })
      transaction.set(providerAccountReference, {
        schemaVersion: providerAccountLinkSchemaVersion,
        provider: 'garmin_connect',
        environment: options.environment,
        ownerId: options.ownerId,
        updatedAt: options.connectedAt,
      })
      if (
        priorProviderAccountDigest !== null &&
        priorProviderAccountDigest !== providerAccountDigest
      ) {
        transaction.delete(
          this.database.doc(
            providerAccountLinkPath(priorProviderAccountDigest),
          ),
        )
      }
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

  async replaceDisconnectGrant(options: {
    environment: GarminOAuthEnvironment
    ownerId: string
    previousGrant: GarminTokenGrant
    replacementGrant: GarminTokenGrant
  }): Promise<void> {
    const reference = this.database.doc(connectionPath(options.ownerId))
    await this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.data()
      if (
        data?.schemaVersion !== connectionSchemaVersion ||
        data.environment !== options.environment ||
        data.status !== 'disconnecting'
      ) {
        throw new Error('The disconnect reservation is no longer active.')
      }

      const currentGrant = storedGrant(data)
      if (sameGrant(currentGrant, options.previousGrant)) {
        transaction.update(reference, {
          accessToken: options.replacementGrant.accessToken,
          refreshToken: options.replacementGrant.refreshToken,
          expiresAt: options.replacementGrant.expiresAt,
          updatedAt: new Date().toISOString(),
        })
        return
      }

      let replaced = false
      const pendingRevocationGrants = storedPendingRevocationGrants(data).map(
        (grant) => {
          if (!replaced && sameGrant(grant, options.previousGrant)) {
            replaced = true
            return options.replacementGrant
          }
          return grant
        },
      )
      if (!replaced) {
        if (sameGrant(currentGrant, options.replacementGrant)) return
        throw new Error('The disconnect grant is no longer current.')
      }
      transaction.update(reference, {
        pendingRevocationGrants,
        updatedAt: new Date().toISOString(),
      })
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
        if (typeof data.providerAccountDigest === 'string') {
          transaction.delete(
            this.database.doc(
              providerAccountLinkPath(data.providerAccountDigest),
            ),
          )
        }
        transaction.delete(reference)
      }
    })
  }

  async resolvePushOwner(options: {
    environment: GarminOAuthEnvironment
    providerAccountDigest: string
  }): Promise<{ ownerId: string; timeZone: string } | null> {
    const account = await this.database
      .doc(providerAccountLinkPath(options.providerAccountDigest))
      .get()
    const link = account.data()
    if (
      link?.schemaVersion !== providerAccountLinkSchemaVersion ||
      link.provider !== 'garmin_connect' ||
      link.environment !== options.environment ||
      typeof link.ownerId !== 'string'
    ) {
      return null
    }
    const [connection, membership, profile] = await Promise.all([
      this.database.doc(connectionPath(link.ownerId)).get(),
      this.database.doc(approvedBetaMembershipPath(link.ownerId)).get(),
      this.database.doc(`users/${link.ownerId}`).get(),
    ])
    const connectionData = connection.data()
    const profileData = profile.data()
    if (
      connectionData?.schemaVersion !== connectionSchemaVersion ||
      connectionData.status !== 'connected' ||
      connectionData.environment !== options.environment ||
      connectionData.ownerId !== link.ownerId ||
      connectionData.providerAccountDigest !== options.providerAccountDigest ||
      !isApprovedBetaMembership(membership.data(), link.ownerId) ||
      typeof profileData?.timeZone !== 'string'
    ) {
      return null
    }
    return { ownerId: link.ownerId, timeZone: profileData.timeZone }
  }

  async completeProviderDeregistration(options: {
    environment: GarminOAuthEnvironment
    providerAccountDigest: string
  }): Promise<void> {
    const accountReference = this.database.doc(
      providerAccountLinkPath(options.providerAccountDigest),
    )
    await this.database.runTransaction(async (transaction) => {
      const account = await transaction.get(accountReference)
      const link = account.data()
      if (
        link?.schemaVersion !== providerAccountLinkSchemaVersion ||
        link.provider !== 'garmin_connect' ||
        link.environment !== options.environment ||
        typeof link.ownerId !== 'string'
      ) {
        return
      }
      const connectionReference = this.database.doc(
        connectionPath(link.ownerId),
      )
      const connection = await transaction.get(connectionReference)
      const connectionData = connection.data()
      if (
        connectionData?.schemaVersion === connectionSchemaVersion &&
        connectionData.environment === options.environment &&
        connectionData.providerAccountDigest === options.providerAccountDigest
      ) {
        transaction.delete(connectionReference)
      }
      transaction.delete(accountReference)
    })
  }
}
