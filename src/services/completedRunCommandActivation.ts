interface CompletedRunCommandActivationOptions {
  readonly requested: string | undefined;
  readonly liveActivationApproved: boolean;
}

export function resolveCompletedRunCommandsEnabled({
  requested,
  liveActivationApproved,
}: CompletedRunCommandActivationOptions): boolean {
  const normalized = requested?.trim().toLowerCase();

  if (!normalized || normalized === "false") return false;

  if (normalized !== "true") {
    throw new Error(
      'VITE_COMPLETED_RUN_COMMANDS_ENABLED must be either "true" or "false".',
    );
  }

  if (!liveActivationApproved) {
    throw new Error(
      "Completed-run commands cannot be enabled until issue #347 records a passing live create/delete smoke test and rollback rehearsal.",
    );
  }

  return true;
}

// Keep deployed and native builds fail-closed until the live activation issue
// records the evidence required to change this reviewed constant.
const liveActivationApproved = false;

export const completedRunCommandsEnabled =
  resolveCompletedRunCommandsEnabled({
    requested: import.meta.env.VITE_COMPLETED_RUN_COMMANDS_ENABLED,
    liveActivationApproved,
  });
