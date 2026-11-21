import { createRoot } from "react-dom/client";
import "../../src/index.css";
import Analyze from "../../src/components/Analyze";
import SignedInAppHeader from "../../src/components/SignedInAppHeader";
import TrainingSectionNavigation from "../../src/components/TrainingSectionNavigation";
import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createHeartRateBpm,
  createIanaTimeZone,
  createShoeId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type PerceivedEffort,
  type Shoe,
} from "../../src/domain/training";

const timeZone = createIanaTimeZone("America/Los_Angeles");
const timestamp = createUtcDateTime("2026-10-21T14:00:00Z");
const run: CompletedRun = {
  id: createCompletedRunId("viewport-run-1"),
  userId: createUserId("viewport-runner"),
  startedAt: timestamp,
  timeZone,
  distance: createDistanceMeters(5_000),
  duration: createDurationSeconds(1_800),
  perceivedEffort: "about_right",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const laterTimestamp = createUtcDateTime("2026-10-22T14:00:00Z");
const laterRun: CompletedRun = {
  ...run,
  id: createCompletedRunId("viewport-run-2"),
  startedAt: laterTimestamp,
  duration: createDurationSeconds(1_650),
  perceivedEffort: "harder_than_expected",
  createdAt: laterTimestamp,
  updatedAt: laterTimestamp,
};

function dashboardRun(
  id: string,
  startedAt: string,
  distanceMeters: number,
  durationSeconds: number,
  perceivedEffort: PerceivedEffort | undefined,
  averageHeartRate: number,
): CompletedRun {
  const timestamp = createUtcDateTime(startedAt);
  return {
    id: createCompletedRunId(id),
    userId: createUserId("viewport-runner"),
    startedAt: timestamp,
    timeZone,
    distance: createDistanceMeters(distanceMeters),
    duration: createDurationSeconds(durationSeconds),
    shoeId: createShoeId("viewport-daily-trainer"),
    perceivedEffort,
    averageHeartRateBpm: createHeartRateBpm(averageHeartRate),
    maximumHeartRateBpm: createHeartRateBpm(averageHeartRate + 21),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const dashboardRuns: readonly CompletedRun[] = [
  dashboardRun(
    "viewport-dashboard-1",
    "2026-10-22T14:00:00Z",
    10_000,
    3_270,
    "about_right",
    151,
  ),
  dashboardRun(
    "viewport-dashboard-2",
    "2026-10-15T14:00:00Z",
    8_000,
    2_700,
    "easier_than_expected",
    146,
  ),
  dashboardRun(
    "viewport-dashboard-3",
    "2026-10-08T14:00:00Z",
    12_000,
    4_170,
    "harder_than_expected",
    158,
  ),
  dashboardRun(
    "viewport-dashboard-4",
    "2026-10-01T14:00:00Z",
    6_000,
    2_160,
    "about_right",
    149,
  ),
  dashboardRun(
    "viewport-dashboard-5",
    "2026-09-24T14:00:00Z",
    15_000,
    5_280,
    "much_harder_than_expected",
    161,
  ),
  dashboardRun(
    "viewport-dashboard-6",
    "2026-09-17T14:00:00Z",
    7_000,
    2_580,
    "about_right",
    147,
  ),
  dashboardRun(
    "viewport-dashboard-7",
    "2026-09-10T14:00:00Z",
    16_000,
    5_640,
    "easier_than_expected",
    153,
  ),
  dashboardRun(
    "viewport-dashboard-8",
    "2026-09-03T14:00:00Z",
    5_000,
    1_920,
    undefined,
    144,
  ),
];

const dashboardShoe: Shoe = {
  id: createShoeId("viewport-daily-trainer"),
  userId: createUserId("viewport-runner"),
  name: "Daily trainer",
  startingDistance: createDistanceMeters(0),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const search = new URLSearchParams(window.location.search);
const useDashboardData = search.get("mode") === "dashboard";
const useSignedInShell = search.get("shell") === "1";
const analyze = (
  <Analyze
    runs={useDashboardData ? dashboardRuns : [laterRun, run]}
    shoes={useDashboardData ? [dashboardShoe] : []}
    distanceUnit="kilometer"
    timeZone={timeZone}
    now={new Date("2026-10-23T18:00:00Z")}
  />
);

const root = document.querySelector("#root");
if (root === null) throw new Error("Analyze viewport fixture root was not found.");
createRoot(root).render(
  useSignedInShell ? (
    <main className="main">
      <SignedInAppHeader
        email="runner@example.com"
        onOpenAccountSettings={() => undefined}
        onLogout={() => undefined}
      />
      <TrainingSectionNavigation
        activeSection="analyze"
        onSelectHome={() => undefined}
        onSelect={() => undefined}
      />
      <section
        className="section-panel section-panel--analyze"
        aria-label="Analyze"
      >
        <div className="section-panel-content section-panel-content--analyze">
          {analyze}
        </div>
      </section>
    </main>
  ) : (
    analyze
  ),
);
