import { lazy, Suspense, useRef, useState, type UIEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  calculatePace,
  calculateRecentRunEffortPattern,
  calculateRecentRunPaceTrend,
  calculateTrainingAnalytics,
  calculateWeeklyDistanceTrend,
  createDateOnly,
  createIanaTimeZone,
  metersToKilometers,
  metersToMiles,
  type CompletedRun,
  type DistanceMeters,
  type DistanceUnit,
  type IanaTimeZone,
  type Shoe,
} from "../domain/training";
import { formatPerceivedEffort } from "./perceivedEffort";
import RecentRunEffortPattern from "./RecentRunEffortPattern";

const WeeklyDistanceTrend = lazy(() => import("./WeeklyDistanceTrend"));
const RecentRunPaceTrend = lazy(() => import("./RecentRunPaceTrend"));

const ANALYZE_CARD_LABELS = [
  "Latest run",
  "Training summary",
  "Weekly distance",
  "Recent pace",
  "Recent effort",
] as const;

type AnalyzeProps = {
  readonly runs: readonly CompletedRun[];
  readonly shoes: readonly Shoe[];
  readonly distanceUnit: DistanceUnit;
  readonly timeZone?: IanaTimeZone;
  readonly now?: Date;
};

function findLatestRun(runs: readonly CompletedRun[]): CompletedRun | undefined {
  return runs.reduce<CompletedRun | undefined>((latest, run) => {
    if (latest === undefined) return run;

    const startedAtOrder = run.startedAt.localeCompare(latest.startedAt);
    if (startedAtOrder > 0) return run;
    if (startedAtOrder < 0) return latest;

    return run.id.localeCompare(latest.id) > 0 ? run : latest;
  }, undefined);
}

function formatRunDate(run: CompletedRun): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: run.timeZone,
  }).format(new Date(run.startedAt));
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

function currentTimeZone(): IanaTimeZone {
  return createIanaTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
}

function mondayFor(date: Date, timeZone: IanaTimeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const localDate = createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
  const monday = new Date(`${localDate}T00:00:00.000Z`);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return createDateOnly(monday.toISOString().slice(0, 10));
}

function formatDistance(distance: DistanceMeters, unit: DistanceUnit): string {
  const value = unit === "mile" ? metersToMiles(distance) : metersToKilometers(distance);
  return `${Number(value.toFixed(1))} ${unit === "mile" ? "mi" : "km"}`;
}

function formatPace(
  secondsPerUnit: number | undefined,
  unit: DistanceUnit,
): string {
  if (secondsPerUnit === undefined) return "Not enough data";
  const rounded = Math.round(secondsPerUnit);
  const minutes = Math.floor(rounded / 60);
  const seconds = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${seconds} /${unit === "mile" ? "mi" : "km"}`;
}

export default function Analyze({
  runs,
  shoes,
  distanceUnit,
  timeZone = currentTimeZone(),
  now = new Date(),
}: AnalyzeProps) {
  const reduceMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const currentWeekStart = mondayFor(now, timeZone);
  const analytics = calculateTrainingAnalytics(runs, currentWeekStart, distanceUnit);
  const weeklyDistance = calculateWeeklyDistanceTrend(runs, currentWeekStart, 8);
  const recentPace = calculateRecentRunPaceTrend(runs, distanceUnit, 8);
  const recentEffort = calculateRecentRunEffortPattern(runs, 8);
  const latestRun = findLatestRun(runs);
  const latestRunShoe = shoes.find((shoe) => shoe.id === latestRun?.shoeId);

  const showCard = (requestedIndex: number) => {
    const nextIndex = Math.min(
      Math.max(requestedIndex, 0),
      ANALYZE_CARD_LABELS.length - 1,
    );
    const carousel = carouselRef.current;
    const card = cardRefs.current[nextIndex];

    setActiveCardIndex(nextIndex);
    if (carousel === null || card === null) return;

    const carouselBounds = carousel.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    carousel.scrollTo?.({
      left: carousel.scrollLeft + cardBounds.left - carouselBounds.left,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const updateActiveCard = (event: UIEvent<HTMLDivElement>) => {
    const carousel = event.currentTarget;
    const carouselBounds = carousel.getBoundingClientRect();
    const nearestCard = cardRefs.current.reduce(
      (nearest, card, index) => {
        if (card === null) return nearest;
        const cardBounds = card.getBoundingClientRect();
        const visibleWidth = Math.max(
          0,
          Math.min(cardBounds.right, carouselBounds.right) -
            Math.max(cardBounds.left, carouselBounds.left),
        );
        return visibleWidth > nearest.visibleWidth
          ? { visibleWidth, index }
          : nearest;
      },
      { visibleWidth: 0, index: activeCardIndex },
    );

    if (nearestCard.index !== activeCardIndex) {
      setActiveCardIndex(nearestCard.index);
    }
  };

  return (
    <motion.div
      className="analyze-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.8 }}
    >
      <section className="analyze-carousel" aria-label="Training analysis">
        <div
          className="analyze-carousel-viewport"
          ref={carouselRef}
          onScroll={updateActiveCard}
        >
          <div
            className="analyze-slide"
            role="group"
            aria-label="1 of 5: Latest run"
            ref={(element) => {
              cardRefs.current[0] = element;
            }}
          >
            <section
              className="latest-run-summary"
              aria-labelledby="latest-run-heading"
            >
              <div>
                <p className="latest-run-eyebrow">Latest run</p>
                <h2 id="latest-run-heading">
                  {latestRun === undefined ? (
                    "No runs yet"
                  ) : (
                    <time dateTime={latestRun.startedAt}>
                      {formatRunDate(latestRun)}
                    </time>
                  )}
                </h2>
              </div>
              {latestRun === undefined ? (
                <p className="training-empty-state">
                  Log your first run to begin building your training picture.
                </p>
              ) : (
                <dl className="latest-run-details">
                  <div>
                    <dt>Distance</dt>
                    <dd>{formatDistance(latestRun.distance, distanceUnit)}</dd>
                  </div>
                  <div>
                    <dt>Elapsed time</dt>
                    <dd>{formatDuration(latestRun.duration)}</dd>
                  </div>
                  <div>
                    <dt>Pace</dt>
                    <dd>
                      {formatPace(
                        calculatePace(
                          latestRun.distance,
                          latestRun.duration,
                          distanceUnit,
                        )?.secondsPerUnit,
                        distanceUnit,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Shoe</dt>
                    <dd>{latestRunShoe?.name ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Perceived effort</dt>
                    <dd>{formatPerceivedEffort(latestRun.perceivedEffort)}</dd>
                  </div>
                  {latestRun.averageHeartRateBpm !== undefined && (
                    <div>
                      <dt>Average heart rate</dt>
                      <dd>{latestRun.averageHeartRateBpm} bpm</dd>
                    </div>
                  )}
                  {latestRun.maximumHeartRateBpm !== undefined && (
                    <div>
                      <dt>Maximum heart rate</dt>
                      <dd>{latestRun.maximumHeartRateBpm} bpm</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          </div>

          <div
            className="analyze-slide"
            role="group"
            aria-label="2 of 5: Training summary"
            ref={(element) => {
              cardRefs.current[1] = element;
            }}
          >
            <section
              className="analyze-summary"
              aria-labelledby="analyze-summary-heading"
            >
              <p className="analyze-summary-eyebrow">At a glance</p>
              <h2 id="analyze-summary-heading">Training summary</h2>
              <div className="analyze-cards">
                <div className="analyze-card">
                  <h3>Total Distance</h3>
                  <p>{formatDistance(analytics.totalDistance, distanceUnit)}</p>
                </div>
                <div className="analyze-card">
                  <h3>This Week</h3>
                  <p>{formatDistance(analytics.weeklyDistance, distanceUnit)}</p>
                </div>
                <div className="analyze-card">
                  <h3>Average Pace</h3>
                  <p>
                    {formatPace(
                      analytics.averagePace?.secondsPerUnit,
                      distanceUnit,
                    )}
                  </p>
                </div>
                <div className="analyze-card">
                  <h3>Total Runs</h3>
                  <p>{analytics.totalRuns}</p>
                </div>
                <div className="analyze-card">
                  <h3>Runs This Week</h3>
                  <p>{analytics.runsThisWeek}</p>
                </div>
              </div>
            </section>
          </div>

          <div
            className="analyze-slide"
            role="group"
            aria-label="3 of 5: Weekly distance"
            ref={(element) => {
              cardRefs.current[2] = element;
            }}
          >
            <Suspense
              fallback={
                <p className="training-status" role="status">
                  Loading weekly distance chart...
                </p>
              }
            >
              <WeeklyDistanceTrend
                buckets={weeklyDistance}
                distanceUnit={distanceUnit}
                isCarouselCardActive={activeCardIndex === 2}
              />
            </Suspense>
          </div>

          <div
            className="analyze-slide"
            role="group"
            aria-label="4 of 5: Recent pace"
            ref={(element) => {
              cardRefs.current[3] = element;
            }}
          >
            <Suspense
              fallback={
                <p className="training-status" role="status">
                  Loading recent pace chart...
                </p>
              }
            >
              <RecentRunPaceTrend
                points={recentPace}
                distanceUnit={distanceUnit}
                isCarouselCardActive={activeCardIndex === 3}
              />
            </Suspense>
          </div>

          <div
            className="analyze-slide"
            role="group"
            aria-label="5 of 5: Recent effort"
            ref={(element) => {
              cardRefs.current[4] = element;
            }}
          >
            <RecentRunEffortPattern points={recentEffort} />
          </div>
        </div>

        <div className="analyze-carousel-controls">
          <button
            type="button"
            className="analyze-carousel-arrow"
            aria-label="Previous analysis card"
            disabled={activeCardIndex === 0}
            onClick={() => showCard(activeCardIndex - 1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <div className="analyze-carousel-position">
            <p className="analyze-carousel-status" aria-live="polite">
              {ANALYZE_CARD_LABELS[activeCardIndex]} · {activeCardIndex + 1} of{" "}
              {ANALYZE_CARD_LABELS.length}
            </p>
            <div className="analyze-carousel-dots" aria-label="Choose analysis card">
              {ANALYZE_CARD_LABELS.map((label, index) => (
                <button
                  type="button"
                  className="analyze-carousel-dot"
                  aria-label={`Show ${label} card`}
                  aria-current={index === activeCardIndex ? "true" : undefined}
                  key={label}
                  onClick={() => showCard(index)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="analyze-carousel-arrow"
            aria-label="Next analysis card"
            disabled={activeCardIndex === ANALYZE_CARD_LABELS.length - 1}
            onClick={() => showCard(activeCardIndex + 1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    </motion.div>
  );
}
