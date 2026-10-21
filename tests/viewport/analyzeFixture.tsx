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

const root = document.querySelector("#root");
if (root === null) throw new Error("Analyze viewport fixture root was not found.");
createRoot(root).render(
  <Analyze
    runs={[run]}
    distanceUnit="kilometer"
    timeZone={timeZone}
    now={new Date("2026-10-21T18:00:00Z")}
  />,
);
