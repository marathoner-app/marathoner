import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createCompletedRunId,
  createDistanceMeters,
} from '@marathoner/training-contract';

const fixtureUrl = import.meta.resolve(
  '@marathoner/training-contract/fixtures/v1',
);
const trainingFixtures = JSON.parse(
  await readFile(new URL(fixtureUrl), 'utf8'),
);

const PLAN_STATUSES = new Set(['draft', 'active', 'completed', 'archived']);
const TRAINING_PHASES = new Set([
  'learn_to_run',
  'base_building',
  'marathon_training',
  'race_preparation',
  'recovery',
]);
const WORKOUT_STATUSES = new Set(['planned', 'completed', 'skipped']);
const RUN_PURPOSES = new Set([
  'easy',
  'recovery',
  'long',
  'tempo',
  'intervals',
  'race',
]);
const PERCEIVED_EFFORTS = new Set([
  'much_easier_than_expected',
  'easier_than_expected',
  'about_right',
  'harder_than_expected',
  'much_harder_than_expected',
]);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdentifier(value) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes('/')
  );
}

function isWholeNonNegative(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isDateOnly(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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

function isUtcDateTime(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/.exec(
      value,
    );

  return Boolean(
    match &&
      isDateOnly(match[1]) &&
      Number(match[2]) <= 23 &&
      Number(match[3]) <= 59 &&
      Number(match[4]) <= 59 &&
      Number.isFinite(Date.parse(value)),
  );
}

function isIanaTimeZone(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function hasValidTimestamps(value) {
  return (
    isUtcDateTime(value.createdAt) &&
    isUtcDateTime(value.updatedAt) &&
    value.updatedAt >= value.createdAt
  );
}

function hasValidOptionalText(value) {
  return value === undefined || (typeof value === 'string' && value.trim() !== '');
}

function isUserProfile(value) {
  return (
    isRecord(value) &&
    isIdentifier(value.id) &&
    hasValidOptionalText(value.displayName) &&
    ['mile', 'kilometer'].includes(value.preferredDistanceUnit) &&
    isIanaTimeZone(value.timeZone) &&
    hasValidTimestamps(value)
  );
}

function isTrainingPlan(value) {
  return (
    isRecord(value) &&
    isIdentifier(value.id) &&
    isIdentifier(value.userId) &&
    typeof value.name === 'string' &&
    value.name.trim() !== '' &&
    isDateOnly(value.startDate) &&
    isDateOnly(value.targetRaceDate) &&
    value.targetRaceDate >= value.startDate &&
    PLAN_STATUSES.has(value.status) &&
    hasValidTimestamps(value)
  );
}

function isPlannedWorkout(value) {
  if (
    !isRecord(value) ||
    !isIdentifier(value.id) ||
    !isIdentifier(value.userId) ||
    !isIdentifier(value.planId) ||
    !isDateOnly(value.scheduledDate) ||
    !TRAINING_PHASES.has(value.phase) ||
    !WORKOUT_STATUSES.has(value.status) ||
    !['rest', 'run', 'walk_run'].includes(value.kind) ||
    !hasValidOptionalText(value.notes) ||
    !hasValidTimestamps(value)
  ) {
    return false;
  }

  if (value.kind === 'rest') {
    return true;
  }

  const hasDistance =
    isWholeNonNegative(value.targetDistanceMeters) &&
    value.targetDistanceMeters > 0;
  const hasDuration =
    isWholeNonNegative(value.targetDurationSeconds) &&
    value.targetDurationSeconds > 0;

  return (
    (hasDistance || hasDuration) &&
    (value.kind !== 'run' || RUN_PURPOSES.has(value.purpose))
  );
}

function isCompletedRun(value) {
  if (!isRecord(value)) {
    return false;
  }

  const hasPlanId = value.plannedWorkoutPlanId !== undefined;
  const hasWorkoutId = value.plannedWorkoutId !== undefined;

  return (
    isIdentifier(value.id) &&
    isIdentifier(value.userId) &&
    (!hasPlanId || isIdentifier(value.plannedWorkoutPlanId)) &&
    (!hasWorkoutId || isIdentifier(value.plannedWorkoutId)) &&
    hasPlanId === hasWorkoutId &&
    (value.shoeId === undefined || isIdentifier(value.shoeId)) &&
    isUtcDateTime(value.startedAt) &&
    isIanaTimeZone(value.timeZone) &&
    isWholeNonNegative(value.distanceMeters) &&
    value.distanceMeters > 0 &&
    isWholeNonNegative(value.durationSeconds) &&
    value.durationSeconds > 0 &&
    (value.perceivedEffort === undefined ||
      PERCEIVED_EFFORTS.has(value.perceivedEffort)) &&
    (value.unusualPain === undefined ||
      typeof value.unusualPain === 'boolean') &&
    hasValidOptionalText(value.notes) &&
    hasValidTimestamps(value)
  );
}

function isShoe(value) {
  if (
    !isRecord(value) ||
    !isIdentifier(value.id) ||
    !isIdentifier(value.userId) ||
    typeof value.name !== 'string' ||
    value.name.trim() === '' ||
    !isWholeNonNegative(value.startingDistanceMeters) ||
    !['active', 'retired'].includes(value.status) ||
    !hasValidTimestamps(value)
  ) {
    return false;
  }

  return value.status === 'retired'
    ? isDateOnly(value.retiredOn)
    : value.retiredOn === undefined;
}

function acceptsFixture(fixture) {
  try {
    switch (fixture.subject) {
      case 'userId':
      case 'trainingPlanId':
      case 'plannedWorkoutId':
      case 'shoeId':
        return isIdentifier(fixture.value);
      case 'completedRunId':
        createCompletedRunId(fixture.value);
        return true;
      case 'distanceMeters':
        createDistanceMeters(fixture.value);
        return true;
      case 'durationSeconds':
        return isWholeNonNegative(fixture.value);
      case 'dateOnly':
        return isDateOnly(fixture.value);
      case 'utcDateTime':
        return isUtcDateTime(fixture.value);
      case 'ianaTimeZone':
        return isIanaTimeZone(fixture.value);
      case 'userProfile':
        return isUserProfile(fixture.value);
      case 'trainingPlan':
        return isTrainingPlan(fixture.value);
      case 'plannedWorkout':
        return isPlannedWorkout(fixture.value);
      case 'completedRun':
        return isCompletedRun(fixture.value);
      case 'shoe':
        return isShoe(fixture.value);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

test('Expo loads the complete versioned fixture envelope', () => {
  assert.equal(trainingFixtures.$schema, './fixture-format.schema.json');
  assert.equal(trainingFixtures.fixtureFormatVersion, 1);
  assert.equal(trainingFixtures.contractVersion, 'training-domain@1');
  assert.ok(trainingFixtures.fixtures.length > 0);

  const ids = trainingFixtures.fixtures.map((fixture) => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    trainingFixtures.fixtures.every(
      (fixture) =>
        fixture.schemaVersion === 1 &&
        (fixture.expected.valid || typeof fixture.expected.reason === 'string'),
    ),
  );
});

test('Expo independently matches every canonical expected result', () => {
  for (const fixture of trainingFixtures.fixtures) {
    assert.equal(
      acceptsFixture(fixture),
      fixture.expected.valid,
      fixture.id,
    );
  }
});
