export default function PublicLandingHowItWorks() {
  return (
    <section
      className="landing-how-it-works"
      aria-labelledby="landing-how-it-works-title"
    >
      <div className="landing-how-it-works__intro">
        <p className="landing-how-it-works__eyebrow">How Marathoner works</p>
        <h2 id="landing-how-it-works-title">
          Start with the week you can actually train.
        </h2>
        <p>
          Tell Marathoner when you can run, which day works for your long run,
          and what race you are preparing for. The current prototype turns
          those details into an initial plan and records what you complete.
          Guided adjustments are still planned.
        </p>
      </div>

      <div className="landing-how-it-works__cards">
        <article className="landing-how-it-works__card">
          <div className="landing-how-it-works__card-heading">
            <span aria-hidden="true">01</span>
            <p className="landing-how-it-works__status">Current prototype</p>
          </div>
          <h3>Plan around your life</h3>
          <p>
            Start with your race date, experience, available days, and preferred
            long-run day so an initial plan can reflect the week you can actually
            train.
          </p>
          <p className="landing-how-it-works__boundary">
            <strong>Current boundary:</strong> The training methodology still
            requires qualified review before beta coaching use.
          </p>
        </article>

        <article className="landing-how-it-works__card">
          <div className="landing-how-it-works__card-heading">
            <span aria-hidden="true">02</span>
            <p className="landing-how-it-works__status">Current + planned</p>
          </div>
          <h3>Track what matters</h3>
          <p>
            <strong>Current prototype:</strong> Log completed runs, perceived
            effort, notes, and shoes without a social feed.
          </p>
          <p className="landing-how-it-works__boundary">
            <strong>Planned:</strong> Add fueling, hydration, sleep, and recovery
            inputs.
          </p>
        </article>

        <article className="landing-how-it-works__card">
          <div className="landing-how-it-works__card-heading">
            <span aria-hidden="true">03</span>
            <p className="landing-how-it-works__status">Planned workflow</p>
          </div>
          <h3>Adjust with confidence</h3>
          <p>
            Future bounded suggestions may reschedule, hold, or repeat training,
            explain why, and ask for your approval before a meaningful plan
            change.
          </p>
          <p className="landing-how-it-works__boundary">
            <strong>Not available today:</strong> Marathoner does not currently
            recommend or apply training adjustments.
          </p>
        </article>
      </div>
    </section>
  );
}
