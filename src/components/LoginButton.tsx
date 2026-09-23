import { useRef, useState } from "react";
import LoginForm from "./LoginForm";

type LoginButtonProps = {
  describedBy?: string;
};

const LoginButton = ({ describedBy }: LoginButtonProps) => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        aria-expanded={isLoginOpen}
        aria-haspopup="dialog"
        onClick={() => setIsLoginOpen(!isLoginOpen)}
      >
        Log in
      </button>
      {isLoginOpen && <LoginForm onClose={closeLogin} />}
    </div>
  );
};

export default LoginButton;
