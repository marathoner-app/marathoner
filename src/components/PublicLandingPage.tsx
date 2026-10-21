import PublicAccessNotice from "./PublicAccessNotice";
import Subtitle from "./Subtitle";
import Title from "./Title";

type PublicLandingPageProps = {
  supportEmail?: string;
};

export default function PublicLandingPage({
  supportEmail,
}: PublicLandingPageProps) {
  return (
    <div className="landing-page" data-testid="public-landing-page">
      <div className="landing-page__frame">
        <header className="landing-page__introduction">
          <Title />
          <Subtitle />
        </header>
        <PublicAccessNotice supportEmail={supportEmail} />
      </div>
    </div>
  );
}
