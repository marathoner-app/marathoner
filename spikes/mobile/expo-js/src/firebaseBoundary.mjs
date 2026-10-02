export const requiredFirebaseEnvironmentKeys = Object.freeze([
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
]);

export const expectedDevelopmentProjectId = 'marathoner-d9bf9';

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
    label: missingKeys.length === 0 ? 'ready' : 'absent',
    missingKeys,
  };
}

/**
 * Returns the public Firebase client configuration only when every required
 * value is explicit and belongs to Marathoner's development project.
 *
 * @param {Record<string, string | undefined>} environment
 */
export function resolveFirebaseConfiguration(environment) {
  const inspection = inspectFirebaseEnvironment(environment);

  if (!inspection.configured) {
    throw new Error(
      `Firebase authentication is disabled: missing ${inspection.missingKeys.join(', ')}.`,
    );
  }

  const projectId = environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID.trim();

  if (projectId !== expectedDevelopmentProjectId) {
    throw new Error(
      `Firebase authentication is disabled: expected development project "${expectedDevelopmentProjectId}".`,
    );
  }

  return {
    apiKey: environment.EXPO_PUBLIC_FIREBASE_API_KEY.trim(),
    authDomain: environment.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN.trim(),
    projectId,
    appId: environment.EXPO_PUBLIC_FIREBASE_APP_ID.trim(),
  };
}
