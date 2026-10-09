import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  createDateOnly,
  milesToMeters,
  type WeeklyDistanceBucket,
} from "../domain/training";
import WeeklyDistanceTrend from "./WeeklyDistanceTrend";

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
vi.mock("echarts/charts", () => ({ BarChart: {} }));
vi.mock("echarts/components", () => ({
  AriaComponent: {},
  GridComponent: {},
  TooltipComponent: {},
}));
vi.mock("echarts/renderers", () => ({ SVGRenderer: {} }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => motionPreference.reduce,
}));

const buckets: WeeklyDistanceBucket[] = [
  {
    weekStart: createDateOnly("2026-09-28"),
    weekEnd: createDateOnly("2026-10-04"),
    distance: milesToMeters(5),
    runCount: 1,
  },
  {
    weekStart: createDateOnly("2026-10-05"),
    weekEnd: createDateOnly("2026-10-11"),
    distance: milesToMeters(8.25),
    runCount: 2,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  motionPreference.reduce = false;
});

it("renders an SVG chart and an accessible exact-value table", () => {
  const { unmount } = render(
    <WeeklyDistanceTrend buckets={buckets} distanceUnit="mile" />,
  );

  expect(screen.getByRole("heading", { name: "Weekly Distance" })).toBeInTheDocument();
  expect(screen.getByText(/current week may still be in progress/i)).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Weekly running distance" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "5 mi" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "8.2 mi" })).toBeInTheDocument();
  expect(initializeChart).toHaveBeenCalledWith(
    expect.any(HTMLDivElement),
    undefined,
    { renderer: "svg" },
  );
  expect(chart.setOption).toHaveBeenCalledWith(
    expect.objectContaining({
      animation: true,
      aria: expect.objectContaining({ enabled: true }),
      series: [expect.objectContaining({ data: [5, 8.2] })],
    }),
    { notMerge: true },
  );
  window.dispatchEvent(new Event("resize"));
  expect(chart.resize).toHaveBeenCalledOnce();

  unmount();
  expect(chart.dispose).toHaveBeenCalledOnce();
});

it("uses an honest empty state without initializing a chart", () => {
  render(
    <WeeklyDistanceTrend
      buckets={buckets.map((bucket) => ({
        ...bucket,
        distance: milesToMeters(0),
        runCount: 0,
      }))}
      distanceUnit="mile"
    />,
  );

  expect(screen.getByText(/no runs were logged/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(initializeChart).not.toHaveBeenCalled();
});

it("disables chart animation when the runner prefers reduced motion", () => {
  motionPreference.reduce = true;

  render(<WeeklyDistanceTrend buckets={buckets} distanceUnit="mile" />);

  expect(chart.setOption).toHaveBeenCalledWith(
    expect.objectContaining({ animation: false }),
    { notMerge: true },
  );
});
