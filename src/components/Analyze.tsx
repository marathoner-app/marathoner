import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
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
} from "../domain/training";

const WeeklyDistanceTrend = lazy(() => import("./WeeklyDistanceTrend"));

type AnalyzeProps = {
  readonly runs: readonly CompletedRun[];
  readonly distanceUnit: DistanceUnit;
  readonly timeZone?: IanaTimeZone;
  readonly now?: Date;
};

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
  distanceUnit,
  timeZone = currentTimeZone(),
  now = new Date(),
}: AnalyzeProps) {
  const currentWeekStart = mondayFor(now, timeZone);
  const analytics = calculateTrainingAnalytics(runs, currentWeekStart, distanceUnit);
  const weeklyDistance = calculateWeeklyDistanceTrend(runs, currentWeekStart, 8);

  return (
    <motion.div
      className="analyze-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {runs.length === 0 && (
        <p className="training-empty-state">
          Log your first run to begin building your training picture.
        </p>
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
    </motion.div>
  );
}
