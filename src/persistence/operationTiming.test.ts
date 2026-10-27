import { describe, expect, it, vi } from "vitest";
import { measureOperation } from "./operationTiming";

describe("operation timing", () => {
  it("preserves a successful result when browser measurement fails", async () => {
    const onMeasured = vi.fn();
    vi.spyOn(performance, "measure").mockImplementationOnce(() => {
      throw new Error("Performance timeline unavailable");
    });

    await expect(
      measureOperation("marathoner:test", async () => "saved", onMeasured),
    ).resolves.toBe("saved");
    expect(onMeasured).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "succeeded" }),
    );
  });

  it("preserves the persistence error after recording its duration", async () => {
    const expected = new Error("Write failed");
    const onMeasured = vi.fn();

    await expect(
      measureOperation("marathoner:test", async () => {
        throw expected;
      }, onMeasured),
    ).rejects.toBe(expected);
    expect(onMeasured).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed" }),
    );
  });

  it("preserves the operation when the browser clock is unavailable", async () => {
    vi.spyOn(performance, "now").mockImplementationOnce(() => {
      throw new Error("Performance clock unavailable");
    });

    await expect(
      measureOperation("marathoner:test", async () => "saved"),
    ).resolves.toBe("saved");
  });
});
