import { useEffect, useState } from "react";
import PublicLandingPreview from "./PublicLandingPreview";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PublicLandingHero() {
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion);
  const videoSource = `${import.meta.env.BASE_URL}landing/runner-hero.mp4`;
  const videoPoster = `${import.meta.env.BASE_URL}landing/runner-hero-poster.jpg`;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setIsReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

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
        </div>
      </div>
      <div className="landing-hero__media" aria-hidden="true">
        {isReducedMotion ? (
          <img
            className="landing-hero__video"
            src={videoPoster}
            alt=""
            data-testid="landing-hero-poster"
          />
        ) : (
          <video
            className="landing-hero__video"
            autoPlay
            loop
            muted
            playsInline
            poster={videoPoster}
            preload="metadata"
            data-testid="landing-hero-video"
          >
            <source src={videoSource} type="video/mp4" />
          </video>
        )}
      </div>
      <PublicLandingPreview />
    </section>
  );
}
