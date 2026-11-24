// TB-02: the Community rules page, as data. Its words are the Terms' (terms.ts) plus what the code does; it adds no rule.
// `source: "terms"` sections copy the Terms' current wording. `source: "code"` sections state what the code does:
//   rebuilds: src/lib/build/rebuild.ts and fork.ts.

import { TERMS_VERSION } from "./legalConstants";
import { TERMS_REVIEWED } from "./reviewed";
import type { LegalText } from "./types";

export const rules: LegalText = {
  title: "Community rules",
  lastUpdated: TERMS_VERSION,
  reviewed: TERMS_REVIEWED,
  intro:
    "What can be posted on OpenBuilds.ai. These rules apply everywhere on the site, on top of a space's own rules. They are the same rules as the Terms, on one page.",
  sections: [
    {
      id: "what-you-must-not-do",
      heading: "What you must not post or do",
      source: "terms",
      blocks: [
        {
          kind: "list",
          items: [
            "post anything illegal",
            "post content you don't have the right to share",
            "post other people's personal data, secrets, passwords or API keys, including inside transcripts and sessions",
            "post malware, or builds meant to cause harm",
            "harass anyone, or post hate or threats",
            "post sexual content involving anyone under 18. We always report this",
            "pretend to be someone else",
            "spam, fake likes or follows, or make false claims that a build is reproduced",
            "scrape the site or overload it",
            "get around a block, a removal or a space's rules",
          ],
        },
      ],
    },
    {
      id: "rebuilds",
      heading: "Rebuilds",
      source: "code",
      blocks: [
        {
          kind: "p",
          text: "A rebuild is your own copy of someone's build, changed and published. It always credits the build it came from and shows what changed. A rebuild with nothing changed cannot be published.",
        },
      ],
    },
    {
      id: "spaces",
      heading: "Spaces",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "Anyone can make a space and set its rules. A space's creator and moderators can pin and hide posts inside it. The site's rules apply everywhere, on top of a space's own rules, and our staff can act in any space.",
        },
      ],
    },
    {
      id: "what-we-may-do",
      heading: "If a rule is broken",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "If something breaks these rules, we may remove it, limit what you can do on the site, or close your account. We will give a reason where we can.",
        },
        {
          kind: "p",
          text: "To tell us about something that breaks these rules, see Report a problem.",
          links: [{ text: "Report a problem", href: "/report" }],
        },
      ],
    },
  ],
};

export default rules;
