import { createRoot } from "react-dom/client";
import "../../src/index.css";
import Analyze from "../../src/components/Analyze";
import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
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
  createdAt: timestamp,
  updatedAt: timestamp,
};
const laterTimestamp = createUtcDateTime("2026-10-22T14:00:00Z");
const laterRun: CompletedRun = {
  ...run,
  id: createCompletedRunId("viewport-run-2"),
  startedAt: laterTimestamp,
  duration: createDurationSeconds(1_650),
  createdAt: laterTimestamp,
  updatedAt: laterTimestamp,
};

const root = document.querySelector("#root");
if (root === null) throw new Error("Analyze viewport fixture root was not found.");
createRoot(root).render(
  <Analyze
    runs={[laterRun, run]}
    shoes={[]}
    distanceUnit="kilometer"
    timeZone={timeZone}
    now={new Date("2026-10-21T18:00:00Z")}
  />,
);
