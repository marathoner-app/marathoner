import {
  isInternalAdaptationRecommendationResult,
  type InternalAdaptationRecommendationCommand,
  type InternalAdaptationRecommendationResult,
} from "../domain/recommendations/internalAdaptationRecommendation";

export interface InternalAdaptationRecommendationTransport {
  generate(command: InternalAdaptationRecommendationCommand): Promise<unknown>;
}

export interface InternalAdaptationRecommendationClient {
  generate(
    command: InternalAdaptationRecommendationCommand,
  ): Promise<InternalAdaptationRecommendationResult>;
}

export function createInternalAdaptationRecommendationClient(
  transport: InternalAdaptationRecommendationTransport,
): InternalAdaptationRecommendationClient {
  return {
    async generate(command) {
      const result = await transport.generate(command);
      if (!isInternalAdaptationRecommendationResult(result)) {
        throw new Error(
          "The internal adaptation recommendation response is invalid.",
        );
      }
      return result;
    },
  };
}
