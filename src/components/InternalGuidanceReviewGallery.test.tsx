import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { foundingBetaGuidanceManifest } from "../domain/guidance/foundingBetaGuidanceManifest";
import { findBetaBlockingAccessibilityViolations } from "../test/accessibility";
import InternalGuidanceReviewGallery from "./InternalGuidanceReviewGallery";

describe("InternalGuidanceReviewGallery", () => {
  it("reviews the exact disabled draft copy one topic at a time", async () => {
    const user = userEvent.setup();
    render(<InternalGuidanceReviewGallery />);

    const easyEffort = foundingBetaGuidanceManifest.find(
      (item) => item.topic === "easy_effort",
    );
    const hydration = foundingBetaGuidanceManifest.find(
      (item) => item.topic === "hydration",
    );
    expect(easyEffort).toBeDefined();
    expect(hydration).toBeDefined();

    expect(
      screen.getByRole("heading", { name: easyEffort?.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(easyEffort?.body ?? "")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "not approved training guidance",
    );
    expect(screen.getByRole("button", { name: "Dismiss guidance" })).toBeDisabled();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Guidance topic" }),
      "hydration",
    );

    expect(
      screen.getByRole("heading", { name: hydration?.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(hydration?.body ?? "")).toBeInTheDocument();
    expect(screen.queryByText(easyEffort?.body ?? "")).not.toBeInTheDocument();
  });

  it("has no beta-blocking accessibility violations", async () => {
    render(<InternalGuidanceReviewGallery />);

    expect(await findBetaBlockingAccessibilityViolations()).toEqual([]);
  });
});
