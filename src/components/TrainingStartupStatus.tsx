import type { TrainingSnapshotSource } from "../training/trainingSynchronization";

type TrainingStartupStatusProps = {
  readonly pendingSources: readonly TrainingSnapshotSource[];
  readonly delayed: boolean;
  readonly hasReadableSnapshot: boolean;
  readonly onRetry: () => void;
  readonly className?: string;
};

function pendingDescription(
  pendingSources: readonly TrainingSnapshotSource[],
): string {
  const secondarySources = pendingSources.filter(
    (source) => source === "runs" || source === "shoes",
  );
  if (secondarySources.length !== pendingSources.length) {
    return "your training data";
  }
  if (secondarySources.length === 2) return "your run history and shoes";
  if (secondarySources[0] === "runs") return "your run history";
  if (secondarySources[0] === "shoes") return "your shoes";
  return "your training data";
}

export default function TrainingStartupStatus({
  pendingSources,
  delayed,
  hasReadableSnapshot,
  onRetry,
  className = "training-home-status",
}: TrainingStartupStatusProps) {
  const description = pendingDescription(pendingSources);

  return (
    <div className={`${className} training-startup-status`} role="status">
      <p>
        {hasReadableSnapshot
          ? `Your plan is ready. Marathoner is still loading ${description}.`
          : `Loading ${description}…`}
      </p>
      {delayed && (
        <>
          <p>
            This is taking longer than usual. Check your connection, then try
            again.
          </p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
