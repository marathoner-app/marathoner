import LoginButton from "./LoginButton";

type PublicLandingHeaderProps = {
  isLoginOpen: boolean;
  onLoginOpen: (trigger: HTMLButtonElement) => void;
};

export default function PublicLandingHeader({
  isLoginOpen,
  onLoginOpen,
}: PublicLandingHeaderProps) {
  return (
    <header className="landing-header">
      <span className="landing-header__wordmark">Marathoner.</span>
      <nav
        className="landing-header__navigation"
        aria-label="Public site"
      >
        <a href="#access-status">Current access</a>
        <LoginButton isOpen={isLoginOpen} onOpen={onLoginOpen} />
      </nav>
    </header>
  );
}
