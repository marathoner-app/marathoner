import {
  isClosedBetaAdaptationRecommendationResult,
  type ClosedBetaAdaptationRecommendationCommand,
  type ClosedBetaAdaptationRecommendationResult,
} from "../domain/recommendations/closedBetaAdaptationRecommendation";

export interface ClosedBetaAdaptationRecommendationTransport {
  generate(
    command: ClosedBetaAdaptationRecommendationCommand,
  ): Promise<unknown>;
}

export interface ClosedBetaAdaptationRecommendationClient {
  generate(
    command: ClosedBetaAdaptationRecommendationCommand,
  ): Promise<ClosedBetaAdaptationRecommendationResult>;
}

export function createClosedBetaAdaptationRecommendationClient(
  transport: ClosedBetaAdaptationRecommendationTransport,
): ClosedBetaAdaptationRecommendationClient {
  return {
    async generate(command) {
      const result = await transport.generate(command);
      if (!isClosedBetaAdaptationRecommendationResult(result)) {
        throw new Error("The plan recommendation response is invalid.");
      }
      return result;
    },
  };
}
