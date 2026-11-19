// TB-02: /report. Its own chunk; the text and the view load with it and with nothing else.
import { report } from "@/content/legal/report";

import { FooterPageView } from "./FooterPageView";
import { LegalPage } from "./LegalPage";

export default function ReportPage() {
  return (
    <LegalPage
      name="report"
      text={report}
      seoTitle="Report a problem"
      description="How to report a build, a comment, a topic or a reply, how to block someone, and how to appeal a decision."
      path="/report"
      view={<FooterPageView text={report} path="/report" />}
    />
  );
}
