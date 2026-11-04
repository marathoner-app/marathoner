type PublicAccessNoticeProps = {
  supportEmail?: string;
};

export default function PublicAccessNotice({
  supportEmail,
}: PublicAccessNoticeProps) {
  const supportHref = supportEmail
    ? `mailto:${supportEmail}?subject=${encodeURIComponent("Marathoner account support request")}`
    : null;

  return (
    <section className="public-access" aria-labelledby="public-access-title">
      <p className="public-access-status">Private prototype</p>
      <h2 id="public-access-title">New account registration is closed.</h2>
      <p className="public-access-summary">
        Marathoner is still being built and is not a production coaching
        service. Its training methodology and safety guidance have not yet
        received qualified approval. Do not use this prototype for medical,
        injury, nutrition, or training decisions.
      </p>

      <nav className="trust-navigation" aria-label="Prototype trust information">
        <a href="#access-status">Access</a>
        <a href="#privacy-data-use">Privacy and data</a>
        <a href="#support-requests">Support and deletion</a>
      </nav>

      <div className="trust-grid">
        <section id="access-status" aria-labelledby="access-status-title">
          <h3 id="access-status-title">Current access</h3>
          <p>
            There is no public signup, waitlist, or open beta. Existing
            account holders may sign in. Future invitations will be limited to
            a small allowlisted group of adults who already run consistently
            and are preparing for a first marathon.
          </p>
        </section>

        <section id="privacy-data-use" aria-labelledby="privacy-data-use-title">
          <h3 id="privacy-data-use-title">Privacy and data use</h3>
          <p>
            Existing accounts use Firebase Authentication. Email addresses and
            training records entered or imported in the prototype are stored
            through Google Firebase and Google Cloud. Those are the only
            third-party services that process imported workout data.
          </p>
          <p>
            With explicit permission, the iPhone app can import completed
            running workouts from Apple Health. Marathoner limits those imports
            to the workout source, date and time, distance, duration, and the
            identifiers needed to avoid duplicates. It does not write to Apple
            Health or import all-day health data. Direct Garmin import is not
            enabled yet.
          </p>
          <p>
            Marathoner does not sell personal or workout data, use it for
            advertising, or process imported workout data with an AI or
            machine-learning system. Do not enter another person&apos;s
            information.
          </p>
        </section>

        <section id="support-requests" aria-labelledby="support-requests-title">
          <h3 id="support-requests-title">Support, withdrawal, and deletion</h3>
          {supportHref ? (
            <p>
              Existing account holders can{" "}
              <a href={supportHref}>email Marathoner support</a> to ask a
              question; request access to, correction of, or export of their
              training data; withdraw permission for future imports; withdraw
              from future research; or initiate account and training-data
              deletion. Send the request from the account email when possible.
              Never include a password or unnecessary health or training
              details.
            </p>
          ) : (
            <p role="status">
              A monitored support address is not yet published. New access
              remains closed until a private support and deletion-request path
              is available.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
