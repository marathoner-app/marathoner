import { describe, expect, it, vi } from "vitest";
import { measureOperation } from "./operationTiming";

describe("operation timing", () => {
  it("preserves a successful result when browser measurement fails", async () => {
    vi.spyOn(performance, "measure").mockImplementationOnce(() => {
      throw new Error("Performance timeline unavailable");
    });

    await expect(
      measureOperation("marathoner:test", async () => "saved"),
    ).resolves.toBe("saved");
  });

  it("preserves the persistence error after recording its duration", async () => {
    const expected = new Error("Write failed");

    await expect(
      measureOperation("marathoner:test", async () => {
        throw expected;
      }),
    ).rejects.toBe(expected);
  });
});
