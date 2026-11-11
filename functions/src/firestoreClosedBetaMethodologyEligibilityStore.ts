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
      })
    }

    const ownerId = request.ownerId
    return this.database.runTransaction(async (transaction) => {
      const [membership, control] = await Promise.all([
        transaction.get(
          this.database.doc(`betaMemberships/${ownerId}`),
        ),
        transaction.get(
          this.database.doc(CLOSED_BETA_METHODOLOGY_CONTROL_PATH),
        ),
      ])
      return evaluateClosedBetaMethodologyEligibility({
        request,
        membershipApproved: isApprovedBetaMembership(
          membership.data(),
          ownerId,
        ),
        control: control.data(),
        manifest: this.manifest,
      })
    })
  }
}
