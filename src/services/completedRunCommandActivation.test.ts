import { describe, expect, it } from "vitest";
import { resolveCompletedRunCommandsEnabled } from "./completedRunCommandActivation";

describe("resolveCompletedRunCommandsEnabled", () => {
  it.each([undefined, "", "false", " FALSE "])(
    "keeps commands disabled for %s",
    (requested) => {
      expect(
        resolveCompletedRunCommandsEnabled({
          requested,
          liveActivationApproved: false,
        }),
      ).toBe(false);
    },
  );

  it("rejects malformed values instead of guessing", () => {
    expect(() =>
      resolveCompletedRunCommandsEnabled({
        requested: "yes",
        liveActivationApproved: true,
      }),
    ).toThrow(
      'VITE_COMPLETED_RUN_COMMANDS_ENABLED must be either "true" or "false".',
    );
  });

  it("rejects activation until the live rehearsal is approved", () => {
    expect(() =>
      resolveCompletedRunCommandsEnabled({
        requested: "true",
        liveActivationApproved: false,
      }),
    ).toThrow("issue #347");
  });

  it("allows activation only after the live rehearsal is approved", () => {
    expect(
      resolveCompletedRunCommandsEnabled({
        requested: "true",
        liveActivationApproved: true,
      }),
    ).toBe(true);
  });
});
