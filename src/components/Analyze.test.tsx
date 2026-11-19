import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
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
    isCarouselCardActive,
  }: {
    buckets: readonly WeeklyDistanceBucket[];
    distanceUnit: DistanceUnit;
    isCarouselCardActive: boolean;
  }) => (
    <div
      data-active={String(isCarouselCardActive)}
      data-testid="weekly-distance-trend"
    >
      {distanceUnit}:{buckets.at(-1)?.distance ?? 0}
    </div>
  ),
}));
vi.mock("./RecentRunPaceTrend", () => ({
  default: ({
    points,
    distanceUnit,
    isCarouselCardActive,
  }: {
    points: readonly RecentRunPacePoint[];
    distanceUnit: DistanceUnit;
    isCarouselCardActive: boolean;
  }) => (
    <div
      data-active={String(isCarouselCardActive)}
      data-testid="recent-pace-trend"
    >
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
  averageHeartRateBpm: createHeartRateBpm(151),
  maximumHeartRateBpm: createHeartRateBpm(176),
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
  const latestRunSummary = screen.getByRole("region", { name: "Aug 5, 2026" });
  expect(within(latestRunSummary).getByText("About as expected")).toBeInTheDocument();
  expect(within(latestRunSummary).getByText("151 bpm")).toBeInTheDocument();
  expect(within(latestRunSummary).getByText("176 bpm")).toBeInTheDocument();
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
  expect(screen.getByText("Latest run")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "No runs yet" })).toBeInTheDocument();
  expect(screen.getAllByText("0 mi")).toHaveLength(2);
  expect(screen.getByText("Not enough data")).toBeInTheDocument();
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveTextContent(
    "mile:0",
  );
  expect(await screen.findByTestId("recent-pace-trend")).toHaveTextContent(
    "mile:",
  );
});

it("moves between analysis cards and activates chart layouts", async () => {
  render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  const previous = screen.getByRole("button", {
    name: "Previous analysis card",
  });
  const next = screen.getByRole("button", { name: "Next analysis card" });

  expect(previous).toBeDisabled();
  expect(next).toBeEnabled();
  expect(screen.getByText("Latest run · 1 of 5")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show Latest run card" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  fireEvent.click(next);

  expect(previous).toBeEnabled();
  expect(screen.getByText("Training summary · 2 of 5")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Show Training summary card" }),
  ).toHaveAttribute("aria-current", "true");

  fireEvent.click(screen.getByRole("button", { name: "Show Recent effort card" }));

  expect(screen.getByText("Recent effort · 5 of 5")).toBeInTheDocument();
  expect(next).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Show Recent pace card" }));

  expect(await screen.findByTestId("recent-pace-trend")).toHaveAttribute(
    "data-active",
    "true",
  );
  expect(await screen.findByTestId("weekly-distance-trend")).toHaveAttribute(
    "data-active",
    "false",
  );
});

it("synchronizes carousel controls with the visually selected scrolled card", () => {
  const { container } = render(
    <Analyze
      runs={[run]}
      shoes={[shoe]}
      distanceUnit="mile"
      timeZone={createIanaTimeZone("America/Los_Angeles")}
      now={new Date("2026-08-06T12:00:00Z")}
    />,
  );

  const carousel = container.querySelector<HTMLElement>(
    ".analyze-carousel-viewport",
  );
  const slides = Array.from(
    container.querySelectorAll<HTMLElement>(".analyze-slide"),
  );
  expect(carousel).not.toBeNull();
  expect(slides).toHaveLength(5);
  if (carousel === null) return;

  const rectangle = (left: number, width = 300): DOMRect => ({
    bottom: 500,
    height: 500,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  });
  vi.spyOn(carousel, "getBoundingClientRect").mockReturnValue(rectangle(0));
  slides.forEach((slide, index) => {
    vi.spyOn(slide, "getBoundingClientRect").mockReturnValue(
      rectangle((index - 1) * 320),
    );
  });

  fireEvent.scroll(carousel);

  expect(screen.getByText("Training summary · 2 of 5")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Show Training summary card" }),
  ).toHaveAttribute("aria-current", "true");
  expect(
    screen.getByRole("button", { name: "Previous analysis card" }),
  ).toBeEnabled();
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
  const latestRunSummary = screen.getByRole("region", { name: "Aug 7, 2026" });
  expect(within(latestRunSummary).getAllByText("Not recorded")).toHaveLength(2);
});
