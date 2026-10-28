import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InternalSessionPlanNotice from "./InternalSessionPlanNotice";

describe("InternalSessionPlanNotice", () => {
  it.each([
    ["home", "The next-workout card is previewing this draft."],
    ["plan", "The Plan calendar is previewing this draft."],
  ] as const)(
    "labels the %s surface as a session-only rehearsal",
    (surface, surfaceDescription) => {
      render(
        <InternalSessionPlanNotice surface={surface} isAdapted={false} />,
      );

      const notice = screen.getByRole("complementary", {
        name: "Rehearsal preview, not a saved plan",
      });

      expect(notice).toHaveTextContent("Owner-only session draft");
      expect(notice).toHaveTextContent(surfaceDescription);
      expect(notice).toHaveTextContent(
        "It exists only in this browser session and has not been saved or approved.",
      );
      expect(notice).toHaveTextContent(
        "Track and completed-run writes continue to use synchronized training data.",
      );
    },
  );

  it.each([
    [
      "home",
      "The next-workout card is previewing the accepted rehearsal adjustment.",
    ],
    [
      "plan",
      "The Plan calendar is previewing the accepted rehearsal adjustment.",
    ],
  ] as const)(
    "identifies the accepted adjustment on the %s surface",
    (surface, surfaceDescription) => {
      render(
        <InternalSessionPlanNotice surface={surface} isAdapted={true} />,
      );

      const notice = screen.getByRole("complementary", {
        name: "Rehearsal preview, not a saved plan",
      });

      expect(notice).toHaveTextContent("Adjusted owner-only session draft");
      expect(notice).toHaveTextContent(surfaceDescription);
      expect(notice).toHaveTextContent(
        "The adjustment exists only in this browser session and has not been saved or approved.",
      );
    },
  );
});
