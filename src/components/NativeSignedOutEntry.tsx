import { useEffect, useRef, useState } from "react";
import LoginForm from "./LoginForm";

type NativeSignedOutEntryProps = {
  readonly statusNotice?: string;
  readonly supportEmail: string;
};

type LoginMode = "login" | "reset";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function NativeSignedOutEntry({
  statusNotice,
  supportEmail,
}: NativeSignedOutEntryProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion);
  const [loginMode, setLoginMode] = useState<LoginMode | null>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const videoSource = `${import.meta.env.BASE_URL}landing/runner-hero.mp4`;
  const videoPoster = `${import.meta.env.BASE_URL}landing/runner-hero-poster.jpg`;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setIsReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const openLogin = (mode: LoginMode, trigger: HTMLButtonElement) => {
    activeTriggerRef.current = trigger;
    setLoginMode(mode);
  };

  const closeLogin = () => {
    setLoginMode(null);
    window.requestAnimationFrame(() => activeTriggerRef.current?.focus());
  };

  return (
    <div className="native-entry-shell">
      <div className="native-entry" data-testid="native-signed-out-entry">
        <div className="native-entry__media" aria-hidden="true">
          {isReducedMotion ? (
            <img
              className="native-entry__visual"
              src={videoPoster}
              alt=""
              data-testid="native-entry-poster"
            />
          ) : (
            <video
              className="native-entry__visual"
              autoPlay
              loop
              muted
              playsInline
              poster={videoPoster}
              preload="metadata"
              data-testid="native-entry-video"
            >
              <source src={videoSource} type="video/mp4" />
            </video>
          )}
        </div>

        <header className="native-entry__header">
          <img
            className="native-entry__icon"
            src={`${import.meta.env.BASE_URL}brand/marathoner-icon-128.png`}
            alt=""
          />
          <span className="native-entry__wordmark">Marathoner.</span>
        </header>

        <section
          className="native-entry__card"
          aria-labelledby="native-entry-title"
        >
          <p className="native-entry__status">Private founding beta</p>
          <h1 id="native-entry-title">Training for a marathon is enough work.</h1>
          <p className="native-entry__summary">
            Your plan, completed runs, and next training decision stay together
            in one daily companion.
          </p>

          {statusNotice && (
            <p className="native-entry__notice" role="alert">
              {statusNotice}
            </p>
          )}

          <div className="native-entry__actions">
            <button
              type="button"
              className="native-entry__primary"
              onClick={(event) => openLogin("login", event.currentTarget)}
            >
              Log in
            </button>
            <button
              type="button"
              className="native-entry__secondary"
              onClick={(event) => openLogin("reset", event.currentTarget)}
            >
              Reset password
            </button>
          </div>

          <a
            className="native-entry__support"
            href={`mailto:${supportEmail}?subject=Marathoner%20account%20support%20request`}
          >
            Contact support
          </a>
        </section>
      </div>

      {loginMode !== null && (
        <LoginForm initialMode={loginMode} onClose={closeLogin} />
      )}
    </div>
  );
}
