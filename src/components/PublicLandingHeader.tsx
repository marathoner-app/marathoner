import LoginButton from "./LoginButton";
import Title from "./Title";

export default function PublicLandingHeader() {
  return (
    <header className="landing-header">
      <Title />
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
