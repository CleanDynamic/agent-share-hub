// UX-12 P1: the Terms, as data. Every claim about what others can do traces to the code (see design/legal/data-inventory.md and
// the UX-04 to UX-09 work). A section whose feature does not exist is left out; there is no Payments section because no live
// payment was confirmed (inventory marker `live-payment`).

import { TERMS_REVIEWED } from "./reviewed";
import type { LegalText } from "./types";

export const terms: LegalText = {
  title: "Terms",
  lastUpdated: "2026-11-06",
  reviewed: TERMS_REVIEWED,
  intro:
    "These are the rules for using OpenBuilds. They are short on purpose. If something here is unclear, email us and we will explain it.",
  sections: [
    {
      id: "who-we-are-and-agreeing",
      heading: "Who we are and agreeing to these terms",
      blocks: [
        {
          kind: "p",
          text: "OpenBuilds (openbuilds.ai) is run by {{NEED: legal name of the business or person running the site}}, at {{NEED: postal address}}. By using the site or creating an account, you agree to these terms. If you don't agree, please don't use the site.",
        },
      ],
    },
    {
      id: "your-account",
      heading: "Your account",
      blocks: [
        {
          kind: "list",
          items: [
            "You must be at least {{NEED: minimum age, 13 or 18}} to have an account.",
            "One person, one account.",
            "Keep your password safe. You are responsible for what is posted from your account.",
            "If you connect an AI tool to the site, keep its connection and any API keys secret. Anyone who has them can act as you.",
          ],
        },
      ],
    },
    {
      id: "your-content-stays-yours",
      heading: "Your content stays yours",
      blocks: [
        {
          kind: "p",
          text: "You own what you make. To run the site, you give OpenBuilds a licence to host, show, copy, resize and send your content. The licence is worldwide and free, and it lasts for as long as your content is on the site. After you delete something, copies can stay in backups for a short time.",
        },
        {
          kind: "p",
          text: "The licence ends when you delete the content, except where other people have already made something from it, as the next section explains.",
        },
      ],
    },
    {
      id: "what-others-can-do",
      heading: "What others can do with your public builds",
      blocks: [
        { kind: "p", text: "This is the rule the site is built on. When you make a build public, other people can:" },
        {
          kind: "list",
          items: [
            "Rebuild it, which makes their own copy. It is shown as Rebuilt from you.",
            "Mark it as reproduced, which means it worked for them.",
            "Quote it in a reply, and start a topic from it. You can turn off starting a topic in the build's settings.",
          ],
        },
        {
          kind: "p",
          text: "Others can ask with anything, but they must answer with their own work. They can never reply using content that is yours in place of their own.",
        },
        {
          kind: "p",
          text: "If you delete a build, rebuilds that were already made stay. Their credit to you stays too, and it says the original is no longer available.",
        },
      ],
    },
    {
      id: "what-you-must-not-do",
      heading: "What you must not post or do",
      blocks: [
        { kind: "p", text: "Please don't:" },
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
      id: "spaces",
      heading: "Spaces",
      blocks: [
        {
          kind: "p",
          text: "Anyone can make a space and set its rules. A space's creator and moderators can pin and hide posts inside it. The site's rules apply everywhere, on top of a space's own rules, and our staff can act in any space.",
        },
      ],
    },
    {
      id: "reporting-and-complaints",
      heading: "Reporting and complaints",
      blocks: [
        {
          kind: "p",
          text: "To report a build, a comment, a topic or a reply, use its Report action. Pick a reason and add a note if you like. We review reports and can hide the content or close the report without action. You are not sent a message about the outcome yet.",
        },
        {
          kind: "p",
          text: "If you think we got a decision wrong, or want to complain about how we handled something, contact us: {{NEED: appeal route and contact}}. Say what happened and which content or account it is about.",
        },
      ],
    },
    {
      id: "what-we-may-do",
      heading: "What we may do",
      blocks: [
        {
          kind: "p",
          text: "If something breaks these terms, we may remove it, limit what you can do on the site, or close your account. We will give a reason where we can. You can close your account at any time by emailing {{NEED: privacy contact email}}.",
        },
      ],
    },
    {
      id: "no-promise-about-builds",
      heading: "Builds come with no promise",
      blocks: [
        {
          kind: "p",
          text: "Builds are made by people using AI. They may not work, they may change, and running one may cost you money with your own AI provider.",
        },
        {
          kind: "p",
          text: "Reproduced means another person said it worked for them. It does not mean OpenBuilds checked it. Run anything at your own risk, and read code before you run it.",
        },
      ],
    },
    {
      id: "our-responsibility",
      heading: "Our responsibility to you",
      blocks: [
        {
          kind: "p",
          text: "Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law of the UK does not allow us to limit. Your rights as a consumer are not affected.",
        },
        {
          kind: "p",
          text: "Beyond that, OpenBuilds is free to use, and we are not responsible for losses that were not a foreseeable result of our breaking these terms, or for what other people post. {{NEED: confirm liability wording with a reviewer}}",
        },
      ],
    },
    {
      id: "changes-to-these-terms",
      heading: "Changes to these terms",
      blocks: [
        {
          kind: "p",
          text: "The date at the top shows when these terms last changed. If we make a big change, we will tell you on the site before it starts.",
        },
      ],
    },
    {
      id: "the-law-that-applies",
      heading: "The law that applies",
      blocks: [
        {
          kind: "p",
          text: "These terms are governed by the laws of England and Wales. If you live in Scotland or Northern Ireland, you can also bring a claim in your local courts.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        {
          kind: "p",
          text: "Questions about these terms: {{NEED: privacy contact email}}.",
        },
      ],
    },
  ],
};

export default terms;
