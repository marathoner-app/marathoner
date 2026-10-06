import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall } from 'firebase-functions/v2/https'

import { FirestoreMaterialCommandStore } from './firestoreMaterialCommandStore.js'
import {
  executeMaterialCommand,
  resolveMaterialCommand as resolveMaterialCommandRequest,
  type MaterialCommandLogEntry,
} from './materialCommandHandler.js'

if (getApps().length === 0) initializeApp()

setGlobalOptions({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 15,
  maxInstances: 2,
})

const dependencies = {
  store: new FirestoreMaterialCommandStore(getFirestore()),
  log: (entry: MaterialCommandLogEntry) => {
    logger.info('Material command boundary event', entry)
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
