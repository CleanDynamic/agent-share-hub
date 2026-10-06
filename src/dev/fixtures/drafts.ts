/* UI-P46 — Drafts' sample data, as `DraftsView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**`, and by the
   view's unit test). There is no board for this page, so the rows below are the
   prompt's own table, with times written as offsets from a fixed `now` so the
   page reads the same on any day. Nothing here reaches a production bundle. */

import type { DraftListItem } from "@/lib/build/drafts";
import type { SessionSummary } from "@/lib/build/sessions";
import type { DesignState } from "@/dev/useDesignTheme";
import type { DraftsViewProps } from "@/pages/site/drafts/DraftsView";

/** 6 Oct 2026, mid-morning (UTC): "2 Oct" and "14 Sep" are neither today nor yesterday. */
export const DRAFTS_NOW = Date.parse("2026-10-06T10:00:00.000Z");

const minutes = (n: number) => new Date(DRAFTS_NOW - n * 60_000).toISOString();
const days = (n: number) => minutes(n * 1440);

export const draftsFixture: DraftListItem[] = [
  { id: "d1", title: "Photo renamer by date taken", sessionCount: 2, updatedAt: minutes(17) },
  { id: "d2", title: "Untitled build", sessionCount: 1, updatedAt: days(2) },
  { id: "d3", title: "Inbox triage v2", sessionCount: 0, updatedAt: days(3) },
  { id: "d4", title: "First MCP test", sessionCount: 1, updatedAt: days(12) },
];

const session = (id: string, firstPrompt: string, modelName: string, createdAt: string): SessionSummary => ({
  id,
  client: "claude",
  model: modelName,
  modelName,
  targetBuildId: null,
  firstPrompt,
  promptCount: 3,
  turnCount: 6,
  createdAt,
  buildId: null,
});

export const sessionsFixture: SessionSummary[] = [
  session("s1", "Every morning at 7, sort my Gmail into Clients, Admin, Newsletters or Ignore.", "GPT-6 Astra", "2026-10-02T09:00:00.000Z"),
  session("s2", "The n8n workflow fails on the Outlook trigger. Why?", "GPT-6 Astra", "2026-10-02T08:00:00.000Z"),
  session("s3", "Make the triage rules editable from a Google Sheet.", "GPT-6.1 Sol", "2026-10-01T09:00:00.000Z"),
  session("s4", "Explain this contract clause like I am 12.", "Opus 5.5", "2026-09-14T09:00:00.000Z"),
];

const attachedFixture: SessionSummary[] = [
  { ...session("s5", "Rename every photo in a folder by the date it was taken.", "Opus 5.5", "2026-09-30T09:00:00.000Z"), buildId: "d1" },
];

/** The view's props for a state; `?state=` on the dev page picks one. */
export function draftsViewProps(state: DesignState = "populated"): DraftsViewProps {
  const base: DraftsViewProps = {
    now: DRAFTS_NOW,
    status: "ready",
    onRetry: () => undefined,
    drafts: draftsFixture,
    sessions: sessionsFixture,
    attached: attachedFixture,
    showAttached: false,
    onToggleAttached: () => undefined,
    onAddToNew: () => undefined,
    onAddToDraft: () => undefined,
    onRemove: () => undefined,
    onConnect: () => undefined,
  };
  if (state === "loading") return { ...base, status: "loading" };
  if (state === "error") return { ...base, status: "error" };
  if (state === "empty") return { ...base, drafts: [], sessions: [], attached: [] };
  return base;
}
