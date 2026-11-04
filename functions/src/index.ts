import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import {
  defineBoolean,
  defineSecret,
  defineString,
  gcloudProject,
} from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall, onRequest } from 'firebase-functions/v2/https'

import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
} from '../../src/domain/training/planGeneration.js'
import {
  executeAccountDeletionRequest,
  type AccountDeletionRequestLogEntry,
} from './accountDeletionRequestHandler.js'
import {
  COMPLETED_RUN_COMMANDS_ENABLED_PARAM,
  shouldInstallCompletedRunCommandStores,
} from './completedRunCommandActivation.js'
import { FirebaseAccountAccessManager } from './firebaseAccountAccessManager.js'
import { FirestoreAccountDeletionRequestStore } from './firestoreAccountDeletionRequestStore.js'
import { FirestoreActivityImportStore } from './firestoreActivityImportStore.js'
import { FirestoreGarminOAuthStore } from './firestoreGarminOAuthStore.js'
import { FirestoreMaterialCommandStore } from './firestoreMaterialCommandStore.js'
import { FirestoreOperatorActivationControlStore } from './firestoreOperatorActivationControlStore.js'
import { FirestorePlanApprovalStore } from './firestorePlanApprovalStore.js'
import { FirestoreRecommendationDecisionStore } from './firestoreRecommendationDecisionStore.js'
import { FirestoreRecommendationEvidenceStore } from './firestoreRecommendationEvidenceStore.js'
import { FirestoreRunCompletionStore } from './firestoreRunCompletionStore.js'
import { FirestoreRunDeletionStore } from './firestoreRunDeletionStore.js'
import { FirestoreRunUpdateStore } from './firestoreRunUpdateStore.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand as resolveMaterialCommandRequest,
  type MaterialCommandLogEntry,
} from './materialCommandHandler.js'
import {
  selectLivePlanApprovalArtifactPolicy,
  type PlanApprovalArtifactPolicyRecord,
} from './planApprovalArtifactPolicy.js'
import { OperatorActivationGate } from './operatorActivationGate.js'
import {
  completeGarminOAuthCallback,
  disconnectGarmin,
  getGarminConnectionStatus,
  startGarminOAuth,
  type GarminOAuthEnvironment,
  type GarminOAuthLogEntry,
} from './garminOAuthHandler.js'
import { HttpGarminOAuthProvider } from './garminOAuthProvider.js'

if (getApps().length === 0) initializeApp()

setGlobalOptions({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 15,
  minInstances: 0,
  maxInstances: 1,
})

const database = getFirestore()
const emulatorPlanApprovalScopeId = 'synthetic-consistent-runner@1'
const emulatorPlanApprovalPolicy: readonly PlanApprovalArtifactPolicyRecord[] = [
  {
    supportedScopeId: emulatorPlanApprovalScopeId,
    inputSchemaVersion: PLAN_GENERATION_INPUT_SCHEMA_VERSION,
    generatorVersion: 'fixture-generator@1.0.0',
    rulesetVersion: 'fixture-rules@1.0.0',
    generatedPlanSchemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
    resultSchemaVersion: PLAN_GENERATION_RESULT_SCHEMA_VERSION,
    reviewState: 'approved',
  },
]
const functionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
const useEmulatorPlanApprovalPolicy = functionsEmulator
const provisionalPlanDogfoodEnabled = defineBoolean(
  'MARATHONER_PROVISIONAL_PLAN_DOGFOOD_ENABLED',
  {
    default: false,
    description:
      'Allows one pinned provisional plan artifact only in the closed development dogfood project.',
  },
)
const livePlanApprovalPolicy = selectLivePlanApprovalArtifactPolicy({
  projectId: gcloudProject.value(),
  provisionalDogfoodEnabled:
    !functionsEmulator && provisionalPlanDogfoodEnabled.value(),
})
const completedRunCommandsEnabled = defineBoolean(
  COMPLETED_RUN_COMMANDS_ENABLED_PARAM,
  {
    default: false,
    description:
      'Installs completed-run command stores only in a reviewed Firebase project.',
  },
)
const useCompletedRunCommands = shouldInstallCompletedRunCommandStores({
  activationEnabled: completedRunCommandsEnabled.value(),
  functionsEmulator,
  projectId: gcloudProject.value(),
})
const operatorActivationGate = new OperatorActivationGate(
  new FirestoreOperatorActivationControlStore(database),
)

const dependencies = {
  store: new FirestoreMaterialCommandStore(database),
  planApproval: {
    activationGate: operatorActivationGate,
    allowProvisionalDogfood: useEmulatorPlanApprovalPolicy
      ? false
      : livePlanApprovalPolicy.allowProvisionalDogfood,
    policyRecords: useEmulatorPlanApprovalPolicy
      ? emulatorPlanApprovalPolicy
      : livePlanApprovalPolicy.records,
    store: new FirestorePlanApprovalStore(database),
    supportedScopeId: useEmulatorPlanApprovalPolicy
      ? emulatorPlanApprovalScopeId
      : livePlanApprovalPolicy.supportedScopeId,
  },
  recommendationDecision: {
    activationGate: operatorActivationGate,
    evidence: new FirestoreRecommendationEvidenceStore(database),
    store: new FirestoreRecommendationDecisionStore(database),
  },
  ...(useCompletedRunCommands
    ? {
        activityImport: { store: new FirestoreActivityImportStore(database) },
        runCompletion: { store: new FirestoreRunCompletionStore(database) },
        runDeletion: { store: new FirestoreRunDeletionStore(database) },
        runUpdate: { store: new FirestoreRunUpdateStore(database) },
      }
    : {}),
  log: (entry: MaterialCommandLogEntry) => {
    logger.info('Material command boundary event', entry)
  },
}

const accountDeletionDependencies = {
  accountAccess: new FirebaseAccountAccessManager(getAuth()),
  store: new FirestoreAccountDeletionRequestStore(database),
  nowEpochSeconds: () => Math.floor(Date.now() / 1_000),
  log: (entry: AccountDeletionRequestLogEntry) => {
    logger.info('Account deletion request boundary event', entry)
  },
}

const garminOAuthEnabled = defineBoolean('GARMIN_OAUTH_ENABLED', {
  default: false,
  description:
    'Enables the trusted Garmin OAuth boundary only in the closed beta project.',
})
const garminOAuthEnvironment = defineString('GARMIN_OAUTH_ENVIRONMENT', {
  default: 'development',
  description: 'Names the isolated Garmin grant environment.',
})
const garminClientId = defineString('GARMIN_CLIENT_ID', { default: '' })
const garminClientSecret = defineSecret('GARMIN_CLIENT_SECRET')
const garminOAuthRedirectUri = defineString('GARMIN_OAUTH_REDIRECT_URI', {
  default: '',
})
const garminAuthorizationUrl = defineString('GARMIN_AUTHORIZATION_URL', {
  default: '',
})
const garminTokenUrl = defineString('GARMIN_TOKEN_URL', { default: '' })
const garminRevocationUrl = defineString('GARMIN_REVOCATION_URL', {
  default: '',
})
const garminStore = new FirestoreGarminOAuthStore(database)

function configuredGarminEnvironment(): GarminOAuthEnvironment {
  return garminOAuthEnvironment.value() === 'beta' ? 'beta' : 'development'
}

function garminOAuthDependencies(options: {
  mode: 'authorization' | 'none' | 'server'
}) {
  const environment = configuredGarminEnvironment()
  const enabled =
    garminOAuthEnabled.value() &&
    environment === 'beta' &&
    gcloudProject.value() === 'marathonerapp-beta'
  const disabledProvider = {
    authorizationUrl: () => {
      throw new Error('Garmin OAuth is disabled.')
    },
    exchangeAuthorizationCode: async () => {
      throw new Error('Garmin OAuth is disabled.')
    },
    revoke: async () => {
      throw new Error('Garmin OAuth is disabled.')
    },
  }
  return {
    enabled,
    environment,
    store: garminStore,
    provider: enabled && options.mode !== 'none'
      ? new HttpGarminOAuthProvider({
          authorizationUrl: garminAuthorizationUrl.value(),
          tokenUrl: garminTokenUrl.value(),
          revocationUrl: garminRevocationUrl.value(),
          clientId: garminClientId.value(),
          clientSecret:
            options.mode === 'server' ? garminClientSecret.value() : '',
          redirectUri: garminOAuthRedirectUri.value(),
        })
      : disabledProvider,
    log: (entry: GarminOAuthLogEntry) => {
      logger.info('Garmin OAuth boundary event', entry)
    },
  }
}

function garminCaller(request: {
  app?: unknown
  auth?: { uid: string }
}) {
  return {
    appCheckVerified: request.app !== undefined || functionsEmulator,
    ownerId: request.auth?.uid ?? null,
  }
}

// Cloud Run must admit the HTTPS request before Firebase can populate
// request.auth and request.app. The handlers below still enforce Marathoner's
// signed-in account, membership, artifact-policy, and App Check boundaries.
export const submitMaterialCommand = onCall(
  { enforceAppCheck: false, invoker: 'public' },
  (request) =>
    executeMaterialCommand(
      {
        appCheckVerified: request.app !== undefined || functionsEmulator,
        authenticatedUserId: request.auth?.uid ?? null,
        data: request.data,
      },
      dependencies,
    ),
)

export const resolveMaterialCommand = onCall(
  { invoker: 'public' },
  (request) =>
    resolveMaterialCommandRequest(
      {
        authenticatedUserId: request.auth?.uid ?? null,
        data: request.data,
      },
      dependencies,
    ),
)

// The verified request.app value is enforced inside the handler so unsupported
// clients receive a typed result. Invalid or missing tokens cannot populate it.
// Live deployment and the observation window remain owned by #205. The exact
// beta-project guard is prepared but does not authorize or perform a deploy.
export const requestAccountDeletion = onCall(
  { enforceAppCheck: false, consumeAppCheckToken: true },
  (request) =>
    executeAccountDeletionRequest(
      {
        authenticatedUser: request.auth
          ? {
              uid: request.auth.uid,
              emailVerified: request.auth.token.email_verified === true,
              authTimeSeconds:
                typeof request.auth.token.auth_time === 'number'
                  ? request.auth.token.auth_time
                  : null,
            }
          : null,
        appCheckVerified: request.app !== undefined,
        appCheckAlreadyConsumed: request.app?.alreadyConsumed === true,
        data: request.data,
      },
      accountDeletionDependencies,
    ),
)

export const startGarminConnection = onCall(
  {
    enforceAppCheck: false,
    invoker: 'public',
  },
  (request) =>
    startGarminOAuth(
      garminCaller(request),
      garminOAuthDependencies({ mode: 'authorization' }),
    ),
)

export const getGarminConnection = onCall(
  {
    enforceAppCheck: false,
    invoker: 'public',
  },
  (request) =>
    getGarminConnectionStatus(
      garminCaller(request),
      garminOAuthDependencies({ mode: 'none' }),
    ),
)

export const disconnectGarminConnection = onCall(
  {
    enforceAppCheck: false,
    invoker: 'public',
    secrets: [garminClientSecret],
  },
  (request) =>
    disconnectGarmin(
      garminCaller(request),
      garminOAuthDependencies({ mode: 'server' }),
    ),
)

export const garminOAuthCallback = onRequest(
  {
    invoker: 'public',
    secrets: [garminClientSecret],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store')
    response.set('Referrer-Policy', 'no-referrer')
    response.set('X-Content-Type-Options', 'nosniff')
    if (request.method !== 'GET') {
      response.status(405).type('text/plain').send('Method not allowed.')
      return
    }
    const code = typeof request.query.code === 'string' ? request.query.code : ''
    const state =
      typeof request.query.state === 'string' ? request.query.state : ''
    const result = await completeGarminOAuthCallback(
      { code, state },
      garminOAuthDependencies({ mode: 'server' }),
    )
    if (result.status === 'connected') {
      response
        .status(200)
        .type('text/plain')
        .send('Garmin is connected. You can return to Marathoner.')
      return
    }
    if (result.status === 'pending') {
      response
        .status(202)
        .type('text/plain')
        .send('Garmin connection is still being confirmed. Return to Marathoner shortly.')
      return
    }
    response
      .status(result.status === 'unavailable' ? 503 : 400)
      .type('text/plain')
      .send('Marathoner could not complete the Garmin connection. Return to Marathoner and try again.')
  },
)
