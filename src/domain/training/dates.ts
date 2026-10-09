declare const dateOnlyBrand: unique symbol;
declare const utcDateTimeBrand: unique symbol;
declare const timeZoneBrand: unique symbol;

export type DateOnly = string & { readonly [dateOnlyBrand]: "DateOnly" };
export type UtcDateTime = string & { readonly [utcDateTimeBrand]: "UtcDateTime" };
export type IanaTimeZone = string & { readonly [timeZoneBrand]: "IanaTimeZone" };

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string") {
    return false;
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function createDateOnly(value: string): DateOnly {
  if (!isDateOnly(value)) {
    throw new Error("Date must use the YYYY-MM-DD format and represent a real calendar day.");
  }

  return value;
}

export function isUtcDateTime(value: unknown): value is UtcDateTime {
  if (typeof value !== "string") {
    return false;
  }

  const match = UTC_DATE_TIME_PATTERN.exec(value);
  if (!match || !isDateOnly(match[1])) {
    return false;
  }

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);

  return hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
}

export function createUtcDateTime(value: string): UtcDateTime {
  if (!isUtcDateTime(value)) {
    throw new Error("Timestamp must be a valid UTC ISO 8601 value ending in Z.");
  }

  return new Date(value).toISOString() as UtcDateTime;
}

export function isIanaTimeZone(value: unknown): value is IanaTimeZone {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function createIanaTimeZone(value: string): IanaTimeZone {
  if (!isIanaTimeZone(value)) {
    throw new Error("Time zone must be a valid IANA time zone name.");
  }

  return value;
}

export function createUtcDateTimeAtLocalNoon(
  date: DateOnly,
  timeZone: IanaTimeZone,
): UtcDateTime {
  const [year, month, day] = date.split("-").map(Number);
  const desiredWallTime = Date.UTC(year, month - 1, day, 12, 0, 0);
  let candidate = new Date(desiredWallTime);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(candidate)
        .map((part) => [part.type, part.value]),
    );
    const representedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const adjustment = desiredWallTime - representedWallTime;
    if (adjustment === 0) break;
    candidate = new Date(candidate.getTime() + adjustment);
  }

  const resolvedParts = Object.fromEntries(
    formatter
      .formatToParts(candidate)
      .map((part) => [part.type, part.value]),
  );
  const resolvedDate = `${resolvedParts.year}-${resolvedParts.month}-${resolvedParts.day}`;
  if (resolvedDate !== date || resolvedParts.hour !== "12") {
    throw new Error("The run date could not be represented in its time zone.");
  }

  return createUtcDateTime(candidate.toISOString());
}
