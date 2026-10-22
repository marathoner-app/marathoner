import type { RecentRunEffortPoint } from "../domain/training";
import { formatPerceivedEffort } from "./perceivedEffort";

type RecentRunEffortPatternProps = {
  readonly points: readonly RecentRunEffortPoint[];
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default function RecentRunEffortPattern({
  points,
}: RecentRunEffortPatternProps) {
  const recordedCount = points.filter(
    (point) => point.perceivedEffort !== undefined,
  ).length;

  return (
    <section className="effort-pattern" aria-labelledby="effort-pattern-heading">
      <h2 id="effort-pattern-heading">Recent Effort</h2>
      <p className="effort-pattern-context">
        How your most recent runs felt compared with what you expected. Missing
        answers stay missing and are not estimated.
      </p>
      {points.length === 0 && (
        <p className="training-empty-state">
          Log a run to begin a perceived-effort history.
        </p>
      )}
      {points.length > 0 && recordedCount === 0 && (
        <p className="training-empty-state">
          No perceived effort was recorded for these runs.
        </p>
      )}
      {recordedCount === 1 && (
        <p className="training-empty-state">
          One perceived-effort answer is available. More answers will make the
          pattern easier to read.
        </p>
      )}
      {points.length > 0 && (
        <>
          <ol className="effort-pattern-list" aria-label="Recent run effort sequence">
            {points.map((point) => (
              <li
                className={`effort-pattern-item effort-pattern-item--${point.perceivedEffort ?? "missing"}`}
                key={point.runId}
              >
                <time dateTime={point.runDate}>{formatDate(point.runDate)}</time>
                <span>{formatPerceivedEffort(point.perceivedEffort)}</span>
              </li>
            ))}
          </ol>
          <details className="effort-pattern-data">
            <summary>View recent effort data</summary>
            <table>
              <caption>Recent recorded perceived effort</caption>
              <thead>
                <tr>
                  <th scope="col">Run date</th>
                  <th scope="col">Perceived effort</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.runId}>
                    <th scope="row">{point.runDate}</th>
                    <td>{formatPerceivedEffort(point.perceivedEffort)}</td>
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
