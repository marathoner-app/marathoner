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
      "Completed-run commands cannot be enabled without reviewed live activation approval.",
    );
  }

  return true;
}

// Issue #347 recorded the owner-development live create/delete and rollback
// rehearsal. This approves eligibility only: checked-in environments still
// request false, and the server retains its project, runtime-flag, Auth,
// membership, App Check, version, ownership, and revision gates.
const liveActivationApproved = true;

export const completedRunCommandsEnabled =
  resolveCompletedRunCommandsEnabled({
    requested: import.meta.env.VITE_COMPLETED_RUN_COMMANDS_ENABLED,
    liveActivationApproved,
  });
