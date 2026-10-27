import { createDateOnly, type DateOnly } from "../domain/training";

export interface EvidenceWeek {
  readonly startDate: DateOnly;
  readonly endDate: DateOnly;
}

function shiftDate(date: DateOnly, days: number): DateOnly {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return createDateOnly(value.toISOString().slice(0, 10));
}

export function evidenceWeekContaining(date: DateOnly): EvidenceWeek {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const startDate = shiftDate(date, -daysSinceMonday);

  return {
    startDate,
    endDate: shiftDate(startDate, 6),
  };
}
