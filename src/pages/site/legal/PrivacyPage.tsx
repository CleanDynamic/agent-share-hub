// UX-12 P2: /privacy. Its own chunk; the text and the view load with it and with nothing else.
import { privacy } from "@/content/legal/privacy";

import { LegalPage } from "./LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      name="privacy"
      text={privacy}
      seoTitle="Privacy policy · OpenBuilds"
      description="What OpenBuilds collects about you, why, who else sees it, and how to use your rights."
      path="/privacy"
    />
  );
}
