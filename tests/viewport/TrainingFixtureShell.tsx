import type { ReactNode } from "react";
import SignedInAppHeader from "../../src/components/SignedInAppHeader";
import TrainingSectionNavigation from "../../src/components/TrainingSectionNavigation";
import type { TrainingSection } from "../../src/components/trainingSections";

/** Real app chrome around fixture data for full-screen visual review. */
export default function TrainingFixtureShell({
  activeSection,
  children,
}: {
  readonly activeSection: TrainingSection;
  readonly children: ReactNode;
}) {
  return (
    <main className="main">
      <SignedInAppHeader
        email="runner@example.com"
        onOpenAccountSettings={() => {
          window.location.href = "accountSettings.html";
        }}
        onLogout={() => undefined}
      />
      <TrainingSectionNavigation
        activeSection={activeSection}
        onSelectHome={() => {
          window.location.href = "signedInHome.html?workout=run&preview=1";
        }}
        onSelect={(section) => {
          window.location.href = `${section}.html?shell=1&mode=dashboard`;
        }}
      />
      <section className="section-panel" aria-label={activeSection}>
        <div className="section-panel-content">{children}</div>
      </section>
    </main>
  );
}
