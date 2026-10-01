import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCompletedRunId,
  createDistanceMeters,
  metersToMiles,
  milesToMeters,
} from '@marathoner/training-contract';

test('Expo consumes the shared completed-run identity', () => {
  assert.equal(createCompletedRunId('run-mobile-1'), 'run-mobile-1');
  assert.throws(
    () => createCompletedRunId('runs/run-mobile-1'),
    /cannot contain slashes/,
  );
});

test('Expo consumes the shared whole-meter distance', () => {
  const threeMiles = milesToMeters(3);

  assert.equal(threeMiles, 4828);
  assert.ok(Math.abs(metersToMiles(threeMiles) - 3) < 0.001);
  assert.throws(() => createDistanceMeters(-1), /non-negative/);
});
