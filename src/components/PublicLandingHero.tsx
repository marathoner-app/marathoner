import LoginButton from "./LoginButton";

type PublicLandingHeroProps = {
  isLoginOpen: boolean;
  onLoginOpen: (trigger: HTMLButtonElement) => void;
};

export default function PublicLandingHero({
  isLoginOpen,
  onLoginOpen,
}: PublicLandingHeroProps) {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <p className="landing-hero__eyebrow">Built for first-time marathoners</p>
      <h1 id="landing-hero-title">
        Your first marathon. <span>One clear plan.</span>
      </h1>
      <p className="landing-hero__summary">
        Marathoner turns your race date, starting point, and real-life schedule
        into training you can understand and adjust.
      </p>
      <p className="landing-hero__promise">
        Reach the start line prepared, informed, and in control.
      </p>
      <div
        className="landing-hero__actions"
        role="group"
        aria-label="Marathoner access"
      >
        <div className="landing-hero__ios-status">
          <span className="landing-hero__platform">iOS beta</span>
          <p>
            <strong>Invitations are not open yet.</strong> No public waitlist or
            self-service request path is available.
          </p>
          <a href="#access-status">View current access</a>
        </div>
        <LoginButton
          isOpen={isLoginOpen}
          label="Log in on web"
          onOpen={onLoginOpen}
        />
      </div>
    </section>
  );
}
