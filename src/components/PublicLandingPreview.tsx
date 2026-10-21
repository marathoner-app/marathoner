export default function PublicLandingPreview() {
  return (
    <aside
      className="landing-preview"
      aria-labelledby="landing-preview-title"
      aria-describedby="landing-preview-boundary"
    >
      <div className="landing-preview__header">
        <div className="landing-preview__label-row">
          <p className="landing-preview__label">Illustrative product preview</p>
          <span className="landing-preview__sample-badge">Sample data</span>
        </div>
        <h2 id="landing-preview-title">One run, clearly recorded.</h2>
        <p id="landing-preview-boundary">
          Synthetic example only — not a live plan or training recommendation.
        </p>
      </div>

      <div className="landing-preview__product-areas">
        <p>Product areas</p>
        <ul aria-label="Marathoner product areas">
          <li>Plan</li>
          <li className="landing-preview__product-area--current">Track</li>
          <li>Analyze</li>
        </ul>
      </div>

      <div className="landing-preview__run-card">
        <div className="landing-preview__run-heading">
          <div>
            <p>Manual run log</p>
            <h3>Sample morning run</h3>
          </div>
          <div className="landing-preview__distance">
            <strong>5.0 mi</strong>
            <span>sample distance</span>
          </div>
        </div>

        <dl className="landing-preview__details">
          <div>
            <dt>Perceived effort</dt>
            <dd>Easy</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>Felt steady</dd>
          </div>
          <div>
            <dt>Shoes</dt>
            <dd>Daily trainer</dd>
          </div>
          <div>
            <dt>Shoe mileage</dt>
            <dd>214 mi logged</dd>
          </div>
        </dl>
      </div>

      <p className="landing-preview__data-note">
        This preview shows manually entered sample information. It does not show
        GPS, connected-device, or live account data.
      </p>
    </aside>
  );
}
