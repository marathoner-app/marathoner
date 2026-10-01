export const METERS_PER_MILE = 1609.344;

export function isCompletedRunIdValue(value) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes('/')
  );
}

export function createCompletedRunId(value) {
  if (!isCompletedRunIdValue(value)) {
    throw new Error(
      'CompletedRun identifier must be non-empty and cannot contain slashes.',
    );
  }

  return value;
}

export function createDistanceMeters(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Distance must be a non-negative whole number of meters.');
  }

  return value;
}

export function milesToMeters(miles) {
  if (!Number.isFinite(miles) || miles < 0) {
    throw new Error('Miles must be a non-negative number.');
  }

  return createDistanceMeters(Math.round(miles * METERS_PER_MILE));
}

export function metersToMiles(meters) {
  return meters / METERS_PER_MILE;
}
