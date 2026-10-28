import "./InternalSessionPlanNotice.css";

type InternalSessionPlanNoticeProps = {
  readonly surface: "home" | "plan";
  readonly isAdapted: boolean;
};

const surfaceDescriptions = {
  home: "The next-workout card is previewing this draft.",
  plan: "The Plan calendar is previewing this draft.",
} as const;

export default function InternalSessionPlanNotice({
  surface,
  isAdapted,
}: InternalSessionPlanNoticeProps) {
  const headingId = `internal-session-plan-notice-${surface}`;
  const surfaceDescription = isAdapted
    ? surfaceDescriptions[surface].replace(
        "this draft",
        "the accepted rehearsal adjustment",
      )
    : surfaceDescriptions[surface];

  return (
    <aside
      className="internal-session-plan-notice"
      aria-labelledby={headingId}
    >
      <p className="internal-session-plan-notice-eyebrow">
        {isAdapted
          ? "Adjusted owner-only session draft"
          : "Owner-only session draft"}
      </p>
      <h2 id={headingId}>Rehearsal preview, not a saved plan</h2>
      <p>
        {surfaceDescription} {isAdapted ? "The adjustment" : "It"} exists only
        in this browser session and has not been saved or approved.
      </p>
      <p>
        Track and completed-run writes continue to use synchronized training
        data.
      </p>
    </aside>
  );
}
