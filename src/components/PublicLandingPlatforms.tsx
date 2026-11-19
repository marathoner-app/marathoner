import LoginButton from "./LoginButton";

type PublicLandingPlatformsProps = {
  isLoginOpen: boolean;
  onLoginOpen: (trigger: HTMLButtonElement) => void;
};

export default function PublicLandingPlatforms({
  isLoginOpen,
  onLoginOpen,
}: PublicLandingPlatformsProps) {
  return (
    <section
      className="landing-platforms"
      aria-labelledby="landing-platforms-title"
    >
      <div className="landing-platforms__intro">
        <p className="landing-platforms__eyebrow">Where Marathoner fits</p>
        <h2 id="landing-platforms-title">
          Keep up with training on your phone. See the full picture on the web.
        </h2>
        <p>
          The iPhone companion is built for the daily loop and Apple Health
          imports. The responsive web experience leaves more room for setup,
          Garmin connection, history, and analysis. Private iOS beta access is
          invitation-only.
        </p>
      </div>

      <div className="landing-platforms__cards">
        <article className="landing-platforms__card">
          <p className="landing-platforms__label">Intended daily companion</p>
          <h3>iPhone</h3>
          <p>
            Designed for viewing the next workout, importing completed runs
            from Apple Health, and adding effort, notes, shoes, and plan
            matches. Manual entry remains a fallback.
          </p>
          <p
            id="landing-platforms-ios-status"
            className="landing-platforms__status"
          >
            <strong>Current status:</strong> Private founding beta testing is
            underway. Invitations are limited and sent directly; there is no
            public download link.
          </p>
          <a href="#access-status" aria-describedby="landing-platforms-ios-status">
            View beta access details
          </a>
        </article>

        <article className="landing-platforms__card">
          <p className="landing-platforms__label">Existing tester access</p>
          <h3>Web</h3>
          <p>
            The responsive web experience is the larger space for intake, plan
            review, history, and detailed analysis. Existing invited testers can
            sign in to the current beta.
          </p>
          <p
            id="landing-platforms-web-status"
            className="landing-platforms__status"
          >
            <strong>Available now:</strong> Existing-account login only. New
            registration remains closed.
          </p>
          <LoginButton
            describedBy="landing-platforms-web-status"
            isOpen={isLoginOpen}
            label="Log in on web"
            onOpen={onLoginOpen}
          />
        </article>
      </div>
    </section>
  );
}
