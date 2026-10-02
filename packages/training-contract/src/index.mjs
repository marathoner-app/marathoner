export const METERS_PER_MILE = 1609.344;
export const SHARED_RECORD_PROOF_SCHEMA_VERSION = 1;
export const SHARED_RECORD_PROOF_COLLECTION = 'mobileSpikeProofs';
export const SHARED_RECORD_PROOF_DOCUMENT_ID = 'issue-87-shared-record';
export const SHARED_RECORD_PROOF_TYPE = 'shared_training_record_proof';
export const SHARED_RECORD_PROOF_RUN_ID = 'issue-87-sample-run';
export const SHARED_RECORD_PROOF_DISTANCE_METERS = 5000;

const sharedRecordProofSources = Object.freeze(['web', 'capacitor', 'expo']);
const sharedRecordProofFields = Object.freeze([
  'schemaVersion',
  'recordType',
  'userId',
  'sampleRunId',
  'distanceMeters',
  'sourceClient',
]);

export function isCompletedRunIdValue(value) {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes('/')
  );
}

export function createCompletedRunId(value) {
  if (!isCompletedRunIdValue(value)) {
    throw new Error(
      'CompletedRun identifier must be non-empty and cannot contain slashes.',
    );
  }

  return value;
}

export function createDistanceMeters(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Distance must be a non-negative whole number of meters.');
  }

  return value;
}

export function milesToMeters(miles) {
  if (!Number.isFinite(miles) || miles < 0) {
    throw new Error('Miles must be a non-negative number.');
  }

  return createDistanceMeters(Math.round(miles * METERS_PER_MILE));
}

export function metersToMiles(meters) {
  return meters / METERS_PER_MILE;
}

export function isSharedRecordProofSource(value) {
  return sharedRecordProofSources.includes(value);
}

export function sharedRecordProofDocumentPath(userId) {
  assertPathIdentifier(userId, 'User');

  return `users/${userId}/${SHARED_RECORD_PROOF_COLLECTION}/${SHARED_RECORD_PROOF_DOCUMENT_ID}`;
}

export function createSharedRecordProof(userId, sourceClient) {
  assertPathIdentifier(userId, 'User');

  if (!isSharedRecordProofSource(sourceClient)) {
    throw new Error('Shared record proof source is unsupported.');
  }

  return {
    schemaVersion: SHARED_RECORD_PROOF_SCHEMA_VERSION,
    recordType: SHARED_RECORD_PROOF_TYPE,
    userId,
    sampleRunId: createCompletedRunId(SHARED_RECORD_PROOF_RUN_ID),
    distanceMeters: createDistanceMeters(
      SHARED_RECORD_PROOF_DISTANCE_METERS,
    ),
    sourceClient,
  };
}

export function parseSharedRecordProof(value) {
  if (!isRecord(value) || !hasExactlySharedRecordProofFields(value)) {
    throw new Error('Stored shared record proof has an invalid shape.');
  }

  const expected = createSharedRecordProof(value.userId, value.sourceClient);

  if (
    value.schemaVersion !== expected.schemaVersion ||
    value.recordType !== expected.recordType ||
    value.sampleRunId !== expected.sampleRunId ||
    value.distanceMeters !== expected.distanceMeters
  ) {
    throw new Error('Stored shared record proof has unsupported values.');
  }

  return expected;
}

function assertPathIdentifier(value, entityName) {
  if (!isCompletedRunIdValue(value)) {
    throw new Error(
      `${entityName} identifier must be non-empty and cannot contain slashes.`,
    );
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlySharedRecordProofFields(value) {
  const fields = Object.keys(value);

  return (
    fields.length === sharedRecordProofFields.length &&
    fields.every((field) => sharedRecordProofFields.includes(field))
  );
}
