import { lazy, Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  calculatePace,
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

const WeeklyDistanceTrend = lazy(() => import("./WeeklyDistanceTrend"));
const RecentRunPaceTrend = lazy(() => import("./RecentRunPaceTrend"));

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
  const currentWeekStart = mondayFor(now, timeZone);
  const analytics = calculateTrainingAnalytics(runs, currentWeekStart, distanceUnit);
  const weeklyDistance = calculateWeeklyDistanceTrend(runs, currentWeekStart, 8);
  const recentPace = calculateRecentRunPaceTrend(runs, distanceUnit, 8);
  const latestRun = findLatestRun(runs);
  const latestRunShoe = shoes.find((shoe) => shoe.id === latestRun?.shoeId);

  return (
    <motion.div
      className="analyze-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.8 }}
    >
      {runs.length === 0 && (
        <p className="training-empty-state">
          Log your first run to begin building your training picture.
        </p>
      )}
      {latestRun !== undefined && (
        <section className="latest-run-summary" aria-labelledby="latest-run-heading">
          <div>
            <p className="latest-run-eyebrow">Latest run</p>
            <h2 id="latest-run-heading">
              <time dateTime={latestRun.startedAt}>{formatRunDate(latestRun)}</time>
            </h2>
          </div>
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
          </dl>
        </section>
      )}
      <div className="analyze-cards">
        <div className="analyze-card">
          <h2>Total Distance</h2>
          <p>{formatDistance(analytics.totalDistance, distanceUnit)}</p>
        </div>
        <div className="analyze-card">
          <h2>This Week</h2>
          <p>{formatDistance(analytics.weeklyDistance, distanceUnit)}</p>
        </div>
        <div className="analyze-card">
          <h2>Average Pace</h2>
          <p>{formatPace(analytics.averagePace?.secondsPerUnit, distanceUnit)}</p>
        </div>
        <div className="analyze-card">
          <h2>Total Runs</h2>
          <p>{analytics.totalRuns}</p>
        </div>
        <div className="analyze-card">
          <h2>Runs This Week</h2>
          <p>{analytics.runsThisWeek}</p>
        </div>
      </div>
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
        />
      </Suspense>
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
        />
      </Suspense>
    </motion.div>
  );
}
