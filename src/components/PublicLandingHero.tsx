export default function PublicLandingHero() {
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
    </section>
  );
}
