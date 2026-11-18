// TB-02: the Contact page, as data. Evidence for the `code` section: the "Download your data" and "Delete account" groups in
// src/pages/site/settings/DataView.tsx, and the `your-rights` section of privacy.ts.

import { TERMS_VERSION } from "./legalConstants";
import { TERMS_REVIEWED } from "./reviewed";
import type { LegalText } from "./types";

export const contact: LegalText = {
  title: "Contact",
  lastUpdated: TERMS_VERSION,
  reviewed: TERMS_REVIEWED,
  intro: "Who runs OpenBuilds.ai and how to reach us.",
  sections: [
    {
      id: "who-we-are",
      heading: "Who runs OpenBuilds.ai",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "OpenBuilds.ai is run by {{NEED: legal name of the business or person running the site}}, at {{NEED: postal address}}.",
        },
      ],
    },
    {
      id: "email",
      heading: "Email us",
      source: "terms",
      blocks: [{ kind: "p", text: "Questions about the site or these terms: {{NEED: privacy contact email}}." }],
    },
    {
      id: "your-data",
      heading: "Your data",
      source: "code",
      blocks: [
        {
          kind: "p",
          text: "You can download your data or delete your account in Settings. Your rights over your data, and how to use them, are in the Privacy policy.",
          links: [
            { text: "Settings", href: "/settings" },
            { text: "Privacy policy", href: "/privacy#your-rights" },
          ],
        },
      ],
    },
    {
      id: "reports",
      heading: "Reporting content",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "To report a build, a comment, a topic or a reply, use its Report action. See Report a problem.",
          links: [{ text: "Report a problem", href: "/report" }],
        },
      ],
    },
  ],
};

export default contact;
