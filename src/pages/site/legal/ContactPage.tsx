// TB-02: /contact. Its own chunk; the text and the view load with it and with nothing else.
import { contact } from "@/content/legal/contact";
import { SITE_NAME } from "@/lib/site";

import { FooterPageView } from "./FooterPageView";
import { LegalPage } from "./LegalPage";

export default function ContactPage() {
  return (
    <LegalPage
      name="contact"
      text={contact}
      seoTitle="Contact"
      description={`Who runs ${SITE_NAME}, how to reach us, and where to manage your data.`}
      path="/contact"
      view={<FooterPageView text={contact} path="/contact" />}
    />
  );
}
