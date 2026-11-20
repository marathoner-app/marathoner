import { Capacitor } from "@capacitor/core";

export type SignedOutSurface = "native-ios" | "public-web";

export function resolveSignedOutSurface({
  isNativePlatform,
  platform,
}: {
  readonly isNativePlatform: boolean;
  readonly platform: string;
}): SignedOutSurface {
  return isNativePlatform && platform === "ios" ? "native-ios" : "public-web";
}

export function getSignedOutSurface(): SignedOutSurface {
  return resolveSignedOutSurface({
    isNativePlatform: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  });
}
