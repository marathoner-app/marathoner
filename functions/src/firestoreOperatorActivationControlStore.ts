import { isDeepStrictEqual } from 'node:util'

import type { DocumentData, Firestore } from 'firebase-admin/firestore'

import {
  validateOperatorActivationControl,
  type OperatorActivationControlV1,
} from '../../src/domain/recommendations/recommendationEvidence.js'

export const OPERATOR_ACTIVATION_CONTROL_PATH =
  'operatorControls/recommendationActivation'

export type OperatorActivationControlStoreErrorCode =
  | 'control-not-found'
  | 'control-conflict'
  | 'invalid-control'
  | 'invalid-revision-transition'
  | 'invalid-update-time'
  | 'stored-control-invalid'

export class OperatorActivationControlStoreError extends Error {
  constructor(readonly code: OperatorActivationControlStoreErrorCode) {
    super(`Operator activation-control persistence failed: ${code}.`)
  }
}

function assertValidControl(
  value: unknown,
): asserts value is OperatorActivationControlV1 {
  if (validateOperatorActivationControl(value).length > 0) {
    throw new OperatorActivationControlStoreError('invalid-control')
  }
}

function parseStoredControl(
  data: DocumentData | undefined,
): OperatorActivationControlV1 {
  if (data === undefined) {
    throw new OperatorActivationControlStoreError('control-not-found')
  }
  if (validateOperatorActivationControl(data).length > 0) {
    throw new OperatorActivationControlStoreError('stored-control-invalid')
  }
  return data as OperatorActivationControlV1
}

export class FirestoreOperatorActivationControlStore {
  constructor(private readonly database: Firestore) {}

  async read(): Promise<OperatorActivationControlV1> {
    const snapshot = await this.database
      .doc(OPERATOR_ACTIVATION_CONTROL_PATH)
      .get()
    return parseStoredControl(snapshot.data())
  }

  async replace(options: {
    control: OperatorActivationControlV1
    expectedRevision: number | null
  }): Promise<OperatorActivationControlV1> {
    assertValidControl(options.control)
    const reference = this.database.doc(OPERATOR_ACTIVATION_CONTROL_PATH)

    return this.database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference)
      if (!snapshot.exists) {
        if (
          options.expectedRevision !== null ||
          options.control.revision !== 1
        ) {
          throw new OperatorActivationControlStoreError(
            'invalid-revision-transition',
          )
        }
        transaction.create(reference, options.control)
        return options.control
      }

      const stored = parseStoredControl(snapshot.data())
      if (isDeepStrictEqual(stored, options.control)) return stored
      if (options.expectedRevision !== stored.revision) {
        throw new OperatorActivationControlStoreError('control-conflict')
      }
      if (options.control.revision !== stored.revision + 1) {
        throw new OperatorActivationControlStoreError(
          'invalid-revision-transition',
        )
      }
      if (Date.parse(options.control.updatedAt) <= Date.parse(stored.updatedAt)) {
        throw new OperatorActivationControlStoreError('invalid-update-time')
      }

      transaction.set(reference, options.control)
      return options.control
    })
  }
}
