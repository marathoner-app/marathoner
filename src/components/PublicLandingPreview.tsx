import { useEffect, useState, type FocusEvent } from "react";

type PreviewArea = "plan" | "track" | "analyze";

const previewAreas: PreviewArea[] = ["plan", "track", "analyze"];

const previewLabels: Record<PreviewArea, string> = {
  plan: "Plan",
  track: "Track",
  analyze: "Analyze",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function PlanPreview() {
  return (
    <div className="landing-preview__run-card">
      <div className="landing-preview__run-heading">
        <div>
          <p>Today&apos;s plan</p>
          <h3>Today · Easy run</h3>
        </div>
        <div className="landing-preview__distance">
          <strong>5.0 mi</strong>
          <span>planned distance</span>
        </div>
      </div>

      <p className="landing-preview__coach-note">
        Keep the effort conversational. Finishing steady matters more than pace.
      </p>

      <dl className="landing-preview__details">
        <div>
          <dt>Target effort</dt>
          <dd>Easy</dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd>6:30 AM</dd>
        </div>
        <div>
          <dt>Long-run day</dt>
          <dd>Sunday</dd>
        </div>
        <div>
          <dt>Training block</dt>
          <dd>Week 3 of 16</dd>
        </div>
      </dl>
    </div>
  );
}

function TrackPreview() {
  return (
    <div className="landing-preview__run-card">
      <div className="landing-preview__run-heading">
        <div>
          <p>Manual run log</p>
          <h3>Morning run</h3>
        </div>
        <div className="landing-preview__distance">
          <strong>5.0 mi</strong>
          <span>recorded distance</span>
        </div>
      </div>

      <div className="landing-preview__saved-state">
        <span aria-hidden="true">✓</span>
        Run recorded
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
  );
}

function AnalyzePreview() {
  return (
    <div className="landing-preview__run-card">
      <div className="landing-preview__run-heading">
        <div>
          <p>Weekly trend</p>
          <h3>Distance building steadily</h3>
        </div>
        <div className="landing-preview__distance">
          <strong>12.8 mi</strong>
          <span>of 20 mi this week</span>
        </div>
      </div>

      <div
        className="landing-preview__trend"
        role="img"
        aria-label="Weekly distance rises from 8 miles to 20 miles across four weeks"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </div>

      <dl className="landing-preview__details">
        <div>
          <dt>Runs complete</dt>
          <dd>3 of 4</dd>
        </div>
        <div>
          <dt>Longest run</dt>
          <dd>6.0 mi</dd>
        </div>
        <div>
          <dt>Easy effort</dt>
          <dd>2 runs</dd>
        </div>
        <div>
          <dt>Next session</dt>
          <dd>Rest day</dd>
        </div>
      </dl>
    </div>
  );
}

const previewPanels: Record<PreviewArea, () => JSX.Element> = {
  plan: PlanPreview,
  track: TrackPreview,
  analyze: AnalyzePreview,
};

export default function PublicLandingPreview() {
  const [activeArea, setActiveArea] = useState<PreviewArea>("plan");
  const [cursorArea, setCursorArea] = useState<PreviewArea>("plan");
  const [isClicking, setIsClicking] = useState(false);
  const [isTemporarilyPaused, setIsTemporarilyPaused] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setIsReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isReducedMotion || isManual || isTemporarilyPaused) return;

    const currentIndex = previewAreas.indexOf(activeArea);
    const nextArea = previewAreas[(currentIndex + 1) % previewAreas.length];
    const moveTimer = window.setTimeout(() => setCursorArea(nextArea), 1_400);
    const clickTimer = window.setTimeout(() => setIsClicking(true), 2_200);
    const selectTimer = window.setTimeout(() => {
      setActiveArea(nextArea);
      setIsClicking(false);
    }, 2_440);

    return () => {
      window.clearTimeout(moveTimer);
      window.clearTimeout(clickTimer);
      window.clearTimeout(selectTimer);
    };
  }, [activeArea, isManual, isReducedMotion, isTemporarilyPaused]);

  const selectArea = (area: PreviewArea) => {
    setIsManual(true);
    setIsClicking(false);
    setCursorArea(area);
    setActiveArea(area);
  };

  const resumeAfterFocusLeaves = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsTemporarilyPaused(false);
    }
  };

  const previewMode = isReducedMotion
    ? "reduced-motion"
    : isManual
      ? "manual"
      : isTemporarilyPaused
        ? "paused"
        : "automatic";

  return (
    <aside
      className="landing-preview"
      aria-labelledby="landing-preview-title"
      data-preview-mode={previewMode}
      onPointerEnter={() => setIsTemporarilyPaused(true)}
      onPointerLeave={() => setIsTemporarilyPaused(false)}
      onFocusCapture={() => setIsTemporarilyPaused(true)}
      onBlurCapture={resumeAfterFocusLeaves}
    >
      <div className="landing-preview__header">
        <span className="landing-preview__sample-badge">Sample data</span>
        <h2 id="landing-preview-title">
          See how one run connects to the rest of your training.
        </h2>
      </div>

      <div className="landing-preview__product-areas">
        <p>Explore the workflow</p>
        <div
          className="landing-preview__area-buttons"
          role="group"
          aria-label="Marathoner product areas"
        >
          {previewAreas.map((area) => (
            <button
              key={area}
              type="button"
              aria-pressed={activeArea === area}
              onClick={() => selectArea(area)}
            >
              {previewLabels[area]}
            </button>
          ))}
        </div>

        {!isReducedMotion && !isManual ? (
          <div
            className={`landing-preview__demo-cursor landing-preview__demo-cursor--${cursorArea}${isClicking ? " landing-preview__demo-cursor--clicking" : ""}`}
            aria-hidden="true"
            data-testid="landing-preview-cursor"
          >
            <svg viewBox="0 0 32 40" focusable="false">
              <path d="M3 2.75v28.7l7.2-6.35 5.35 11.75 5.2-2.35-5.15-11.3h10.15L3 2.75Z" />
            </svg>
            <span />
          </div>
        ) : null}
      </div>

      <div className="landing-preview__stage">
        {previewAreas.map((area) => {
          const PreviewPanel = previewPanels[area];
          const isActive = activeArea === area;

          return (
            <section
              key={area}
              className="landing-preview__panel"
              aria-hidden={!isActive}
              aria-label={`${previewLabels[area]} preview`}
              data-active={isActive}
            >
              <PreviewPanel />
            </section>
          );
        })}
      </div>

    </aside>
  );
}
