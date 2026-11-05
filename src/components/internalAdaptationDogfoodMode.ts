export interface InternalAdaptationDogfoodEnvironment {
  readonly firebaseEnvironment: string | undefined;
  readonly provisionalPlanDogfood: string | undefined;
}

export function isInternalAdaptationDogfoodEnabled({
  firebaseEnvironment,
  provisionalPlanDogfood,
}: InternalAdaptationDogfoodEnvironment): boolean {
  return (
    firebaseEnvironment === "development" &&
    provisionalPlanDogfood === "true"
  );
}
