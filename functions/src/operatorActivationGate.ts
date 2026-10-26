import {
  evaluateActivation,
  type ActivationDecision,
  type ActivationRequestV1,
  type OperatorActivationControlV1,
} from '../../src/domain/recommendations/recommendationEvidence.js'

export interface OperatorActivationControlReader {
  read(): Promise<OperatorActivationControlV1>
}

/**
 * Reads the operator-owned control at decision time and collapses every read or
 * validation failure into the same fail-closed decision. Callers never need to
 * inspect persistence errors or expose control contents to participants.
 */
export class OperatorActivationGate {
  constructor(private readonly controls: OperatorActivationControlReader) {}

  async evaluate(request: ActivationRequestV1): Promise<ActivationDecision> {
    try {
      return evaluateActivation(await this.controls.read(), request)
    } catch {
      return { allowed: false, reason: 'invalid_control' }
    }
  }
}
