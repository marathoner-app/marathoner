import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore'

import {
  CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
  CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
  type ClosedBetaMethodologyConsentAcceptance,
} from '../../src/domain/methodology/closedBetaMethodologyConsent.js'
import { isApprovedBetaMembership } from './approvedBetaMembership.js'
import type { ClosedBetaMethodologyConsentStore } from './closedBetaMethodologyConsentHandler.js'

export const CLOSED_BETA_METHODOLOGY_CONSENT_DOCUMENT_ID = 'closed-beta'

export function closedBetaMethodologyConsentPath(ownerId: string): string {
  return `users/${ownerId}/methodologyConsents/${CLOSED_BETA_METHODOLOGY_CONSENT_DOCUMENT_ID}`
}

export function closedBetaMethodologyConsentAcceptanceFromDocument(
  data: DocumentData | undefined,
  ownerId: string,
): ClosedBetaMethodologyConsentAcceptance | null {
  if (data === undefined) return null
  const keys = Object.keys(data).sort()
  if (
    keys.length !== 5 ||
    keys[0] !== 'acceptedAt' ||
    keys[1] !== 'consentVersion' ||
    keys[2] !== 'manifestVersion' ||
    keys[3] !== 'schemaVersion' ||
    keys[4] !== 'userId' ||
    data.schemaVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION ||
    data.userId !== ownerId ||
    data.consentVersion !== CLOSED_BETA_METHODOLOGY_CONSENT_VERSION ||
    typeof data.manifestVersion !== 'string' ||
    !(data.acceptedAt instanceof Timestamp)
  ) {
    return null
  }
  return {
    schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
    userId: ownerId,
    consentVersion: CLOSED_BETA_METHODOLOGY_CONSENT_VERSION,
    manifestVersion: data.manifestVersion,
    acceptedAt: data.acceptedAt.toDate().toISOString(),
  }
}

export function isCurrentClosedBetaMethodologyConsent(
  data: DocumentData | undefined,
  ownerId: string,
  manifestVersion: string,
): boolean {
  return closedBetaMethodologyConsentAcceptanceFromDocument(data, ownerId)?.manifestVersion === manifestVersion
}

export class FirestoreClosedBetaMethodologyConsentStore
  implements ClosedBetaMethodologyConsentStore
{
  constructor(
    private readonly database: Firestore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(options: Parameters<ClosedBetaMethodologyConsentStore['get']>[0]) {
    return this.database.runTransaction(async (transaction) => {
      const [membership, consent] = await Promise.all([
        transaction.get(this.database.doc(`betaMemberships/${options.ownerId}`)),
        transaction.get(
          this.database.doc(closedBetaMethodologyConsentPath(options.ownerId)),
        ),
      ])
      if (!isApprovedBetaMembership(membership.data(), options.ownerId)) {
        return { kind: 'membership-required' as const }
      }
      const acceptance = closedBetaMethodologyConsentAcceptanceFromDocument(consent.data(), options.ownerId)
      if (acceptance === null) {
        return {
          kind: 'required' as const,
          reason: consent.exists ? 'version_changed' as const : 'missing' as const,
        }
      }
      if (
        acceptance.consentVersion !== options.consentVersion ||
        acceptance.manifestVersion !== options.manifestVersion
      ) {
        return { kind: 'required' as const, reason: 'version_changed' as const }
      }
      return { kind: 'accepted' as const, acceptance }
    })
  }

  async accept(
    options: Parameters<ClosedBetaMethodologyConsentStore['accept']>[0],
  ) {
    return this.database.runTransaction(async (transaction) => {
      const membershipReference = this.database.doc(
        `betaMemberships/${options.ownerId}`,
      )
      const consentReference = this.database.doc(
        closedBetaMethodologyConsentPath(options.ownerId),
      )
      const [membership, consent] = await Promise.all([
        transaction.get(membershipReference),
        transaction.get(consentReference),
      ])
      if (!isApprovedBetaMembership(membership.data(), options.ownerId)) {
        return { kind: 'membership-required' as const }
      }
      const current = closedBetaMethodologyConsentAcceptanceFromDocument(consent.data(), options.ownerId)
      if (
        current !== null &&
        current.consentVersion === options.consentVersion &&
        current.manifestVersion === options.manifestVersion
      ) {
        return { kind: 'accepted' as const, acceptance: current }
      }

      const acceptedAt = Timestamp.fromDate(this.now())
      transaction.set(consentReference, {
        schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
        userId: options.ownerId,
        consentVersion: options.consentVersion,
        manifestVersion: options.manifestVersion,
        acceptedAt,
      })
      return {
        kind: 'accepted' as const,
        acceptance: {
          schemaVersion: CLOSED_BETA_METHODOLOGY_CONSENT_SCHEMA_VERSION,
          userId: options.ownerId,
          consentVersion: options.consentVersion,
          manifestVersion: options.manifestVersion,
          acceptedAt: acceptedAt.toDate().toISOString(),
        },
      }
    })
  }
}
