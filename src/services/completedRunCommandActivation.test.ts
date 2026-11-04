import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCompletedRunCommandsEnabled } from "./completedRunCommandActivation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

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
    ).toThrow("reviewed live activation approval");
  });

  it("allows activation only after the live rehearsal is approved", () => {
    expect(
      resolveCompletedRunCommandsEnabled({
        requested: "true",
        liveActivationApproved: true,
      }),
    ).toBe(true);
  });

  it("applies the recorded live approval when an environment requests activation", async () => {
    vi.stubEnv("VITE_COMPLETED_RUN_COMMANDS_ENABLED", "true");
    vi.resetModules();

    const activation = await import("./completedRunCommandActivation");

    expect(activation.completedRunCommandsEnabled).toBe(true);
  });
});
