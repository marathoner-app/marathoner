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
          Log runs on your phone. Review the full plan on the web.
        </h2>
        <p>
          That is the intended split: a quick iPhone companion for viewing and
          recording workouts, with more room on the web for setup, history, and
          analysis. Public iOS access is not open yet.
        </p>
      </div>

      <div className="landing-platforms__cards">
        <article className="landing-platforms__card">
          <p className="landing-platforms__label">Intended daily companion</p>
          <h3>iPhone</h3>
          <p>
            Designed for viewing the next workout and recording manual
            completion, effort, notes, and shoes. Bounded adjustment decisions
            remain planned.
          </p>
          <p
            id="landing-platforms-ios-status"
            className="landing-platforms__status"
          >
            <strong>Current status:</strong> Public TestFlight invitations are not
            open. There is no public download or access-request path.
          </p>
          <a href="#access-status" aria-describedby="landing-platforms-ios-status">
            View current iOS status
          </a>
        </article>

        <article className="landing-platforms__card">
          <p className="landing-platforms__label">Current prototype access</p>
          <h3>Web</h3>
          <p>
            The responsive web experience is the larger space for intake, plan
            review, history, and detailed analysis. Existing account holders can
            sign in to the current prototype.
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
