import PublicAccessNotice from "./PublicAccessNotice";
import PublicLandingHeader from "./PublicLandingHeader";
import Subtitle from "./Subtitle";

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
        <div className="landing-page__lead">
          <Subtitle />
        </div>
        <PublicAccessNotice supportEmail={supportEmail} />
      </div>
    </div>
  );
}
