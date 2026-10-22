import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  createCompletedRunId,
  createDateOnly,
  createUtcDateTime,
  type RecentRunPacePoint,
} from "../domain/training";
import RecentRunPaceTrend from "./RecentRunPaceTrend";

const chart = vi.hoisted(() => ({
  dispose: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
}));
const initializeChart = vi.hoisted(() => vi.fn(() => chart));
const motionPreference = vi.hoisted(() => ({ reduce: false }));

vi.mock("echarts/core", () => ({
  init: initializeChart,
  use: vi.fn(),
}));
vi.mock("echarts/charts", () => ({ LineChart: {} }));
vi.mock("echarts/components", () => ({
  AriaComponent: {},
  GridComponent: {},
  TooltipComponent: {},
}));
vi.mock("echarts/renderers", () => ({ SVGRenderer: {} }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => motionPreference.reduce,
}));

const points: RecentRunPacePoint[] = [
  {
    runId: createCompletedRunId("run-1"),
    runDate: createDateOnly("2026-10-20"),
    startedAt: createUtcDateTime("2026-10-20T15:00:00Z"),
    pace: { secondsPerUnit: 540, unit: "mile" },
  },
  {
    runId: createCompletedRunId("run-2"),
    runDate: createDateOnly("2026-10-22"),
    startedAt: createUtcDateTime("2026-10-22T15:00:00Z"),
    pace: { secondsPerUnit: 525, unit: "mile" },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  motionPreference.reduce = false;
});

it("renders a line chart and an accessible exact-value table", () => {
  const { unmount } = render(
    <RecentRunPaceTrend points={points} distanceUnit="mile" />,
  );

  expect(screen.getByRole("heading", { name: "Recent Pace" })).toBeInTheDocument();
  expect(screen.getByText(/not a training recommendation/i)).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Recent recorded pace" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "9:00 /mi" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "8:45 /mi" })).toBeInTheDocument();
  expect(initializeChart).toHaveBeenCalledWith(
    expect.any(HTMLDivElement),
    undefined,
    { renderer: "svg" },
  );
  expect(chart.setOption).toHaveBeenCalledWith(
    expect.objectContaining({
      animation: true,
      aria: expect.objectContaining({ enabled: true }),
      series: [expect.objectContaining({ data: [540, 525], smooth: false })],
    }),
    { notMerge: true },
  );
  window.dispatchEvent(new Event("resize"));
  expect(chart.resize).toHaveBeenCalledOnce();

  unmount();
  expect(chart.dispose).toHaveBeenCalledOnce();
});

it("shows one exact pace without claiming it is a trend", () => {
  render(<RecentRunPaceTrend points={[points[0]]} distanceUnit="mile" />);

  expect(screen.getByText(/log another run to see a pace trend/i)).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Recent recorded pace" })).toBeInTheDocument();
  expect(initializeChart).not.toHaveBeenCalled();
});

it("uses an honest empty state without initializing a chart or table", () => {
  render(<RecentRunPaceTrend points={[]} distanceUnit="mile" />);

  expect(screen.getByText(/log a run with distance and time/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(initializeChart).not.toHaveBeenCalled();
});

it("uses kilometers and disables animation for reduced motion", () => {
  motionPreference.reduce = true;
  const kilometerPoints = points.map((point) => ({
    ...point,
    pace: { secondsPerUnit: 330, unit: "kilometer" as const },
  }));

  render(
    <RecentRunPaceTrend
      points={kilometerPoints}
      distanceUnit="kilometer"
    />,
  );

  expect(screen.getAllByRole("cell", { name: "5:30 /km" })).toHaveLength(2);
  expect(chart.setOption).toHaveBeenCalledWith(
    expect.objectContaining({ animation: false }),
    { notMerge: true },
  );
});
