import { useState } from "react";

import { foundingBetaGuidanceManifest } from "../domain/guidance/foundingBetaGuidanceManifest";
import type { GuidanceTopic } from "../domain/guidance/guidance";
import ReviewedGuidanceCard from "./ReviewedGuidanceCard";
import "./InternalGuidanceReviewGallery.css";

const topicLabels: Readonly<Record<GuidanceTopic, string>> = {
  easy_effort: "Easy effort",
  shoes: "Shoes",
  fueling: "Fueling",
  hydration: "Hydration",
  sleep: "Sleep",
  recovery: "Recovery",
  pain_escalation: "Pain and unusual symptoms",
  plan_change: "Plan changes",
  limitations: "Product limitations",
  unsupported_case: "Unsupported cases",
};

export default function InternalGuidanceReviewGallery() {
  const [selectedTopic, setSelectedTopic] =
    useState<GuidanceTopic>("easy_effort");
  const selectedItem = foundingBetaGuidanceManifest.find(
    (item) => item.topic === selectedTopic,
  );

  if (selectedItem === undefined) return null;

  return (
    <section
      id="internal-guidance-review"
      className="internal-guidance-gallery"
      aria-labelledby="internal-guidance-gallery-title"
    >
      <header>
        <p className="internal-guidance-gallery-eyebrow">Owner-only rehearsal</p>
        <h2 id="internal-guidance-gallery-title">Draft guidance review gallery</h2>
        <p>
          Review the exact draft copy as it would appear in the shared guidance
          card. Every item remains disabled, unapproved, and unavailable to
          runners.
        </p>
      </header>

      <label htmlFor="internal-guidance-topic">Guidance topic</label>
      <select
        id="internal-guidance-topic"
        value={selectedTopic}
        onChange={(event) =>
          setSelectedTopic(event.currentTarget.value as GuidanceTopic)
        }
      >
        {foundingBetaGuidanceManifest.map((item) => (
          <option key={item.topic} value={item.topic}>
            {topicLabels[item.topic]}
          </option>
        ))}
      </select>

      <ReviewedGuidanceCard
        model={{
          title: selectedItem.title,
          message: selectedItem.body,
          limitations: selectedItem.limitations,
          contextLabel: `${topicLabels[selectedItem.topic]} · ${selectedItem.contentVersion} · draft and disabled`,
          contentState: "internal_preview",
        }}
        state={{ kind: "ready" }}
        onDismiss={() => undefined}
        onRetry={() => undefined}
      />
    </section>
  );
}
