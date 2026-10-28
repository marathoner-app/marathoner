import { motion } from "framer-motion";
import {
  trainingSections,
  type TrainingSection,
} from "./trainingSections";

type TrainingSectionNavigationProps = {
  activeSection: TrainingSection | null;
  transitionDuration: number;
  onSelect: (section: TrainingSection) => void;
  onRegisterTrigger?: (
    section: TrainingSection,
    element: HTMLButtonElement | null,
  ) => void;
};

function TrainingSectionIcon({ section }: { section: TrainingSection }) {
  return (
    <svg
      className="section-trigger-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {section === "plan" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 9h18M7 13h3M14 13h3M7 17h3" />
        </>
      )}
      {section === "track" && (
        <>
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="6" r="2" />
          <path d="M7 18c3.5 0 3.5-5 7-5s3.5-5 3.5-5" />
        </>
      )}
      {section === "analyze" && (
        <>
          <path d="M4 20V11h4v9M10 20V4h4v16M16 20v-6h4v6M3 20h18" />
        </>
      )}
    </svg>
  );
}

export default function TrainingSectionNavigation({
  activeSection,
  transitionDuration,
  onSelect,
  onRegisterTrigger,
}: TrainingSectionNavigationProps) {
  return (
    <nav className="section-navigation" aria-label="Training sections">
      {trainingSections.map(({ id, label }) => (
        <motion.button
          key={id}
          ref={(element) => onRegisterTrigger?.(id, element)}
          type="button"
          className="section-trigger"
          aria-current={activeSection === id ? "page" : undefined}
          onClick={() => onSelect(id)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: transitionDuration }}
        >
          <TrainingSectionIcon section={id} />
          <span className="section-trigger-label">{label}</span>
        </motion.button>
      ))}
    </nav>
  );
}
