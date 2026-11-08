import { useId, useState, type FormEvent } from "react";
import {
  InterestListSubmissionError,
  isLoopsFormEndpoint,
  submitInterestListSignup,
} from "../services/loopsInterestList";

type PublicInterestFormProps = {
  endpoint?: string;
  mailingListId?: string;
};

type FormState = "idle" | "submitting" | "subscribed" | "already-subscribed";

const errorMessages = {
  configuration:
    "Email updates are temporarily unavailable. Please check back soon.",
  "rate-limited": "Please wait a minute before trying again.",
  provider:
    "We couldn't add you to the list right now. Please try again shortly.",
  network:
    "We couldn't reach the signup service. Check your connection and try again.",
} as const;

export default function PublicInterestForm({
  endpoint,
  mailingListId,
}: PublicInterestFormProps) {
  const emailId = useId();
  const consentId = useId();
  const descriptionId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isConfigured = isLoopsFormEndpoint(endpoint);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!endpoint || !isConfigured || formState === "submitting") return;

    setErrorMessage(null);
    setFormState("submitting");

    try {
      const result = await submitInterestListSignup({
        email,
        endpoint,
        mailingListId,
      });
      setEmail("");
      setConsent(false);
      setFormState(result.status);
    } catch (error) {
      setFormState("idle");
      setErrorMessage(
        error instanceof InterestListSubmissionError
          ? errorMessages[error.code]
          : errorMessages.provider,
      );
    }
  };

  return (
    <div className="interest-signup" id="interest-list">
      <div className="interest-signup__copy">
        <p className="interest-signup__eyebrow">Marathoner updates</p>
        <h3>Hear when Marathoner is ready for more runners.</h3>
        <p id={descriptionId}>
          Join the interest list for occasional product and beta-access updates.
          This does not create an account or guarantee an invitation.
        </p>
      </div>

      {isConfigured ? (
        <form
          className="interest-signup__form"
          aria-describedby={descriptionId}
          onSubmit={submit}
        >
          <label htmlFor={emailId}>Email address</label>
          <div className="interest-signup__controls">
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              value={email}
              disabled={formState === "submitting"}
              onChange={(event) => {
                setEmail(event.target.value);
                setFormState("idle");
                setErrorMessage(null);
              }}
            />
            <button type="submit" disabled={formState === "submitting"}>
              {formState === "submitting" ? "Joining..." : "Get updates"}
            </button>
          </div>
          <label className="interest-signup__consent" htmlFor={consentId}>
            <input
              id={consentId}
              name="consent"
              type="checkbox"
              required
              checked={consent}
              disabled={formState === "submitting"}
              onChange={(event) => {
                setConsent(event.target.checked);
                setFormState("idle");
                setErrorMessage(null);
              }}
            />
            <span>
              Email me occasional Marathoner product and beta-access updates. I
              can unsubscribe at any time.
            </span>
          </label>
          {formState === "subscribed" && (
            <p className="interest-signup__success" role="status">
              You&apos;re on the list. If this is your first signup, a welcome
              email is on its way.
            </p>
          )}
          {formState === "already-subscribed" && (
            <p className="interest-signup__success" role="status">
              You&apos;re already on the list. We&apos;ll keep you posted.
            </p>
          )}
          {errorMessage && (
            <p className="interest-signup__error" role="alert">
              {errorMessage}
            </p>
          )}
        </form>
      ) : (
        <p className="interest-signup__unavailable" role="status">
          Email updates are temporarily unavailable. Please check back soon.
        </p>
      )}
    </div>
  );
}
