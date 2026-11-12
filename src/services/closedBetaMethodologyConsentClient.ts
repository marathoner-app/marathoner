import {
  parseClosedBetaMethodologyConsentResult,
  type AcceptClosedBetaMethodologyConsentCommand,
  type ClosedBetaMethodologyConsentResult,
} from "../domain/methodology/closedBetaMethodologyConsent";

export interface ClosedBetaMethodologyConsentClient {
  getStatus(): Promise<ClosedBetaMethodologyConsentResult>;
  accept(
    command: AcceptClosedBetaMethodologyConsentCommand,
  ): Promise<ClosedBetaMethodologyConsentResult>;
}

export interface ClosedBetaMethodologyConsentTransport {
  getStatus(): Promise<unknown>;
  accept(command: AcceptClosedBetaMethodologyConsentCommand): Promise<unknown>;
}

export function createClosedBetaMethodologyConsentClient(
  transport: ClosedBetaMethodologyConsentTransport,
): ClosedBetaMethodologyConsentClient {
  return {
    async getStatus() {
      return parseClosedBetaMethodologyConsentResult(
        await transport.getStatus(),
      );
    },
    async accept(command) {
      return parseClosedBetaMethodologyConsentResult(
        await transport.accept(command),
      );
    },
  };
}
