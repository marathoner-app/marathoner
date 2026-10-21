import { useRef, useState } from "react";
import LoginForm from "./LoginForm";

type LoginButtonProps = {
  describedBy?: string;
  isOpen?: boolean;
  label?: string;
  onOpen?: (trigger: HTMLButtonElement) => void;
};

const LoginButton = ({
  describedBy,
  isOpen,
  label = "Log in",
  onOpen,
}: LoginButtonProps) => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const loginOpen = onOpen ? Boolean(isOpen) : isLoginOpen;

  const closeLogin = () => {
    setIsLoginOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  };

  return (
    <div className="login-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className="login-btn"
        aria-controls="existing-account-login"
        aria-describedby={describedBy}
        aria-expanded={loginOpen}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (onOpen) {
            onOpen(event.currentTarget);
            return;
          }

          setIsLoginOpen(!isLoginOpen);
        }}
      >
        {label}
      </button>
      {!onOpen && isLoginOpen && <LoginForm onClose={closeLogin} />}
    </div>
  );
};

export default LoginButton;
