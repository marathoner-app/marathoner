import { describe, expect, it, vi } from "vitest";
import {
  InterestListSubmissionError,
  isLoopsFormEndpoint,
  submitInterestListSignup,
} from "./loopsInterestList";

const endpoint =
  "https://app.loops.so/api/newsletter-form/test-form-123";

describe("loopsInterestList", () => {
  it("accepts only the public Loops newsletter-form boundary", () => {
    expect(isLoopsFormEndpoint(endpoint)).toBe(true);
    expect(isLoopsFormEndpoint("https://example.com/collect")).toBe(false);
    expect(isLoopsFormEndpoint(undefined)).toBe(false);
  });

  it("submits normalized consented contact data without a credential", async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(null, { status: 200 });
      },
    );

    await expect(
      submitInterestListSignup({
        email: " Runner@Example.COM ",
        endpoint,
        mailingListId: "public-list-1",
        fetcher,
      }),
    ).resolves.toEqual({ status: "subscribed" });

    expect(fetcher).toHaveBeenCalledOnce();
    const [requestedEndpoint, request] = fetcher.mock.calls[0]!;
    if (!request) throw new Error("Expected interest-list request options.");
    expect(requestedEndpoint).toBe(endpoint);
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const body = new URLSearchParams(String(request.body));
    expect(Object.fromEntries(body)).toEqual({
      email: "runner@example.com",
      source: "marathoner-public-landing",
      mailingLists: "public-list-1",
    });
  });

  it("treats an existing contact as an idempotent success", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Email already subscribed" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );

    await expect(
      submitInterestListSignup({
        email: "runner@example.com",
        endpoint,
        fetcher,
      }),
    ).resolves.toEqual({ status: "already-subscribed" });
  });

  it("classifies provider throttling and network failures", async () => {
    await expect(
      submitInterestListSignup({
        email: "runner@example.com",
        endpoint,
        fetcher: vi.fn(
          async () => new Response(JSON.stringify({}), { status: 429 }),
        ),
      }),
    ).rejects.toMatchObject({
      code: "rate-limited",
    } satisfies Partial<InterestListSubmissionError>);

    await expect(
      submitInterestListSignup({
        email: "runner@example.com",
        endpoint,
        fetcher: vi.fn(async () => {
          throw new TypeError("offline");
        }),
      }),
    ).rejects.toMatchObject({
      code: "network",
    } satisfies Partial<InterestListSubmissionError>);
  });
});
