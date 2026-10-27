export const INTERNAL_PLAN_PROPOSAL_REHEARSAL_MODE =
  "internal-plan-rehearsal";

export function isInternalPlanProposalRehearsalMode(mode: string): boolean {
  return mode === INTERNAL_PLAN_PROPOSAL_REHEARSAL_MODE;
}
