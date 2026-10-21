import LoginButton from "./LoginButton";
import PublicLandingPreview from "./PublicLandingPreview";

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
      <div className="landing-hero__copy">
        <h1 id="landing-hero-title">Training for a marathon is enough work.</h1>
        <p className="landing-hero__summary">
          Marathoner brings your race date, weekly schedule, training plan, and
          completed runs into one place. It is built for first-time marathoners
          who want to understand what to do next and how each week leads to race
          day.
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
      </div>
      <PublicLandingPreview />
    </section>
  );
}
