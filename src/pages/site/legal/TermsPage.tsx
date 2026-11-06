// UX-12 P2: /terms. Its own chunk; the text and the view load with it and with nothing else.
import { terms } from "@/content/legal/terms";

import { LegalPage } from "./LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      name="terms"
      text={terms}
      seoTitle="Terms · OpenBuilds"
      description="The rules for using OpenBuilds, what others can do with your public builds, and how to report a problem."
      path="/terms"
    />
  );
}
