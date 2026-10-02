declare const completedRunIdBrand: unique symbol;
declare const distanceMetersBrand: unique symbol;

export type CompletedRunId = string & {
  readonly [completedRunIdBrand]: 'CompletedRun';
};

export type DistanceMeters = number & {
  readonly [distanceMetersBrand]: 'DistanceMeters';
};

export type SharedRecordProofSource = 'web' | 'capacitor' | 'expo';

export interface SharedRecordProof {
  readonly schemaVersion: 1;
  readonly recordType: 'shared_training_record_proof';
  readonly userId: string;
  readonly sampleRunId: CompletedRunId;
  readonly distanceMeters: DistanceMeters;
  readonly sourceClient: SharedRecordProofSource;
}

export declare const METERS_PER_MILE: 1609.344;
export declare const SHARED_RECORD_PROOF_SCHEMA_VERSION: 1;
export declare const SHARED_RECORD_PROOF_COLLECTION: 'mobileSpikeProofs';
export declare const SHARED_RECORD_PROOF_DOCUMENT_ID: 'issue-87-shared-record';
export declare const SHARED_RECORD_PROOF_TYPE: 'shared_training_record_proof';
export declare const SHARED_RECORD_PROOF_RUN_ID: 'issue-87-sample-run';
export declare const SHARED_RECORD_PROOF_DISTANCE_METERS: 5000;

export declare function isCompletedRunIdValue(
  value: unknown,
): value is CompletedRunId;

export declare function createCompletedRunId(value: string): CompletedRunId;

export declare function createDistanceMeters(value: number): DistanceMeters;

export declare function milesToMeters(miles: number): DistanceMeters;

export declare function metersToMiles(meters: DistanceMeters): number;

export declare function isSharedRecordProofSource(
  value: unknown,
): value is SharedRecordProofSource;

export declare function sharedRecordProofDocumentPath(userId: string): string;

export declare function createSharedRecordProof(
  userId: string,
  sourceClient: SharedRecordProofSource,
): SharedRecordProof;

export declare function parseSharedRecordProof(
  value: unknown,
): SharedRecordProof;
