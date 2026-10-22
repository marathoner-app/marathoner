import { createDurationSeconds } from "../domain/training";

export type DurationSegment = "hours" | "minutes" | "seconds";

export const durationSegments: readonly DurationSegment[] = [
  "hours",
  "minutes",
  "seconds",
];

export function segmentName(name: string, segment: DurationSegment) {
  return `${name}-${segment}`;
}

export function splitDuration(totalSeconds: number) {
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function readSegment(
  formData: FormData,
  name: string,
  segment: DurationSegment,
) {
  const rawValue = formData.get(segmentName(name, segment));
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";

  if (normalizedValue === "") return 0;

  const value = Number(normalizedValue);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      "Enter elapsed time using whole, nonnegative hours, minutes, and seconds.",
    );
  }

  if (segment !== "hours" && value > 59) {
    throw new Error("Minutes and seconds must be between 0 and 59.");
  }

  return value;
}

export function readElapsedDuration(formData: FormData, name: string) {
  const values = Object.fromEntries(
    durationSegments.map((segment) => [
      segment,
      readSegment(formData, name, segment),
    ]),
  ) as Record<DurationSegment, number>;
  const totalSeconds =
    values.hours * 3600 + values.minutes * 60 + values.seconds;

  if (totalSeconds === 0) {
    throw new Error("Elapsed time must be greater than zero.");
  }

  return createDurationSeconds(totalSeconds);
}
