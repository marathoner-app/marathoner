import { useEffect, useState } from "react";

export const trainingStartupNoticeDelayMs = 8_000;

export default function useDelayedTrainingStartupNotice(
  active: boolean,
  pendingSourceKey: string,
): boolean {
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    setDelayElapsed(false);
    if (!active) return;

    const timeout = window.setTimeout(() => {
      setDelayElapsed(true);
    }, trainingStartupNoticeDelayMs);

    return () => window.clearTimeout(timeout);
  }, [active, pendingSourceKey]);

  return active && delayElapsed;
}
