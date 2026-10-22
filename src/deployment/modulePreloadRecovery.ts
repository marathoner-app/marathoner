const moduleRetryParameter = "_module_retry";

type RecoveryLocation = Pick<Location, "href" | "replace">;

type RecoveryWindow = Pick<
  Window,
  "addEventListener" | "removeEventListener"
> & {
  readonly location: RecoveryLocation;
};

type CreateModulePreloadRecoveryHandlerOptions = {
  readonly location: RecoveryLocation;
  readonly createRetryValue?: () => string;
};

export function createModulePreloadRecoveryHandler({
  location,
  createRetryValue = () => Date.now().toString(36),
}: CreateModulePreloadRecoveryHandlerOptions) {
  return (event: Event) => {
    const recoveryUrl = new URL(location.href);

    if (recoveryUrl.searchParams.has(moduleRetryParameter)) return;

    event.preventDefault();
    recoveryUrl.searchParams.set(moduleRetryParameter, createRetryValue());
    location.replace(recoveryUrl.toString());
  };
}

export function registerModulePreloadRecovery(
  browserWindow: RecoveryWindow = window,
) {
  const handlePreloadError = createModulePreloadRecoveryHandler({
    location: browserWindow.location,
  });

  browserWindow.addEventListener("vite:preloadError", handlePreloadError);

  return () => {
    browserWindow.removeEventListener("vite:preloadError", handlePreloadError);
  };
}
