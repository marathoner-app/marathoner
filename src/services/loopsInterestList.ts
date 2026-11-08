export type InterestListSubmissionResult =
  | { status: "subscribed" }
  | { status: "already-subscribed" };

export type InterestListSubmissionErrorCode =
  | "configuration"
  | "rate-limited"
  | "provider"
  | "network";

export class InterestListSubmissionError extends Error {
  readonly code: InterestListSubmissionErrorCode;

  constructor(code: InterestListSubmissionErrorCode) {
    super(code);
    this.name = "InterestListSubmissionError";
    this.code = code;
  }
}

type SubmitInterestListSignupOptions = {
  email: string;
  endpoint: string;
  mailingListId?: string;
  fetcher?: typeof fetch;
};

const loopsFormEndpointPattern =
  /^https:\/\/app\.loops\.so\/api\/newsletter-form\/[a-zA-Z0-9_-]+$/;

export function isLoopsFormEndpoint(endpoint: string | undefined): boolean {
  return endpoint !== undefined && loopsFormEndpointPattern.test(endpoint);
}

const duplicateMessagePattern =
  /already (?:exists|subscribed)|contact exists|email exists/i;

async function readProviderMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    return typeof payload.message === "string" ? payload.message : "";
  } catch {
    return "";
  }
}

export async function submitInterestListSignup({
  email,
  endpoint,
  mailingListId,
  fetcher = fetch,
}: SubmitInterestListSignupOptions): Promise<InterestListSubmissionResult> {
  if (!isLoopsFormEndpoint(endpoint)) {
    throw new InterestListSubmissionError("configuration");
  }

  const body = new URLSearchParams({
    email: email.trim().toLowerCase(),
    source: "marathoner-public-landing",
  });

  if (mailingListId?.trim()) {
    body.set("mailingLists", mailingListId.trim());
  }

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch {
    throw new InterestListSubmissionError("network");
  }

  if (response.ok) return { status: "subscribed" };

  const providerMessage = await readProviderMessage(response);
  if (
    response.status === 400 &&
    duplicateMessagePattern.test(providerMessage)
  ) {
    return { status: "already-subscribed" };
  }

  if (response.status === 429) {
    throw new InterestListSubmissionError("rate-limited");
  }

  throw new InterestListSubmissionError("provider");
}
