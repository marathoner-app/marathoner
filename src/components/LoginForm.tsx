import { useState, useRef, useEffect } from "react";
import { signIn } from "../services/authService";

const LoginForm = ({ onClose }: { onClose: () => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(username, password);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    }
  };

  useEffect(() => {
    emailRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={formRef}
      id="existing-account-login"
      className="login-popup"
      role="dialog"
      aria-labelledby="login-title"
    >
      <form onSubmit={handleSubmit}>
        <div className="login-popup-header">
          <h2 id="login-title">Existing account login</h2>
          <button
            type="button"
            className="login-close"
            aria-label="Close login"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="login-help">
          Account creation is closed. This login is only for existing account
          holders.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <label htmlFor="login-email">Email</label>
        <input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="login-submit" type="submit">
          Log in
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
