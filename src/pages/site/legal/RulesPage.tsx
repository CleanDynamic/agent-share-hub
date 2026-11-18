// TB-02: /rules. Its own chunk; the text and the view load with it and with nothing else.
import { rules } from "@/content/legal/rules";
import { SITE_NAME } from "@/lib/site";

import { FooterPageView } from "./FooterPageView";
import { LegalPage } from "./LegalPage";

export default function RulesPage() {
  return (
    <LegalPage
      name="rules"
      text={rules}
      seoTitle="Community rules"
      description={`What can be posted on ${SITE_NAME}, what reproduced and rebuilt mean, and what happens when a rule is broken.`}
      path="/rules"
      view={<FooterPageView text={rules} path="/rules" />}
    />
  );
}
