import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicInterestForm from "./PublicInterestForm";

const endpoint =
  "https://app.loops.so/api/newsletter-form/test-form-123";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PublicInterestForm", () => {
  it("requires a valid email and explicit consent", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicInterestForm endpoint={endpoint} />);

    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "runner@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Get updates" }));

    expect(fetcher).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /Email me occasional Marathoner product and beta-access updates/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Get updates" }));

    expect(fetcher).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        "You're on the list. If this is your first signup, a welcome email is on its way.",
      ),
    ).toBeInTheDocument();
  });

  it("gives an existing contact a calm success state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Contact exists" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    render(<PublicInterestForm endpoint={endpoint} />);

    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "runner@example.com",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Get updates" }));

    expect(
      await screen.findByText("You're already on the list. We'll keep you posted."),
    ).toBeInTheDocument();
  });

  it("explains throttling without leaking provider details", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "provider detail" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    render(<PublicInterestForm endpoint={endpoint} />);

    await user.type(
      screen.getByRole("textbox", { name: "Email address" }),
      "runner@example.com",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Get updates" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please wait a minute before trying again.",
    );
    expect(screen.queryByText("provider detail")).not.toBeInTheDocument();
  });

  it("shows a non-interactive fallback when the public endpoint is absent", () => {
    render(<PublicInterestForm />);

    expect(
      screen.getByText(
        "Email updates are temporarily unavailable. Please check back soon.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
