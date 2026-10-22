import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import * as echarts from "echarts/core";
import type { ComposeOption, ECharts } from "echarts/core";
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
  type AriaComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type {
  DistanceUnit,
  RecentRunPacePoint,
} from "../domain/training";

echarts.use([
  AriaComponent,
  GridComponent,
  LineChart,
  TooltipComponent,
  SVGRenderer,
]);

type RecentRunPaceChartOption = ComposeOption<
  | AriaComponentOption
  | GridComponentOption
  | LineSeriesOption
  | TooltipComponentOption
>;

type RecentRunPaceTrendProps = {
  readonly points: readonly RecentRunPacePoint[];
  readonly distanceUnit: DistanceUnit;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPace(secondsPerUnit: number, distanceUnit: DistanceUnit): string {
  const rounded = Math.round(secondsPerUnit);
  const minutes = Math.floor(rounded / 60);
  const seconds = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${seconds} /${distanceUnit === "mile" ? "mi" : "km"}`;
}

export default function RecentRunPaceTrend({
  points,
  distanceUnit,
}: RecentRunPaceTrendProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const reduceMotion = useReducedMotion();
  const displayPoints = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        dateLabel: formatDate(point.runDate),
        secondsPerUnit: point.pace.secondsPerUnit,
      })),
    [points],
  );
  const hasTrend = displayPoints.length >= 2;

  useEffect(() => {
    const container = chartContainerRef.current;
    if (container === null || !hasTrend) return;

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
  }, [hasTrend]);

  useEffect(() => {
    if (chartRef.current === null || !hasTrend) return;

    const unitLabel = distanceUnit === "mile" ? "Pace per mile" : "Pace per kilometer";
    const option: RecentRunPaceChartOption = {
      animation: !reduceMotion,
      aria: {
        enabled: true,
        description:
          "Recent recorded pace line chart. Exact values are available in the data table following the chart.",
        decal: { show: true },
      },
      grid: {
        left: 64,
        right: 16,
        top: 32,
        bottom: 48,
      },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) =>
          formatPace(Number(value), distanceUnit),
      },
      xAxis: {
        type: "category",
        data: displayPoints.map((point) => point.dateLabel),
        axisLabel: {
          interval: 0,
          rotate: displayPoints.length > 6 ? 35 : 0,
        },
      },
      yAxis: {
        type: "value",
        name: unitLabel,
        min: "dataMin",
        axisLabel: {
          formatter: (value: number) => formatPace(value, distanceUnit),
        },
      },
      series: [
        {
          name: "Recorded pace",
          type: "line",
          data: displayPoints.map((point) => point.secondsPerUnit),
          smooth: false,
          symbolSize: 8,
          lineStyle: { color: "#005fcc", width: 3 },
          itemStyle: { color: "#005fcc" },
        },
      ],
    };

    chartRef.current.setOption(option, { notMerge: true });
  }, [displayPoints, distanceUnit, hasTrend, reduceMotion]);

  return (
    <section className="pace-trend" aria-labelledby="pace-trend-heading">
      <h2 id="pace-trend-heading">Recent Pace</h2>
      <p className="pace-trend-context">
        Pace calculated from your most recent logged runs. This is a description
        of logged data, not a training recommendation.
      </p>
      {displayPoints.length === 0 && (
        <p className="training-empty-state">
          Log a run with distance and time to add a pace point.
        </p>
      )}
      {displayPoints.length === 1 && (
        <p className="training-empty-state">
          One run is available. Log another run to see a pace trend.
        </p>
      )}
      {hasTrend && (
        <div ref={chartContainerRef} className="pace-trend-chart" />
      )}
      {displayPoints.length > 0 && (
        <details className="pace-trend-data">
          <summary>View recent pace data</summary>
          <table>
            <caption>Recent recorded pace</caption>
            <thead>
              <tr>
                <th scope="col">Run date</th>
                <th scope="col">Pace</th>
              </tr>
            </thead>
            <tbody>
              {displayPoints.map((point) => (
                <tr key={point.runId}>
                  <th scope="row">{point.runDate}</th>
                  <td>{formatPace(point.secondsPerUnit, distanceUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
