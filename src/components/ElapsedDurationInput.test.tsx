import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDurationSeconds } from "../domain/training";
import ElapsedDurationInput from "./ElapsedDurationInput";
import { readElapsedDuration } from "./elapsedDuration";

function durationFormData({
  hours = "",
  minutes = "",
  seconds = "",
}: {
  hours?: string;
  minutes?: string;
  seconds?: string;
}) {
  const formData = new FormData();
  formData.set("duration-hours", hours);
  formData.set("duration-minutes", minutes);
  formData.set("duration-seconds", seconds);
  return formData;
}

describe("ElapsedDurationInput", () => {
  it("presents one labeled group with phone-friendly numeric segments", () => {
    render(<ElapsedDurationInput legend="Elapsed time" name="duration" />);

    const group = screen.getByRole("group", { name: "Elapsed time" });
    const hours = within(group).getByRole("spinbutton", {
      name: "Elapsed time hours",
    });
    const minutes = within(group).getByRole("spinbutton", {
      name: "Elapsed time minutes",
    });
    const seconds = within(group).getByRole("spinbutton", {
      name: "Elapsed time seconds",
    });

    expect(hours).toHaveAttribute("inputmode", "numeric");
    expect(hours).not.toHaveAttribute("max");
    expect(minutes).toHaveAttribute("max", "59");
    expect(seconds).toHaveAttribute("max", "59");
  });

  it("splits a saved multi-hour duration across the edit segments", () => {
    render(
      <ElapsedDurationInput
        legend="Edit elapsed time"
        name="duration"
        defaultValue={createDurationSeconds(4 * 3600 + 5 * 60 + 6)}
      />,
    );

    expect(
      screen.getByRole("spinbutton", { name: "Edit elapsed time hours" }),
    ).toHaveValue(4);
    expect(
      screen.getByRole("spinbutton", { name: "Edit elapsed time minutes" }),
    ).toHaveValue(5);
    expect(
      screen.getByRole("spinbutton", { name: "Edit elapsed time seconds" }),
    ).toHaveValue(6);
  });
});

describe("readElapsedDuration", () => {
  it("converts sub-hour and multi-hour segments to duration seconds", () => {
    expect(
      readElapsedDuration(
        durationFormData({ minutes: "45", seconds: "30" }),
        "duration",
      ),
    ).toBe(createDurationSeconds(2_730));
    expect(
      readElapsedDuration(
        durationFormData({ hours: "4", minutes: "5", seconds: "6" }),
        "duration",
      ),
    ).toBe(createDurationSeconds(14_706));
  });

  it.each([
    {
      values: {},
      message: "Elapsed time must be greater than zero.",
    },
    {
      values: { minutes: "60" },
      message: "Minutes and seconds must be between 0 and 59.",
    },
    {
      values: { seconds: "1.5" },
      message:
        "Enter elapsed time using whole, nonnegative hours, minutes, and seconds.",
    },
  ])("rejects an invalid segmented duration", ({ values, message }) => {
    expect(() =>
      readElapsedDuration(durationFormData(values), "duration"),
    ).toThrow(message);
  });
});
