import {
  parseClosedBetaGuidanceResult,
  type ClosedBetaGuidanceResult,
  type DismissClosedBetaGuidanceRequest,
  type GetClosedBetaGuidanceRequest,
} from "../domain/guidance/closedBetaGuidance";

export interface ClosedBetaGuidanceClient {
  get(request: GetClosedBetaGuidanceRequest): Promise<ClosedBetaGuidanceResult>;
  dismiss(
    request: DismissClosedBetaGuidanceRequest,
  ): Promise<ClosedBetaGuidanceResult>;
}

export function createClosedBetaGuidanceClient(transport: {
  get(request: GetClosedBetaGuidanceRequest): Promise<unknown>;
  dismiss(request: DismissClosedBetaGuidanceRequest): Promise<unknown>;
}): ClosedBetaGuidanceClient {
  return {
    async get(request) {
      return parseClosedBetaGuidanceResult(await transport.get(request));
    },
    async dismiss(request) {
      return parseClosedBetaGuidanceResult(await transport.dismiss(request));
    },
  };
}
