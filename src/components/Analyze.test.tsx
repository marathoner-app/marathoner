import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createShoeId,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type DistanceUnit,
  type RecentRunPacePoint,
  type Shoe,
  type WeeklyDistanceBucket,
} from "../domain/training";
import Analyze from "./Analyze";

vi.mock("framer-motion", () => ({
  motion: { div: "div" },
  useReducedMotion: () => false,
}));
vi.mock("./WeeklyDistanceTrend", () => ({
  default: ({
    buckets,
    distanceUnit,
  }: {
    buckets: readonly WeeklyDistanceBucket[];
    distanceUnit: DistanceUnit;
  }) => (
    <div data-testid="weekly-distance-trend">
      {distanceUnit}:{buckets.at(-1)?.distance ?? 0}
    </div>
  ),
}));
vi.mock("./RecentRunPaceTrend", () => ({
  default: ({
    points,
    distanceUnit,
  }: {
    points: readonly RecentRunPacePoint[];
    distanceUnit: DistanceUnit;
  }) => (
    <div data-testid="recent-pace-trend">
      {distanceUnit}:{points.map((point) => Math.round(point.pace.secondsPerUnit)).join(",")}
    </div>
  ),
}));

const timestamp = createUtcDateTime("2026-08-05T14:00:00Z");
const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: createUserId("runner-1"),
  startedAt: timestamp,
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  distance: createDistanceMeters(8_047),
  duration: createDurationSeconds(2_400),
  shoeId: createShoeId("shoe-1"),
  perceivedEffort: "about_right",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const shoe: Shoe = {
  id: createShoeId("shoe-1"),
  userId: createUserId("runner-1"),
  name: "Daily trainer",
  startingDistance: createDistanceMeters(0),
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};

it("shows analytics calculated from completed runs", async () => {
  render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getByText("Total Distance")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Aug 5, 2026" })).toBeInTheDocument();
  expect(screen.getAllByText("5 mi")).toHaveLength(3);
  expect(screen.getByText("40:00")).toBeInTheDocument();
  expect(screen.getAllByText("8:00 /mi")).toHaveLength(2);
  expect(screen.getByText("Daily trainer")).toBeInTheDocument();
  expect(screen.getByText("About as expected")).toBeInTheDocument();
  expect(screen.getByText("Average Pace")).toBeInTheDocument();
  expect(screen.getByText("Total Runs")).toBeInTheDocument();
  expect(screen.getAllByText("1")).toHaveLength(2);
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:8047",
  );
  expect(await screen.findByTestId("recent-pace-trend")).toHaveTextContent(
    "mile:480",
  );
});

it("shows sensible values for an empty history", async () => {
  render(
    <Analyze
      runs={[]}
      shoes={[]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getByText(/log your first run/i)).toBeInTheDocument();
  expect(screen.queryByText("Latest run")).not.toBeInTheDocument();
  expect(screen.getAllByText("0 mi")).toHaveLength(2);
  expect(screen.getByText("Not enough data")).toBeInTheDocument();
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:0",
  );
  expect(await screen.findByTestId("recent-pace-trend")).toHaveTextContent(
    "mile:",
  );
});

it("uses the runner distance preference for analytics and trends", async () => {
  render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="kilometer"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getAllByText("8 km")).toHaveLength(3);
  expect(screen.getAllByText("4:58 /km")).toHaveLength(2);
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "kilometer:8047",
  );
  expect(await screen.findByTestId("recent-pace-trend")).toHaveTextContent(
    "kilometer:298",
  );
});

it("anchors the current week to the runner time zone", async () => {
  const laView = render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-10T01:00:00Z")}
    />,
  );

  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:8047",
  );
  laView.unmount();

  render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("Asia/Tokyo")}
      now={new Date("2026-08-10T01:00:00Z")}
    />,
  );

  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:0",
  );
});

it("selects the latest run regardless of snapshot order and updates with new data", () => {
  const newerTimestamp = createUtcDateTime("2026-08-07T14:00:00Z");
  const newerRun: CompletedRun = {
    ...run,
    id: createCompletedRunId("run-2"),
    startedAt: newerTimestamp,
    createdAt: newerTimestamp,
    updatedAt: newerTimestamp,
    distance: createDistanceMeters(4_023),
    duration: createDurationSeconds(1_500),
    shoeId: undefined,
    perceivedEffort: undefined,
  };
  const view = render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-08T12:00:00Z")}
    />,
  );

  expect(screen.getByRole("heading", { name: "Aug 5, 2026" })).toBeInTheDocument();

  view.rerender(
    <Analyze
      runs={[run, newerRun]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-08T12:00:00Z")}
    />,
  );

  expect(screen.getByRole("heading", { name: "Aug 7, 2026" })).toBeInTheDocument();
  expect(screen.getAllByText("Not recorded")).toHaveLength(2);
});
