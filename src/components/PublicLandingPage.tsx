import PublicAccessNotice from "./PublicAccessNotice";
import PublicLandingHeader from "./PublicLandingHeader";
import PublicLandingHero from "./PublicLandingHero";

type PublicLandingPageProps = {
  supportEmail?: string;
};

export default function PublicLandingPage({
  supportEmail,
}: PublicLandingPageProps) {
  return (
    <div className="landing-page" data-testid="public-landing-page">
      <div className="landing-page__frame">
        <PublicLandingHeader />
        <div className="landing-page__content">
          <PublicLandingHero />
          <PublicAccessNotice supportEmail={supportEmail} />
        </div>
      </div>
    </div>
  );
}
