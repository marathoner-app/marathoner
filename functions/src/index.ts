import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall } from 'firebase-functions/v2/https'

import {
  GENERATED_PLAN_SCHEMA_VERSION,
  PLAN_GENERATION_INPUT_SCHEMA_VERSION,
  PLAN_GENERATION_RESULT_SCHEMA_VERSION,
} from '../../src/domain/training/planGeneration.js'
import {
  executeAccountDeletionRequest,
  type AccountDeletionRequestLogEntry,
} from './accountDeletionRequestHandler.js'
import { FirebaseAccountAccessManager } from './firebaseAccountAccessManager.js'
import { FirestoreAccountDeletionRequestStore } from './firestoreAccountDeletionRequestStore.js'
import { FirestoreMaterialCommandStore } from './firestoreMaterialCommandStore.js'
import { FirestorePlanApprovalStore } from './firestorePlanApprovalStore.js'
import { FirestoreRunCompletionStore } from './firestoreRunCompletionStore.js'
import { FirestoreRunDeletionStore } from './firestoreRunDeletionStore.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand as resolveMaterialCommandRequest,
  type MaterialCommandLogEntry,
} from './materialCommandHandler.js'
import {
  PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
  type PlanApprovalArtifactPolicyRecord,
} from './planApprovalArtifactPolicy.js'

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
const useEmulatorPlanApprovalPolicy =
  process.env.FUNCTIONS_EMULATOR === 'true'
const useEmulatorCompletedRunCommands =
  process.env.FUNCTIONS_EMULATOR === 'true'

const dependencies = {
  store: new FirestoreMaterialCommandStore(database),
  planApproval: {
    policyRecords: useEmulatorPlanApprovalPolicy
      ? emulatorPlanApprovalPolicy
      : PRODUCTION_PLAN_APPROVAL_ARTIFACT_POLICY,
    store: new FirestorePlanApprovalStore(database),
    supportedScopeId: useEmulatorPlanApprovalPolicy
      ? emulatorPlanApprovalScopeId
      : null,
  },
  ...(useEmulatorCompletedRunCommands
    ? {
        runCompletion: { store: new FirestoreRunCompletionStore(database) },
        runDeletion: { store: new FirestoreRunDeletionStore(database) },
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

export const submitMaterialCommand = onCall((request) =>
  executeMaterialCommand(
    {
      authenticatedUserId: request.auth?.uid ?? null,
      data: request.data,
    },
    dependencies,
  ),
)

export const resolveMaterialCommand = onCall((request) =>
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
// Live attestation and deployment remain blocked by unresolved #143 and #204
// gates plus #205 authorization. The exact beta-project guard is prepared but
// does not authorize or perform that deployment.
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
