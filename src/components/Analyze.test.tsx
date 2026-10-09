import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  createCompletedRunId,
  createDistanceMeters,
  createDurationSeconds,
  createIanaTimeZone,
  createUserId,
  createUtcDateTime,
  type CompletedRun,
  type DistanceUnit,
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

const timestamp = createUtcDateTime("2026-08-05T14:00:00Z");
const run: CompletedRun = {
  id: createCompletedRunId("run-1"),
  userId: createUserId("runner-1"),
  startedAt: timestamp,
  timeZone: createIanaTimeZone("America/Los_Angeles"),
  distance: createDistanceMeters(8_047),
  duration: createDurationSeconds(2_400),
  createdAt: timestamp,
  updatedAt: timestamp,
};

it("shows analytics calculated from completed runs", async () => {
  render(
    <Analyze
      runs={[run]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getByText("Total Distance")).toBeInTheDocument();
  expect(screen.getAllByText("5 mi")).toHaveLength(2);
  expect(screen.getByText("Average Pace")).toBeInTheDocument();
  expect(screen.getByText("8:00 /mi")).toBeInTheDocument();
  expect(screen.getByText("Total Runs")).toBeInTheDocument();
  expect(screen.getAllByText("1")).toHaveLength(2);
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:8047",
  );
});

it("shows sensible values for an empty history", async () => {
  render(
    <Analyze
      runs={[]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getByText(/log your first run/i)).toBeInTheDocument();
  expect(screen.getAllByText("0 mi")).toHaveLength(2);
  expect(screen.getByText("Not enough data")).toBeInTheDocument();
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:0",
  );
});

it("uses the runner distance preference for analytics and trends", async () => {
  render(
    <Analyze
      runs={[run]}
      distanceUnit="kilometer"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  expect(screen.getAllByText("8 km")).toHaveLength(2);
  expect(screen.getByText("4:58 /km")).toBeInTheDocument();
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "kilometer:8047",
  );
});

it("anchors the current week to the runner time zone", async () => {
  const laView = render(
    <Analyze
      runs={[run]}
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
      distanceUnit="mile"
      timeZone={createIanaTimeZone("Asia/Tokyo")}
      now={new Date("2026-08-10T01:00:00Z")}
    />,
  );

  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:0",
  );
});
