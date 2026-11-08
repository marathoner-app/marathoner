import { createRoot } from "react-dom/client";
import "../../src/index.css";
import PublicLandingPage from "../../src/components/PublicLandingPage";

const root = document.querySelector("#root");
if (root === null) throw new Error("Landing-page viewport fixture root was not found.");
createRoot(root).render(
  <main>
    <PublicLandingPage
      interestFormEndpoint="https://app.loops.so/api/newsletter-form/viewport-fixture"
      interestMailingListId="public-list-1"
      supportEmail="support@marathonerapp.com"
    />
  </main>,
);
