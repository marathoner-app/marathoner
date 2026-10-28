import type {
  DistanceUnit,
  GeneratedPlanEntityProjection,
} from "../domain/training";
import Calendar from "./Calendar";
import "./InternalSessionPlanSchedule.css";

interface InternalSessionPlanScheduleProps {
  readonly projection: GeneratedPlanEntityProjection | null;
  readonly distanceUnit: DistanceUnit;
  readonly isAdapted: boolean;
}

export default function InternalSessionPlanSchedule({
  projection,
  distanceUnit,
  isAdapted,
}: InternalSessionPlanScheduleProps) {
  if (projection === null) return null;

  return (
    <section
      id="internal-session-plan-schedule"
      className="internal-session-plan-schedule"
      aria-labelledby="internal-session-plan-schedule-title"
    >
      <header>
        <p className="internal-session-plan-schedule-eyebrow">
          {isAdapted
            ? "Adjusted owner-only session projection"
            : "Owner-only session projection"}
        </p>
        <h2 id="internal-session-plan-schedule-title">
          Session-only plan calendar
        </h2>
        <p>
          {isAdapted
            ? "This is the accepted rehearsal adjustment rendered through Marathoner's real plan calendar."
            : "This is the activated draft rendered through Marathoner's real plan calendar."}{" "}
          It exists only in memory and does not replace synchronized Plan or
          Track data.
        </p>
      </header>
      <Calendar
        plan={projection.plan}
        workouts={projection.workouts}
        distanceUnit={distanceUnit}
        initialDate={projection.plan.startDate}
      />
    </section>
  );
}
