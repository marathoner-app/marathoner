import { describe, expect, it } from "vitest";
import { resolveSignedOutSurface } from "./appRuntime";

describe("resolveSignedOutSurface", () => {
  it("selects the compact entry only for an installed iOS runtime", () => {
    expect(
      resolveSignedOutSurface({ isNativePlatform: true, platform: "ios" }),
    ).toBe("native-ios");
  });

  it.each([
    { isNativePlatform: false, platform: "web" },
    { isNativePlatform: false, platform: "ios" },
    { isNativePlatform: true, platform: "android" },
  ])("keeps $platform on the public web surface", (runtime) => {
    expect(resolveSignedOutSurface(runtime)).toBe("public-web");
  });
});
