import LoginButton from "./LoginButton";

export default function PublicLandingHeader() {
  return (
    <header className="landing-header">
      <span className="landing-header__wordmark">Marathoner.</span>
      <nav
        className="landing-header__navigation"
        aria-label="Public site"
      >
        <a href="#access-status">Current access</a>
        <LoginButton />
      </nav>
    </header>
  );
}
