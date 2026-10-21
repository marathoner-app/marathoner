import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicLandingPage from "./PublicLandingPage";

describe("PublicLandingPage", () => {
  it("keeps the honest access notice and existing-account login in the public shell", () => {
    render(<PublicLandingPage supportEmail="support@marathonerapp.com" />);

    expect(screen.getByTestId("public-landing-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Marathoner." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "New account registration is closed.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByText(/TestFlight/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign up/i })).not.toBeInTheDocument();
  });
});
