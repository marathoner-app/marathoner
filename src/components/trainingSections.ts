export const trainingSections = [
  { id: "plan", label: "Plan", title: "Plan Your Workouts" },
  { id: "track", label: "Track", title: "Track Your Runs" },
  { id: "analyze", label: "Analyze", title: "Analyze Your Progress" },
] as const;

export type TrainingSection = (typeof trainingSections)[number]["id"];
