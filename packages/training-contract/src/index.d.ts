declare const completedRunIdBrand: unique symbol;
declare const distanceMetersBrand: unique symbol;

export type CompletedRunId = string & {
  readonly [completedRunIdBrand]: 'CompletedRun';
};

export type DistanceMeters = number & {
  readonly [distanceMetersBrand]: 'DistanceMeters';
};

export declare const METERS_PER_MILE: 1609.344;

export declare function isCompletedRunIdValue(
  value: unknown,
): value is CompletedRunId;

export declare function createCompletedRunId(value: string): CompletedRunId;

export declare function createDistanceMeters(value: number): DistanceMeters;

export declare function milesToMeters(miles: number): DistanceMeters;

export declare function metersToMiles(meters: DistanceMeters): number;
