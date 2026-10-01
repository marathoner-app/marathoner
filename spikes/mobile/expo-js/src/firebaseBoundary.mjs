export const requiredFirebaseEnvironmentKeys = Object.freeze([
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
]);

/**
 * Reports whether a complete, explicit development configuration is present.
 * This module deliberately does not initialize Firebase.
 *
 * @param {Record<string, string | undefined>} environment
 */
export function inspectFirebaseEnvironment(environment) {
  const missingKeys = requiredFirebaseEnvironmentKeys.filter(
    (key) => !environment[key]?.trim(),
  );

  return {
    configured: missingKeys.length === 0,
    label: missingKeys.length === 0 ? 'detected but not connected' : 'absent',
    missingKeys,
  };
}
