import type { Firestore } from 'firebase-admin/firestore'

import { isApprovedBetaMembership } from './approvedBetaMembership.js'
import {
  CLOSED_BETA_METHODOLOGY_CONTROL_PATH,
  CLOSED_BETA_PROJECT_ID,
  evaluateClosedBetaMethodologyEligibility,
  type ClosedBetaMethodologyEligibilityDecision,
  type ClosedBetaMethodologyEligibilityRequest,
} from './closedBetaMethodologyEligibility.js'
import type { ClosedBetaProvisionalMethodologyManifest } from '../../src/domain/methodology/closedBetaProvisionalMethodology.js'
import {
  closedBetaMethodologyConsentAcceptanceFromDocument,
  closedBetaMethodologyConsentPath,
} from './firestoreClosedBetaMethodologyConsentStore.js'

export class FirestoreClosedBetaMethodologyEligibilityStore {
  constructor(
    private readonly database: Firestore,
    private readonly manifest: ClosedBetaProvisionalMethodologyManifest | null,
  ) {}

  async evaluate(
    request: ClosedBetaMethodologyEligibilityRequest,
  ): Promise<ClosedBetaMethodologyEligibilityDecision> {
    if (
      request.ownerId === null ||
      request.ownerId.trim().length === 0 ||
      request.projectId !== CLOSED_BETA_PROJECT_ID
    ) {
      return evaluateClosedBetaMethodologyEligibility({
        request,
        membershipApproved: false,
        control: null,
        manifest: this.manifest,
        consent: { status: 'missing' },
      })
    }

    const ownerId = request.ownerId
    return this.database.runTransaction(async (transaction) => {
      const [membership, control, consent] = await Promise.all([
        transaction.get(
          this.database.doc(`betaMemberships/${ownerId}`),
        ),
        transaction.get(
          this.database.doc(CLOSED_BETA_METHODOLOGY_CONTROL_PATH),
        ),
        transaction.get(
          this.database.doc(closedBetaMethodologyConsentPath(ownerId)),
        ),
      ])
      const acceptance =
        closedBetaMethodologyConsentAcceptanceFromDocument(
          consent.data(),
          ownerId,
        )
      const consentEligibility =
        acceptance === null
          ? { status: consent.exists ? 'stale' as const : 'missing' as const }
          : acceptance.manifestVersion === this.manifest?.manifestVersion
            ? { status: 'current' as const, acceptedAt: acceptance.acceptedAt }
            : { status: 'stale' as const }
      return evaluateClosedBetaMethodologyEligibility({
        request,
        membershipApproved: isApprovedBetaMembership(
          membership.data(),
          ownerId,
        ),
        control: control.data(),
        manifest: this.manifest,
        consent: consentEligibility,
      })
    })
  }
}
