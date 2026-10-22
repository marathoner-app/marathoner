import { useEffect, useState } from "react";

export const staleNoticeDelayMs = 5_000;

export default function useDelayedStaleNotice(
  shouldShowNotice: boolean,
): boolean {
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    setDelayElapsed(false);
    if (!shouldShowNotice) return;

    const timeout = window.setTimeout(() => {
      setDelayElapsed(true);
    }, staleNoticeDelayMs);

    return () => window.clearTimeout(timeout);
  }, [shouldShowNotice]);

  return shouldShowNotice && delayElapsed;
}
