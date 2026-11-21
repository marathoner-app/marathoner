import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import { GridLayout, verticalCompactor } from "react-grid-layout";
import {
  calculatePace,
  calculateRecentRunEffortPattern,
  calculateRecentRunPaceTrend,
  calculateTrainingAnalytics,
  calculateWeeklyDistanceTrend,
  createDateOnly,
  createIanaTimeZone,
  metersToKilometers,
  metersToMiles,
  type CompletedRun,
  type DistanceMeters,
  type DistanceUnit,
  type IanaTimeZone,
  type Shoe,
} from "../domain/training";
import { formatPerceivedEffort } from "./perceivedEffort";
import RecentRunEffortPattern from "./RecentRunEffortPattern";
import { AnalyzeDashboardDrawer } from "./AnalyzeDashboardEditorChrome";
import {
  ANALYZE_DASHBOARD_COLUMNS,
  ANALYZE_DASHBOARD_ROWS,
  analyzeDashboardWidgetDefinitions,
  visibleGridLayout,
  type AnalyzeDashboardWidgetId,
} from "./analyzeDashboardLayout";
import type { AnalyzeDashboardEditorController } from "./useAnalyzeDashboardEditor";

const WeeklyDistanceTrend = lazy(() => import("./WeeklyDistanceTrend"));
const RecentRunPaceTrend = lazy(() => import("./RecentRunPaceTrend"));

const ANALYZE_CARD_LABELS = [
  "Latest run",
  "Training summary",
  "Weekly distance",
  "Recent pace",
  "Recent effort",
] as const;

type AnalyzeProps = {
  readonly runs: readonly CompletedRun[];
  readonly shoes: readonly Shoe[];
  readonly distanceUnit: DistanceUnit;
  readonly timeZone?: IanaTimeZone;
  readonly now?: Date;
  readonly dashboardEditor?: AnalyzeDashboardEditorController;
};

const widgetOrder: readonly AnalyzeDashboardWidgetId[] = [
  "latest-run",
  "training-summary",
  "weekly-distance",
  "recent-pace",
  "recent-effort",
];

function useDashboardBounds() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height:
      typeof window === "undefined" ? 600 : Math.max(400, window.innerHeight - 76),
  }));

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      setBounds({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return { frameRef, ...bounds };
}

function findLatestRun(runs: readonly CompletedRun[]): CompletedRun | undefined {
  return runs.reduce<CompletedRun | undefined>((latest, run) => {
    if (latest === undefined) return run;

    const startedAtOrder = run.startedAt.localeCompare(latest.startedAt);
    if (startedAtOrder > 0) return run;
    if (startedAtOrder < 0) return latest;

    return run.id.localeCompare(latest.id) > 0 ? run : latest;
  }, undefined);
}

function formatRunDate(run: CompletedRun): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: run.timeZone,
  }).format(new Date(run.startedAt));
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

function currentTimeZone(): IanaTimeZone {
  return createIanaTimeZone(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
}

function mondayFor(date: Date, timeZone: IanaTimeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const localDate = createDateOnly(`${parts.year}-${parts.month}-${parts.day}`);
  const monday = new Date(`${localDate}T00:00:00.000Z`);
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  return createDateOnly(monday.toISOString().slice(0, 10));
}

function formatDistance(distance: DistanceMeters, unit: DistanceUnit): string {
  const value = unit === "mile" ? metersToMiles(distance) : metersToKilometers(distance);
  return `${Number(value.toFixed(1))} ${unit === "mile" ? "mi" : "km"}`;
}

function formatPace(
  secondsPerUnit: number | undefined,
  unit: DistanceUnit,
): string {
  if (secondsPerUnit === undefined) return "Not enough data";
  const rounded = Math.round(secondsPerUnit);
  const minutes = Math.floor(rounded / 60);
  const seconds = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${seconds} /${unit === "mile" ? "mi" : "km"}`;
}

export default function Analyze({
  runs,
  shoes,
  distanceUnit,
  timeZone = currentTimeZone(),
  now = new Date(),
  dashboardEditor,
}: AnalyzeProps) {
  const reduceMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [keyboardGrabbedWidget, setKeyboardGrabbedWidget] =
    useState<AnalyzeDashboardWidgetId | null>(null);
  const [editorAnnouncement, setEditorAnnouncement] = useState("");
  const dashboardBounds = useDashboardBounds();
  const currentWeekStart = mondayFor(now, timeZone);
  const analytics = calculateTrainingAnalytics(runs, currentWeekStart, distanceUnit);
  const weeklyDistance = calculateWeeklyDistanceTrend(runs, currentWeekStart, 8);
  const recentPace = calculateRecentRunPaceTrend(runs, distanceUnit, 8);
  const recentEffort = calculateRecentRunEffortPattern(runs, 8);
  const latestRun = findLatestRun(runs);
  const latestRunShoe = shoes.find((shoe) => shoe.id === latestRun?.shoeId);

  const showCard = (requestedIndex: number) => {
    const nextIndex = Math.min(
      Math.max(requestedIndex, 0),
      ANALYZE_CARD_LABELS.length - 1,
    );
    const carousel = carouselRef.current;
    const card = cardRefs.current[nextIndex];

    setActiveCardIndex(nextIndex);
    if (carousel === null || card === null) return;

    const carouselBounds = carousel.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    carousel.scrollTo?.({
      left: carousel.scrollLeft + cardBounds.left - carouselBounds.left,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const updateActiveCard = (event: UIEvent<HTMLDivElement>) => {
    const carousel = event.currentTarget;
    const carouselBounds = carousel.getBoundingClientRect();
    const nearestCard = cardRefs.current.reduce(
      (nearest, card, index) => {
        if (card === null) return nearest;
        const cardBounds = card.getBoundingClientRect();
        const visibleWidth = Math.max(
          0,
          Math.min(cardBounds.right, carouselBounds.right) -
            Math.max(cardBounds.left, carouselBounds.left),
        );
        return visibleWidth > nearest.visibleWidth
          ? { visibleWidth, index }
          : nearest;
      },
      { visibleWidth: 0, index: activeCardIndex },
    );

    if (nearestCard.index !== activeCardIndex) {
      setActiveCardIndex(nearestCard.index);
    }
  };

  const renderWidgetContent = (
    id: AnalyzeDashboardWidgetId,
    isCarouselCardActive: boolean,
  ): ReactNode => {
    if (id === "latest-run") {
      return (
        <section className="latest-run-summary" aria-labelledby="latest-run-heading">
          <div>
            <p className="latest-run-eyebrow">Latest run</p>
            <h2 id="latest-run-heading">
              {latestRun === undefined ? (
                "No runs yet"
              ) : (
                <time dateTime={latestRun.startedAt}>{formatRunDate(latestRun)}</time>
              )}
            </h2>
          </div>
          {latestRun === undefined ? (
            <p className="training-empty-state">
              Log your first run to begin building your training picture.
            </p>
          ) : (
            <dl className="latest-run-details">
              <div><dt>Distance</dt><dd>{formatDistance(latestRun.distance, distanceUnit)}</dd></div>
              <div><dt>Elapsed time</dt><dd>{formatDuration(latestRun.duration)}</dd></div>
              <div>
                <dt>Pace</dt>
                <dd>{formatPace(calculatePace(latestRun.distance, latestRun.duration, distanceUnit)?.secondsPerUnit, distanceUnit)}</dd>
              </div>
              <div><dt>Shoe</dt><dd>{latestRunShoe?.name ?? "Not recorded"}</dd></div>
              <div><dt>Perceived effort</dt><dd>{formatPerceivedEffort(latestRun.perceivedEffort)}</dd></div>
              {latestRun.averageHeartRateBpm !== undefined && (
                <div><dt>Average heart rate</dt><dd>{latestRun.averageHeartRateBpm} bpm</dd></div>
              )}
              {latestRun.maximumHeartRateBpm !== undefined && (
                <div><dt>Maximum heart rate</dt><dd>{latestRun.maximumHeartRateBpm} bpm</dd></div>
              )}
            </dl>
          )}
        </section>
      );
    }

    if (id === "training-summary") {
      return (
        <section className="analyze-summary" aria-labelledby="analyze-summary-heading">
          <p className="analyze-summary-eyebrow">At a glance</p>
          <h2 id="analyze-summary-heading">Training summary</h2>
          <div className="analyze-cards">
            <div className="analyze-card"><h3>Total Distance</h3><p>{formatDistance(analytics.totalDistance, distanceUnit)}</p></div>
            <div className="analyze-card"><h3>This Week</h3><p>{formatDistance(analytics.weeklyDistance, distanceUnit)}</p></div>
            <div className="analyze-card"><h3>Average Pace</h3><p>{formatPace(analytics.averagePace?.secondsPerUnit, distanceUnit)}</p></div>
            <div className="analyze-card"><h3>Total Runs</h3><p>{analytics.totalRuns}</p></div>
            <div className="analyze-card"><h3>Runs This Week</h3><p>{analytics.runsThisWeek}</p></div>
          </div>
        </section>
      );
    }

    if (id === "weekly-distance") {
      return (
        <Suspense fallback={<p className="training-status" role="status">Loading weekly distance chart...</p>}>
          <WeeklyDistanceTrend
            buckets={weeklyDistance}
            distanceUnit={distanceUnit}
            isCarouselCardActive={isCarouselCardActive}
          />
        </Suspense>
      );
    }

    if (id === "recent-pace") {
      return (
        <Suspense fallback={<p className="training-status" role="status">Loading recent pace chart...</p>}>
          <RecentRunPaceTrend
            points={recentPace}
            distanceUnit={distanceUnit}
            isCarouselCardActive={isCarouselCardActive}
          />
        </Suspense>
      );
    }

    return <RecentRunEffortPattern points={recentEffort} />;
  };

  const handleWidgetKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    id: AnalyzeDashboardWidgetId,
  ) => {
    if (dashboardEditor === undefined) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const nextGrabbed = keyboardGrabbedWidget === id ? null : id;
      setKeyboardGrabbedWidget(nextGrabbed);
      setEditorAnnouncement(
        nextGrabbed === id
          ? `${analyzeDashboardWidgetDefinitions[id].label} picked up. Use arrow keys to move it or Shift plus arrow keys to resize it.`
          : `${analyzeDashboardWidgetDefinitions[id].label} placed.`,
      );
      return;
    }
    if (event.key === "Escape" && keyboardGrabbedWidget === id) {
      event.preventDefault();
      setKeyboardGrabbedWidget(null);
      setEditorAnnouncement(`${analyzeDashboardWidgetDefinitions[id].label} placed.`);
      return;
    }
    if (keyboardGrabbedWidget !== id || !event.key.startsWith("Arrow")) return;

    event.preventDefault();
    const direction = event.key.slice(5).toLowerCase() as
      | "left"
      | "right"
      | "up"
      | "down";
    const mode = event.shiftKey ? "resize" : "move";
    const updated = dashboardEditor.updateWidgetFromKeyboard(id, direction, mode);
    setEditorAnnouncement(
      updated
        ? `${analyzeDashboardWidgetDefinitions[id].label} ${mode === "move" ? "moved" : "resized"} ${direction}.`
        : `${analyzeDashboardWidgetDefinitions[id].label} cannot ${mode} ${direction} from here.`,
    );
  };

  if (dashboardEditor?.isAvailable) {
    const gap = Math.max(8, Math.min(14, dashboardBounds.width * 0.009));
    const rowHeight = Math.max(
      18,
      (dashboardBounds.height - gap * (ANALYZE_DASHBOARD_ROWS - 1)) /
        ANALYZE_DASHBOARD_ROWS,
    );
    const layout = visibleGridLayout(dashboardEditor.displayedLayout);

    return (
      <div className="analyze-container analyze-container--desktop">
        <section className="analyze-carousel" aria-label="Training analysis">
          <div
            ref={dashboardBounds.frameRef}
            className={`analyze-desktop-grid-frame${dashboardEditor.isEditing ? " analyze-desktop-grid-frame--editing" : ""}`}
          >
            <GridLayout
              width={dashboardBounds.width}
              layout={layout}
              autoSize={false}
              className="analyze-desktop-grid"
              style={{ height: dashboardBounds.height }}
              gridConfig={{
                cols: ANALYZE_DASHBOARD_COLUMNS,
                rowHeight,
                margin: [gap, gap],
                containerPadding: [0, 0],
                maxRows: ANALYZE_DASHBOARD_ROWS,
              }}
              dragConfig={{
                enabled: dashboardEditor.isEditing,
                bounded: true,
                handle: ".analyze-widget-drag-handle",
                cancel: ".analyze-widget-hide",
              }}
              resizeConfig={{
                enabled: dashboardEditor.isEditing,
                handles: ["se"],
              }}
              compactor={verticalCompactor}
              onLayoutChange={
                dashboardEditor.isEditing
                  ? dashboardEditor.updateGridLayout
                  : undefined
              }
            >
              {dashboardEditor.displayedLayout
                .filter((item) => item.visible)
                .map((item) => {
                  const definition = analyzeDashboardWidgetDefinitions[item.i];
                  return (
                    <div
                      key={item.i}
                      className={`analyze-widget analyze-widget-shell analyze-widget--${item.i}`}
                      role="group"
                      aria-label={`${definition.label} widget`}
                    >
                      {dashboardEditor.isEditing && (
                        <div className="analyze-widget-edit-bar">
                          <button
                            type="button"
                            className="analyze-widget-drag-handle"
                            aria-pressed={keyboardGrabbedWidget === item.i}
                            aria-label={`Move or resize ${definition.label}`}
                            onKeyDown={(event) => handleWidgetKeyboard(event, item.i)}
                          >
                            <span aria-hidden="true">⠿</span>
                            <span>{definition.label}</span>
                          </button>
                          <button
                            type="button"
                            className="analyze-widget-hide"
                            aria-label={`Hide ${definition.label}`}
                            onClick={() => {
                              dashboardEditor.hideWidget(item.i);
                              window.requestAnimationFrame(() => {
                                document
                                  .querySelector<HTMLButtonElement>(
                                    "#analyze-add-widgets-button",
                                  )
                                  ?.focus();
                              });
                            }}
                          >
                            Hide
                          </button>
                        </div>
                      )}
                      <div className="analyze-widget-content">
                        {renderWidgetContent(item.i, true)}
                      </div>
                    </div>
                  );
                })}
            </GridLayout>
          </div>
        </section>
        <AnalyzeDashboardDrawer editor={dashboardEditor} />
        <p className="visually-hidden" role="status" aria-live="polite">
          {editorAnnouncement || dashboardEditor.message}
        </p>
      </div>
    );
  }

  return (
    <div className="analyze-container">
      <section className="analyze-carousel" aria-label="Training analysis">
        <div
          className="analyze-carousel-viewport"
          ref={carouselRef}
          onScroll={updateActiveCard}
        >
          {widgetOrder.map((id, index) => (
            <div
              className={`analyze-slide analyze-widget analyze-widget--${id}`}
              role="group"
              aria-label={`${index + 1} of 5: ${ANALYZE_CARD_LABELS[index]}`}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              key={id}
            >
              {renderWidgetContent(id, activeCardIndex === index)}
            </div>
          ))}
        </div>

        <div className="analyze-carousel-controls">
          <button
            type="button"
            className="analyze-carousel-arrow"
            aria-label="Previous analysis card"
            disabled={activeCardIndex === 0}
            onClick={() => showCard(activeCardIndex - 1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <div className="analyze-carousel-position">
            <p className="analyze-carousel-status" aria-live="polite">
              {ANALYZE_CARD_LABELS[activeCardIndex]} · {activeCardIndex + 1} of{" "}
              {ANALYZE_CARD_LABELS.length}
            </p>
            <div className="analyze-carousel-dots" aria-label="Choose analysis card">
              {ANALYZE_CARD_LABELS.map((label, index) => (
                <button
                  type="button"
                  className="analyze-carousel-dot"
                  aria-label={`Show ${label} card`}
                  aria-current={index === activeCardIndex ? "true" : undefined}
                  key={label}
                  onClick={() => showCard(index)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="analyze-carousel-arrow"
            aria-label="Next analysis card"
            disabled={activeCardIndex === ANALYZE_CARD_LABELS.length - 1}
            onClick={() => showCard(activeCardIndex + 1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
