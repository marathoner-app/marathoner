import "./SignedInStartupScreen.css";

type SignedInStartupScreenProps = {
  readonly delayed?: boolean;
  readonly onRetry?: () => void;
};

export default function SignedInStartupScreen({
  delayed = false,
  onRetry,
}: SignedInStartupScreenProps) {
  return (
    <section
      className="signed-in-startup"
      aria-labelledby="signed-in-startup-title"
      aria-busy="true"
    >
      <div className="signed-in-startup-content">
        <h1 id="signed-in-startup-title">Marathoner</h1>
        <span className="signed-in-startup-spinner" aria-hidden="true" />
        <p className="signed-in-startup-status" role="status" aria-live="polite">
          {delayed
            ? "This is taking longer than usual. Check your connection."
            : "Preparing your training…"}
        </p>
        {delayed && (
          <div className="signed-in-startup-delay">
            {onRetry && (
              <button type="button" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
