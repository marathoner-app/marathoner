import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import * as echarts from "echarts/core";
import type { ComposeOption, ECharts } from "echarts/core";
import { BarChart, type BarSeriesOption } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
  type AriaComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import {
  metersToKilometers,
  metersToMiles,
  type DateOnly,
  type DistanceUnit,
  type WeeklyDistanceBucket,
} from "../domain/training";

echarts.use([
  AriaComponent,
  BarChart,
  GridComponent,
  TooltipComponent,
  SVGRenderer,
]);

type WeeklyDistanceChartOption = ComposeOption<
  | AriaComponentOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

type WeeklyDistanceTrendProps = {
  readonly buckets: readonly WeeklyDistanceBucket[];
  readonly distanceUnit: DistanceUnit;
};

function formatWeekStart(value: DateOnly): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function distanceValue(
  bucket: WeeklyDistanceBucket,
  distanceUnit: DistanceUnit,
): number {
  const value =
    distanceUnit === "mile"
      ? metersToMiles(bucket.distance)
      : metersToKilometers(bucket.distance);
  return Number(value.toFixed(1));
}

function distanceLabel(value: number, distanceUnit: DistanceUnit): string {
  return `${value} ${distanceUnit === "mile" ? "mi" : "km"}`;
}

export default function WeeklyDistanceTrend({
  buckets,
  distanceUnit,
}: WeeklyDistanceTrendProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const reduceMotion = useReducedMotion();
  const points = useMemo(
    () =>
      buckets.map((bucket) => ({
        weekStart: bucket.weekStart,
        label: formatWeekStart(bucket.weekStart),
        distance: distanceValue(bucket, distanceUnit),
        runCount: bucket.runCount,
      })),
    [buckets, distanceUnit],
  );
  const hasRecentRuns = points.some((point) => point.runCount > 0);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (container === null || !hasRecentRuns) return;

    const chart = echarts.init(container, undefined, { renderer: "svg" });
    chartRef.current = chart;
    const resize = () => chart.resize();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(resize);

    if (resizeObserver === null) {
      window.addEventListener("resize", resize);
    } else {
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [hasRecentRuns]);

  useEffect(() => {
    if (chartRef.current === null || !hasRecentRuns) return;

    const unitLabel = distanceUnit === "mile" ? "Miles" : "Kilometers";
    const option: WeeklyDistanceChartOption = {
      animation: !reduceMotion,
      aria: {
        enabled: true,
        description:
          "Weekly running distance bar chart. Exact values are available in the data table following the chart.",
        decal: { show: true },
      },
      grid: {
        left: 48,
        right: 16,
        top: 24,
        bottom: 48,
      },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) =>
          distanceLabel(Number(value), distanceUnit),
      },
      xAxis: {
        type: "category",
        data: points.map((point) => point.label),
        axisLabel: { interval: 0, rotate: points.length > 6 ? 35 : 0 },
      },
      yAxis: {
        type: "value",
        min: 0,
        name: unitLabel,
        minInterval: 1,
      },
      series: [
        {
          name: "Weekly distance",
          type: "bar",
          data: points.map((point) => point.distance),
          itemStyle: { color: "#007bff", borderRadius: [4, 4, 0, 0] },
        },
      ],
    };

    chartRef.current.setOption(option, { notMerge: true });
  }, [distanceUnit, hasRecentRuns, points, reduceMotion]);

  return (
    <section className="weekly-trend" aria-labelledby="weekly-trend-heading">
      <h2 id="weekly-trend-heading">Weekly Distance</h2>
      <p className="weekly-trend-context">
        Monday–Sunday totals for the last {buckets.length} weeks. The current
        week may still be in progress.
      </p>
      {!hasRecentRuns && (
        <p className="training-empty-state">
          No runs were logged during this recent window.
        </p>
      )}
      {hasRecentRuns && (
        <>
          <div ref={chartContainerRef} className="weekly-trend-chart" />
          <details className="weekly-trend-data">
            <summary>View weekly distance data</summary>
            <table>
              <caption>Weekly running distance</caption>
              <thead>
                <tr>
                  <th scope="col">Week starting</th>
                  <th scope="col">Distance</th>
                  <th scope="col">Runs</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.weekStart}>
                    <th scope="row">{point.weekStart}</th>
                    <td>{distanceLabel(point.distance, distanceUnit)}</td>
                    <td>{point.runCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
