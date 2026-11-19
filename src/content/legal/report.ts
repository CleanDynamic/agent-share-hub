// TB-02: the Report a problem page, as data. Its words are the Terms' plus what the code does; it adds no promise.
// Evidence for the `code` section: src/components/block/BlockDialog.tsx, BLOCK_COPY in src/lib/settings/blocks.ts, and the
// "Privacy and blocking" settings section (src/lib/settings/sections.ts).

import { REPORT_NOTE_MAX, REPORT_REASONS } from "@/lib/moderation/reports";

import { TERMS_VERSION } from "./legalConstants";
import { TERMS_REVIEWED } from "./reviewed";
import type { LegalText } from "./types";

export const report: LegalText = {
  title: "Report a problem",
  lastUpdated: TERMS_VERSION,
  reviewed: TERMS_REVIEWED,
  intro: "How to report a build, a comment, a topic or a reply, how to block someone, and what to do if you think we got a decision wrong.",
  sections: [
    {
      id: "report-something",
      heading: "Report something",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "To report a build, a comment, a topic or a reply, use its Report action. Pick a reason and add a note if you like. We review reports and can hide the content or close the report without action. You are not sent a message about the outcome yet.",
        },
        {
          kind: "table",
          head: ["Reason", "Use it for"],
          rows: REPORT_REASONS.map((reason) => [reason.label, "{{NEED: one line for each reason}}"]),
        },
        {
          // REPORT_NOTE_MAX; one content_reports row per target and reporter (isDuplicate); signedOutError in reports.ts.
          kind: "p",
          text: `A note can be up to ${REPORT_NOTE_MAX} characters. You can report each thing once. You need to be signed in to report.`,
        },
      ],
    },
    {
      id: "block-someone",
      heading: "Block someone",
      source: "code",
      blocks: [
        {
          kind: "p",
          text: "Use Block on a person's profile, in the ··· menu of a topic or a reply, or in a message thread's menu. They won't be told. You can see and undo your blocks in Settings, under Privacy and blocking.",
          links: [{ text: "Settings", href: "/settings" }],
        },
      ],
    },
    {
      id: "children",
      heading: "Content involving children",
      source: "terms",
      blocks: [{ kind: "p", text: "Sexual content involving anyone under 18 is never allowed. We always report this." }],
    },
    {
      id: "appeals-and-complaints",
      heading: "If you think we got it wrong",
      source: "terms",
      blocks: [
        {
          kind: "p",
          text: "If you think we got a decision wrong, or want to complain about how we handled something, contact us: {{NEED: appeal route and contact}}. Say what happened and which content or account it is about.",
        },
      ],
    },
  ],
};

export default report;
