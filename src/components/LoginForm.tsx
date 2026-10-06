import { useState, useRef, useEffect } from "react";
import { requestPasswordReset, signIn } from "../services/authService";

type LoginMode = "login" | "reset";

const validEmailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordResetSuccessMessage =
  "If an account exists for that email address, a password reset link will arrive shortly. Check your spam folder if you do not see it.";

const getSubmitLabel = (mode: LoginMode, isSubmitting: boolean): string => {
  if (isSubmitting) {
    return mode === "login" ? "Logging in..." : "Sending...";
  }

  return mode === "login" ? "Log in" : "Send reset link";
};

const LoginForm = ({ onClose }: { onClose: () => void }) => {
  const [mode, setMode] = useState<LoginMode>("login");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setError(null);
    const email = emailAddress.trim();

    if (!validEmailAddress.test(email)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    if (mode === "login" && !password) {
      setError("Enter your password.");
      passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "reset") {
        await requestPasswordReset(email);
        setResetRequested(true);
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We could not complete that request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => setError(null);

  const showPasswordReset = () => {
    setMode("reset");
    setPassword("");
    setError(null);
    setResetRequested(false);
    emailRef.current?.focus();
  };

  const showLogin = () => {
    setMode("login");
    setError(null);
    setResetRequested(false);
    emailRef.current?.focus();
  };

  useEffect(() => {
    emailRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        !isSubmitting &&
        formRef.current &&
        !formRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (!isSubmitting && event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSubmitting, onClose]);

  return (
    <div
      ref={formRef}
      id="existing-account-login"
      className="login-popup"
      role="dialog"
      aria-labelledby="login-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="login-popup-header">
          <h2 id="login-title">
            {mode === "login" ? "Existing account login" : "Reset your password"}
          </h2>
          <button
            type="button"
            className="login-close"
            aria-label={
              mode === "login" ? "Close login" : "Close password reset"
            }
            disabled={isSubmitting}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {mode === "login" ? (
          <p className="login-help">
            Account creation is closed. This login is only for existing account
            holders.
          </p>
        ) : (
          <p className="login-help">
            Enter the email address for your existing Marathoner account.
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {resetRequested ? (
          <>
            <p className="login-success" role="status">
              {passwordResetSuccessMessage}
            </p>
            <button
              className="login-secondary"
              type="button"
              onClick={showLogin}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <label htmlFor="login-email">Email</label>
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={emailAddress}
              disabled={isSubmitting}
              onChange={(e) => {
                setEmailAddress(e.target.value);
                clearError();
              }}
              required
            />
            {mode === "login" && (
              <>
                <label htmlFor="login-password">Password</label>
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  required
                />
              </>
            )}
            <button
              className="login-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {getSubmitLabel(mode, isSubmitting)}
            </button>
            <button
              className="login-secondary"
              type="button"
              disabled={isSubmitting}
              onClick={mode === "login" ? showPasswordReset : showLogin}
            >
              {mode === "login" ? "Forgot password?" : "Back to login"}
            </button>
          </>
        )}
      </form>
    </div>
  );
};

export default LoginForm;
