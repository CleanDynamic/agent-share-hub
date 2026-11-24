// UX-12 P1: the Privacy policy, as data. Every claim traces to a row of design/legal/data-inventory.md or to a placeholder.
// UK spelling, second person, short sentences. No em dashes.

import { PRIVACY_REVIEWED } from "./reviewed";
import { PRIVACY_VERSION } from "./legalConstants";
import type { LegalText } from "./types";

export const privacy: LegalText = {
  title: "Privacy policy",
  lastUpdated: PRIVACY_VERSION,
  reviewed: PRIVACY_REVIEWED,
  intro:
    "This explains what OpenBuilds.ai collects about you, why, who else sees it, and what you can do about it. We have tried to say only what the site actually does.",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          kind: "p",
          text: "OpenBuilds.ai is run by {{NEED: legal name of the business or person running the site}}. We decide what happens to your data and why, which makes us the controller under UK data protection law.",
        },
        {
          kind: "list",
          items: [
            "Postal address: {{NEED: postal address}}",
            "Privacy contact: {{NEED: privacy contact email}}",
            "ICO registration: {{NEED: ICO registration number, or remove}}",
          ],
        },
      ],
    },
    {
      id: "the-short-version",
      heading: "The short version",
      blocks: [
        {
          kind: "list",
          items: [
            "Your builds, your profile, and the topics and replies you post are public by default. Anyone can read them without signing in.",
            "Your drafts, your saves and your messages are private.",
            "We don't sell your data and we don't share it for advertising.",
            "Some of your content is processed by an AI provider, but only when you ask for it.",
            "We don't use analytics or advertising cookies.",
            "You can ask to see, correct or delete your data at any time.",
          ],
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect, and why",
      blocks: [
        {
          kind: "table",
          head: ["What", "Why", "Legal basis"],
          rows: [
            [
              "Account: your email address, a password (stored hashed, so nobody can read it), and the details a sign-in provider passes on if you use Google, GitHub or X.",
              "To create your account, sign you in and let you recover it.",
              "Contract (providing the account you asked for).",
            ],
            [
              "Profile: username, display name, bio, location, website, avatar, banner, links, follower and following counts, and a short summary line the site writes from the topics and tools in your own published builds.",
              "To show who made what.",
              "Contract. You choose what to fill in.",
            ],
            [
              "What you make: builds, their steps, sessions and transcripts, drafts, uploads, imports and any pictures or files you add.",
              "To host, show and let others rebuild what you share.",
              "Contract.",
            ],
            [
              "Social activity: follows, likes, comments, topics, replies, spaces you join, notifications, and what you save.",
              "To run the social features of the site.",
              "Contract.",
            ],
            [
              "Messages you send to other people, including pictures and voice notes.",
              "To deliver them to the people in the conversation.",
              "Contract.",
            ],
            [
              "Reports: what you report, the reason you pick and an optional note of up to 500 characters.",
              "To review reports and keep the site safe.",
              "Legitimate interests (moderating the site and keeping it secure). Legal obligation where the law requires us to act on illegal content.",
            ],
            [
              "Error reports: the kind of error, the page address without its query, the ids of the build or step involved, and your user id if you were signed in. Never the text of an error message, a prompt or anything you wrote.",
              "To find and fix faults.",
              "Legitimate interests (fixing errors).",
            ],
            [
              "Browser storage: your sign-in session and a few settings kept on your device (see Cookies and browser storage).",
              "To keep you signed in and remember your choices.",
              "Strictly necessary, so no consent is needed.",
            ],
          ],
        },
      ],
    },
    {
      id: "what-is-public",
      heading: "What is public",
      blocks: [
        { kind: "p", text: "Without signing in, anyone can see:" },
        {
          kind: "list",
          items: [
            "your public builds, including their steps, and who made them",
            "your public profile: username, display name, bio, location, website, avatar, banner and your follower and following counts",
            "topics and replies you post in a public space",
            "likes and comments on public builds",
          ],
        },
        {
          kind: "p",
          text: "If you turn on a private profile, the profile page shows less. Your drafts are visible only to you. Your saves are never shown to anyone else. Your messages are visible only to the people in the conversation.",
        },
        {
          kind: "p",
          text: "A public build can be rebuilt by other people, marked as reproduced, quoted in a reply, and used to start a topic. You can turn off starting a topic from a build in the build's settings. The Terms explain what others can do with your public builds.",
        },
        {
          kind: "p",
          text: "Files in public storage (avatars, profile pictures, shared files and results) can be opened by anyone who has the link.",
        },
      ],
    },
    {
      id: "ai-processing",
      heading: "AI processing",
      blocks: [
        {
          kind: "p",
          text: "When you ask the site to write the plain-language explanations of a build, it sends a short description of that build to an AI provider. The description holds the kinds of steps, their titles and notes, and the main text of each step (for a prompt step, the prompt itself). It does not send whole files or anything outside that build. The site uses the key we hold with the provider, not one of yours.",
        },
        {
          kind: "p",
          text: "The provider is Anthropic, OpenAI or the Lovable AI gateway, whichever we have set up at the time.",
        },
        // G14 (prompt 9), for reviewer sign-off. Each fact from the provider's own page, read 17 November 2026:
        //   Anthropic, no training: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training (page dated 18 Aug 2026);
        //     Commercial Terms B: https://www.anthropic.com/legal/commercial-terms (effective 17 Jun 2025)
        //   Anthropic, 30 days, flagged up to 2 years: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data (page dated 1 Jul 2026)
        //   OpenAI, no training, abuse-monitoring logs up to 30 days: https://developers.openai.com/api/docs/guides/your-data (no date shown)
        //   Lovable: its terms, privacy policy and data processing agreement disagree on training, and its retention depends on our
        //     plan and the "AI app context" setting (docs.lovable.dev/features/ai and /features/privacy-and-security-settings). Left open.
        {
          kind: "list",
          items: [
            "Anthropic does not use what its API receives to train its models. It deletes it within 30 days, unless its safety systems flag it, when it can keep it for up to 2 years.",
            "OpenAI does not use what its API receives to train its models. It keeps it in its abuse-monitoring logs for up to 30 days.",
            "The Lovable AI gateway: {{NEED: Lovable AI gateway's training and retention terms for our plan}}",
          ],
        },
        {
          kind: "p",
          text: "Nothing else on the site sends your content to an AI model. The summary line on your profile is written by the site's own code from your published builds, with no AI. If you connect your own AI tool, what it sends us is covered under Who we share it with, and what that tool does with your conversation is between you and the tool.",
        },
      ],
    },
    {
      id: "who-we-share-with",
      heading: "Who we share it with",
      blocks: [
        {
          kind: "p",
          text: "These companies process data for us, or provide the sign-in you chose. They act on our instructions. We don't sell your data and we don't share it for advertising. A sign-in provider only receives what its own sign-in needs.",
        },
        {
          kind: "table",
          head: ["Service", "What for", "Where it is based"],
          rows: [
            ["Supabase", "Database, sign-in, file storage and server functions", "United States. {{NEED: confirm the region of our Supabase project}}"],
            ["Netlify", "Hosting the website", "United States"],
            ["Lovable", "Building the site, and its AI gateway", "Sweden"],
            ["Cloudflare", "Hosting the site's share image", "United States"],
            ["Anthropic", "Writing build explanations, when a maker asks", "United States"],
            ["OpenAI", "Writing build explanations, when a maker asks", "United States"],
            ["GitHub", "Reading a public repository you import, and signing in", "United States"],
            ["Google", "Signing in", "United States"],
            ["X", "Signing in", "United States"],
            // G14, for reviewer sign-off: Microlink Labs, S.L., Murcia, Spain. https://microlink.io/terms (section 1) and
            // https://microlink.io/dpa ("Spain, EU"), read 17 November 2026; neither page shows a date.
            ["Microlink", "Previews of links you paste. The address you paste is sent to it.", "Spain"],
            ["Sentry", "Finding and fixing errors", "United States"],
          ],
        },
        {
          kind: "p",
          text: "We may also share data if the law or a court requires it, or to protect people from serious harm.",
        },
      ],
    },
    {
      id: "data-outside-the-uk",
      heading: "Data outside the UK",
      blocks: [
        {
          kind: "p",
          text: "Most of the services above are in the United States, so your data leaves the UK. Transfers rely on the UK's approved safeguards: the UK International Data Transfer Agreement or Addendum, or the UK-US data bridge. Each service's safeguard is below.",
        },
        // G14, for reviewer sign-off. Each from the service's own page, read 17 November 2026:
        //   Supabase: DPA Schedule 2 (EU SCCs, UK Addendum), https://supabase.com/legal/dpa (Version 1, 1 Aug 2026)
        //   Netlify: Privacy Statement s.13 (DPF and UK Extension), https://www.netlify.com/privacy/ (updated 4 Nov 2026); its DPA page was not found
        //   Cloudflare: DPA s.6.4 (DPF incl. UK Extension; SCCs with UK Addendum as fallback), https://www.cloudflare.com/cloudflare-customer-dpa/ (v6.4, 3 Apr 2026)
        //   Anthropic: DPA Schedule 3 (EU SCCs, UK Addendum), https://www.anthropic.com/legal/data-processing-addendum (effective 24 Feb 2025)
        //   GitHub: DPA s.7.B (DPF and UK Extension), https://github.com/customer-terms/github-data-protection-agreement; privacy statement agrees (27 Apr 2026)
        //   Google: https://policies.google.com/privacy/frameworks (DPF and UK Extension; effective 23 Aug 2025)
        //   Sentry: DPA Schedule 3 and https://sentry.io/trust/privacy/ (DPF and UK Extension); its fallback differs between the DPA
        //     (UK Addendum) and the privacy policy (IDTA), so only the primary safeguard is stated
        //   Microlink: in Spain; DPA s.11 names EU SCCs and the UK Addendum for its own transfers outside the EEA, https://microlink.io/dpa
        //   OpenAI and X: their pages refused automated reading (403, 402). Lovable: its privacy policy names Lovable Labs Sweden AB,
        //     its DPA a US importer, Lovable Labs Incorporated. All three are left open.
        {
          kind: "table",
          head: ["Service", "Safeguard"],
          rows: [
            ["Supabase", "Standard contractual clauses with the UK Addendum"],
            ["Netlify", "The UK-US data bridge (the UK Extension to the EU-US Data Privacy Framework)"],
            ["Cloudflare", "The UK-US data bridge, with standard contractual clauses and the UK Addendum as a fallback"],
            ["Anthropic", "Standard contractual clauses with the UK Addendum"],
            ["OpenAI", "{{NEED: OpenAI's transfer safeguard}}"],
            ["GitHub", "The UK-US data bridge"],
            ["Google", "The UK-US data bridge"],
            ["X", "{{NEED: X's transfer safeguard}}"],
            ["Sentry", "The UK-US data bridge"],
            ["Microlink", "Based in the EU. For its own transfers outside it, standard contractual clauses with the UK Addendum"],
            ["Lovable", "{{NEED: Lovable's contracting entity and transfer safeguard}}"],
          ],
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      heading: "How long we keep it",
      blocks: [
        {
          kind: "table",
          head: ["What", "How long"],
          rows: [
            ["Account and profile", "Until you delete your account in Settings › Your data. They leave the site at once."],
            ["Builds, drafts, topics, replies and comments", "Until you delete them or delete your account."],
            ["Messages", "Until they are deleted. {{NEED: retention period}}"],
            ["Imports sent from your AI tool and not yet reviewed", "They are marked as expired after 7 days. {{NEED: when expired imports are deleted}}"],
            ["Reports", "{{NEED: retention period}}"],
            ["Notifications", "{{NEED: retention period}}"],
            // G14: Sentry keeps errors 30 days on its Developer plan and 90 days on Team, Business and Enterprise.
            // https://docs.sentry.io/security-legal-pii/security/data-retention-periods/ (read 17 November 2026, no date shown).
            // Which applies depends on our plan, so the placeholder stays (owner-answers.md).
            ["Error reports", "{{NEED: Sentry retention period}}"],
          ],
        },
        {
          kind: "p",
          text: "When you delete something, or your whole account, it leaves the site at once. Deleting is immediate apart from backups: copies can stay in backups for {{NEED: Supabase backup retention}} before they are overwritten.",
        },
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [
        { kind: "p", text: "You have the right to:" },
        {
          kind: "list",
          items: [
            "see the data we hold about you (access)",
            "have wrong data corrected",
            "have your data deleted",
            "ask us to limit how we use it (restriction)",
            "object to us using it for our legitimate interests",
            "receive it in a form you can move elsewhere (portability)",
            "withdraw consent at any time, where we rely on it",
          ],
        },
        {
          kind: "p",
          text: "You can download your data and delete your account yourself, in Settings › Your data. For anything else, or if you would rather ask, email {{NEED: privacy contact email}}. We will answer within one month.",
        },
        {
          kind: "p",
          text: "If you are unhappy with how we handled your data, you can complain to the Information Commissioner's Office at ico.org.uk. We would like the chance to put it right first.",
        },
      ],
    },
    {
      id: "cookies-and-browser-storage",
      heading: "Cookies and browser storage",
      blocks: [
        {
          kind: "p",
          text: "The site's own code sets no cookies. It keeps the things below in your browser's own storage on this device: local storage (kept until it is removed), session storage (gone when you close the tab) and, for one item, the browser's database. Each is strictly necessary for something you asked for, or remembers a choice you made, apart from one older item marked below.",
        },
        // G16: generated from a search of the code for every write to localStorage, sessionStorage, IndexedDB and cookies.
        // Each row names its key; the file and line are in prompt 9's report.
        {
          kind: "table",
          head: ["What (key)", "Kept in", "What for", "How long"],
          rows: [
            ["Your sign-in session (sb-…-auth-token, written by our sign-in provider's library)", "Local storage, or session storage if you untick Keep me signed in", "To keep you signed in", "Until you sign out, or until you close the browser if you unticked Keep me signed in"],
            ["Keep me signed in (ob-keep-signed-in)", "Local storage", "To remember that you unticked Keep me signed in", "Until you tick it again"],
            ["A sign-out marker (ob-signed-out-on-purpose)", "Local storage", "So your other open tabs know you signed out on purpose, and don't ask you to sign in again", "Read for 10 seconds after you sign out; replaced at your next sign-out"],
            ["The address you signed up with (pending_verification_email)", "Session storage", "To name it on the Check your inbox screen", "Until you confirm it, sign out or close the sign-in window"],
            ["Your sign-up details (signup_draft)", "Session storage", "To keep your name, username and email if you leave the form to read these pages. Your password is never kept.", "Until you come back to the form, or close the tab"],
            ["Where you were (ob-return-place)", "Session storage", "To put you back on the page you were reading after you sign in", "10 minutes, and used once"],
            ["Theme (bg-theme)", "Local storage", "To remember Light or Dark", "Until you clear your browser"],
            ["A copy of pages you have read (bg-kept-cache)", "The browser's database (IndexedDB)", "So pages open quickly and can still be read offline", "Up to 24 hours. Removed when you sign out, or when someone else signs in on this device"],
            ["Changes made while offline (bg:pending:…)", "Local storage", "To hold your edits to a build until they reach our servers, so a reload loses nothing", "Until they have been saved"],
            ["Unsent prompts (ux-unsent:…, ux-unsent-tab)", "Session storage", "To keep a prompt you typed but did not send", "Until you send it, or close the tab"],
            ["Scroll position (scroll:v1:…)", "Session storage", "So Back and Forward return you to where you were on a page", "Until you close the tab"],
            ["Builds layout and chosen filters (builds:layout:v1, builds:facets:v1)", "Local storage", "To remember how you like the Builds page", "Until you clear your browser"],
            ["Composer view (bg-compose-view:…)", "Local storage", "To remember how the composer's session list is shown", "Until you clear your browser"],
            ["A declined review (openbuilds.layer-review.declined.…)", "Local storage", "So a build's explanation review is not offered again after you said no", "Until you clear your browser"],
            ["What you have already seen (bg-home-seen, openbuilds:seen:…)", "Local storage", "To mark what is new on Home and in a space, and not show a note again", "Until you clear your browser"],
            ["A collapsed panel in Messages (pinned-context-collapsed:…)", "Local storage", "To remember that you folded a conversation's pinned context", "Until you clear your browser"],
            ["An ad shown on a page (openbuilds_page_ad_shown_…). Not strictly necessary.", "Session storage", "On older content pages, so a visitor who is not signed in sees a page's ad once per visit", "Until you close the tab"],
          ],
        },
        {
          kind: "p",
          text: "We don't use analytics or advertising cookies. If that changes, this section and the way we ask will change first.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        {
          kind: "p",
          text: "You must be at least {{NEED: minimum age, 13 or 18}} to have an account. If we learn that an account belongs to someone younger, we will close it and delete its data. If you think that has happened, email {{NEED: privacy contact email}}.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          kind: "p",
          text: "The date at the top shows when this page last changed. If we make a big change, we will tell you on the site before it starts.",
        },
      ],
    },
  ],
};

export default privacy;
