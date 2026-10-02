import { getFirestore } from 'firebase/firestore'
import { createSharedRecordClient } from './createSharedRecordClient'
import { firebaseApp } from './firebaseClient'

export const sharedRecordClient = createSharedRecordClient(
  getFirestore(firebaseApp),
)
