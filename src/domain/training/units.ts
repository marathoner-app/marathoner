import {
  METERS_PER_MILE,
  createDistanceMeters,
  metersToMiles,
  milesToMeters,
  type DistanceMeters,
} from "@marathoner/training-contract";

declare const durationBrand: unique symbol;

export type DurationSeconds = number & { readonly [durationBrand]: "DurationSeconds" };
export type DistanceUnit = "mile" | "kilometer";

export {
  METERS_PER_MILE,
  createDistanceMeters,
  metersToMiles,
  milesToMeters,
};
export type { DistanceMeters };

export interface Pace {
  readonly secondsPerUnit: number;
  readonly unit: DistanceUnit;
}

export const METERS_PER_KILOMETER = 1000;

export function createDurationSeconds(value: number): DurationSeconds {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Duration must be a non-negative whole number of seconds.");
  }

  return value as DurationSeconds;
}

export function kilometersToMeters(kilometers: number): DistanceMeters {
  if (!Number.isFinite(kilometers) || kilometers < 0) {
    throw new Error("Kilometers must be a non-negative number.");
  }

  return createDistanceMeters(Math.round(kilometers * METERS_PER_KILOMETER));
}

export function metersToKilometers(meters: DistanceMeters): number {
  return meters / METERS_PER_KILOMETER;
}

export function calculatePace(
  distance: DistanceMeters,
  duration: DurationSeconds,
  unit: DistanceUnit,
): Pace | null {
  if (distance === 0 || duration === 0) {
    return null;
  }

  const metersPerUnit = unit === "mile" ? METERS_PER_MILE : METERS_PER_KILOMETER;

  return {
    secondsPerUnit: (duration * metersPerUnit) / distance,
    unit,
  };
}
