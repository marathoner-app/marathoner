import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectFirebaseEnvironment,
  requiredFirebaseEnvironmentKeys,
} from '../src/firebaseBoundary.mjs';

test('fails closed when no Firebase environment is present', () => {
  const result = inspectFirebaseEnvironment({});

  assert.equal(result.configured, false);
  assert.equal(result.label, 'absent');
  assert.deepEqual(result.missingKeys, requiredFirebaseEnvironmentKeys);
});

test('rejects a partial Firebase environment', () => {
  const result = inspectFirebaseEnvironment({
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'marathoner-development',
  });

  assert.equal(result.configured, false);
  assert.equal(result.missingKeys.length, 3);
});

test('detects a complete environment without connecting to it', () => {
  const environment = Object.fromEntries(
    requiredFirebaseEnvironmentKeys.map((key) => [key, 'explicit-value']),
  );

  const result = inspectFirebaseEnvironment(environment);

  assert.equal(result.configured, true);
  assert.equal(result.label, 'detected but not connected');
  assert.deepEqual(result.missingKeys, []);
});
