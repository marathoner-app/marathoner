import { useRef, useState } from "react";
import LoginForm from "./LoginForm";
import PublicAccessNotice from "./PublicAccessNotice";
import PublicLandingHeader from "./PublicLandingHeader";
import PublicLandingHero from "./PublicLandingHero";
import PublicLandingHowItWorks from "./PublicLandingHowItWorks";
import PublicLandingPlatforms from "./PublicLandingPlatforms";

type PublicLandingPageProps = {
  supportEmail?: string;
};

export default function PublicLandingPage({
  supportEmail,
}: PublicLandingPageProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const activeLoginTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openLogin = (trigger: HTMLButtonElement) => {
    activeLoginTriggerRef.current = trigger;
    setIsLoginOpen(true);
  };

  const closeLogin = () => {
    setIsLoginOpen(false);
    window.requestAnimationFrame(() => activeLoginTriggerRef.current?.focus());
  };

  return (
    <div className="landing-page" data-testid="public-landing-page">
      <div className="landing-page__frame">
        <PublicLandingHeader
          isLoginOpen={isLoginOpen}
          onLoginOpen={openLogin}
        />
        <div className="landing-page__content">
          <PublicLandingHero
            isLoginOpen={isLoginOpen}
            onLoginOpen={openLogin}
          />
          <PublicLandingHowItWorks />
          <PublicLandingPlatforms
            isLoginOpen={isLoginOpen}
            onLoginOpen={openLogin}
          />
          <PublicAccessNotice supportEmail={supportEmail} />
        </div>
      </div>
      {isLoginOpen && <LoginForm onClose={closeLogin} />}
    </div>
  );
}
