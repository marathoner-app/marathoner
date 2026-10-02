import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expectedDevelopmentProjectId,
  inspectFirebaseEnvironment,
  requiredFirebaseEnvironmentKeys,
  resolveFirebaseConfiguration,
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
  const environment = completeEnvironment();

  const result = inspectFirebaseEnvironment(environment);

  assert.equal(result.configured, true);
  assert.equal(result.label, 'ready');
  assert.deepEqual(result.missingKeys, []);
});

test('resolves trimmed public configuration for the development project', () => {
  const result = resolveFirebaseConfiguration({
    ...completeEnvironment(),
    EXPO_PUBLIC_FIREBASE_API_KEY: ' mobile-api-key ',
  });

  assert.deepEqual(result, {
    apiKey: 'mobile-api-key',
    authDomain: 'marathoner-d9bf9.firebaseapp.com',
    projectId: expectedDevelopmentProjectId,
    appId: 'development-app-id',
  });
});

test('throws instead of initializing with partial configuration', () => {
  assert.throws(
    () =>
      resolveFirebaseConfiguration({
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: expectedDevelopmentProjectId,
      }),
    /Firebase authentication is disabled: missing/,
  );
});

test('rejects a non-development Firebase project', () => {
  assert.throws(
    () =>
      resolveFirebaseConfiguration({
        ...completeEnvironment(),
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'marathonerapp-beta',
      }),
    /expected development project/,
  );
});

function completeEnvironment() {
  return {
    EXPO_PUBLIC_FIREBASE_API_KEY: 'mobile-api-key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'marathoner-d9bf9.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: expectedDevelopmentProjectId,
    EXPO_PUBLIC_FIREBASE_APP_ID: 'development-app-id',
  };
}
