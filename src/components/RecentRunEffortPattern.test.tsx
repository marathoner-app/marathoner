import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  createCompletedRunId,
  createDateOnly,
  createUtcDateTime,
  type RecentRunEffortPoint,
} from "../domain/training";
import RecentRunEffortPattern from "./RecentRunEffortPattern";

const points: RecentRunEffortPoint[] = [
  {
    runId: createCompletedRunId("run-1"),
    runDate: createDateOnly("2026-10-20"),
    startedAt: createUtcDateTime("2026-10-20T15:00:00Z"),
    perceivedEffort: "about_right",
  },
  {
    runId: createCompletedRunId("run-2"),
    runDate: createDateOnly("2026-10-22"),
    startedAt: createUtcDateTime("2026-10-22T15:00:00Z"),
    perceivedEffort: "harder_than_expected",
  },
];

it("renders the recent sequence and an accessible exact-value table", () => {
  render(<RecentRunEffortPattern points={points} />);

  expect(screen.getByRole("heading", { name: "Recent Effort" })).toBeInTheDocument();
  expect(screen.getByText(/missing answers stay missing/i)).toBeInTheDocument();
  const sequence = screen.getByRole("list", { name: "Recent run effort sequence" });
  expect(sequence).toHaveTextContent("Oct 20About as expected");
  expect(sequence).toHaveTextContent("Oct 22Harder than expected");
  expect(
    screen.getByRole("table", { name: "Recent recorded perceived effort" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("row", { name: "2026-10-20 About as expected" }))
    .toBeInTheDocument();
  expect(screen.getByRole("row", { name: "2026-10-22 Harder than expected" }))
    .toBeInTheDocument();
});

it("shows an honest empty state without a sequence or table", () => {
  render(<RecentRunEffortPattern points={[]} />);

  expect(screen.getByText(/log a run to begin/i)).toBeInTheDocument();
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("keeps runs with missing effort visible", () => {
  const missingPoints = points.map((point) => ({
    ...point,
    perceivedEffort: undefined,
  }));

  render(<RecentRunEffortPattern points={missingPoints} />);

  expect(screen.getByText(/no perceived effort was recorded/i)).toBeInTheDocument();
  expect(screen.getAllByText("Not recorded")).toHaveLength(4);
});

it("does not call one answer a pattern", () => {
  render(
    <RecentRunEffortPattern
      points={[points[0], { ...points[1], perceivedEffort: undefined }]}
    />,
  );

  expect(screen.getByText(/one perceived-effort answer is available/i))
    .toBeInTheDocument();
});
