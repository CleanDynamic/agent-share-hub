// UX-12 P1: the Privacy policy, as data. Every claim traces to a row of design/legal/data-inventory.md or to a placeholder.
// UK spelling, second person, short sentences. No em dashes.

import { PRIVACY_REVIEWED } from "./reviewed";
import type { LegalText } from "./types";

export const privacy: LegalText = {
  title: "Privacy policy",
  lastUpdated: "2026-11-06",
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
          text: "The provider is Anthropic, OpenAI or the Lovable AI gateway, whichever we have set up at the time. The provider's own terms say whether it keeps what it receives or uses it to train models: {{NEED: confirm each provider's API data terms}}.",
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
            ["Microlink", "Previews of links you paste. The address you paste is sent to it.", "{{NEED: where Microlink is based}}"],
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
          text: "Most of the services above are in the United States, so your data leaves the UK. Transfers rely on the UK's approved safeguards: the UK International Data Transfer Agreement or Addendum, or the UK-US data bridge. {{NEED: confirm the safeguard for each service}}",
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
            ["Account and profile", "Until your account is closed. {{NEED: retention period after closing}}"],
            ["Builds, drafts, topics, replies and comments", "Until you delete them or close your account."],
            ["Messages", "Until they are deleted. {{NEED: retention period}}"],
            ["Imports sent from your AI tool and not yet reviewed", "They are marked as expired after 7 days. {{NEED: when expired imports are deleted}}"],
            ["Reports", "{{NEED: retention period}}"],
            ["Notifications", "{{NEED: retention period}}"],
            ["Error reports", "{{NEED: Sentry retention period}}"],
          ],
        },
        {
          kind: "p",
          text: "When you delete something, it leaves the site at once. Copies can stay in backups for {{NEED: Supabase backup retention}} before they are overwritten.",
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
          text: "To use any of these, email {{NEED: privacy contact email}}. There is no button for deleting your account or downloading your data yet, so please ask by email. We will answer within one month.",
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
          text: "The site keeps a few things in your browser. All of them are strictly necessary, or a setting you chose, so no banner is needed.",
        },
        {
          kind: "table",
          head: ["What", "Why", "How long"],
          rows: [
            ["Your sign-in session", "To keep you signed in", "Until you sign out"],
            ["Theme (Light or Dark)", "To remember your choice", "Until you clear your browser"],
            ["Remembered filters, layout and view choices on Builds and the composer", "To remember how you like them", "Until you clear your browser"],
            ["What you have already seen (a badge, a note, a space's last visit)", "So the same note or badge is not shown again", "Until you clear your browser"],
            ["Scroll position, unsent prompts and your sign-up details if you leave to read these pages", "So going back puts you where you were. Your password is never kept.", "Until you close the tab"],
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
