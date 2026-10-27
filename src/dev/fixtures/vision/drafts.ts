/* SV-08: the Drafts vision board's sample data, as `DraftsView` takes it.

   Copied from the `<script type="text/x-dc">` block of `design/reference/vision/source/Drafts.dc.html`: twelve drafts of the
   board's 28 ("Show 16 more"), and its eight sessions. DEV ONLY (the dev page `vision-drafts` and the view's tests).
   Times are offsets from a fixed `now`, so the page reads the same on any day. */

import type { DraftListItem } from "@/lib/build/drafts";
import type { SessionSummary } from "@/lib/build/sessions";
import type { DesignState } from "@/dev/useDesignTheme";
import type { DraftsViewProps } from "@/pages/site/drafts/DraftsView";

/** 14 Oct 2026, mid-morning (UTC): "10 Oct" and "23 Sep" are neither today nor yesterday. */
export const VISION_DRAFTS_NOW = Date.parse("2026-10-14T10:00:00.000Z");

const hours = (n: number) => new Date(VISION_DRAFTS_NOW - n * 3_600_000).toISOString();
const days = (n: number) => hours(n * 24);

const UNTITLED = "Untitled build";

const drafts12: [string, number, string][] = [
  [UNTITLED, 2, hours(1)],
  [UNTITLED, 4, hours(2)],
  [UNTITLED, 2, days(1)],
  [UNTITLED, 0, days(1)],
  ["dddd", 1, days(3)],
  [UNTITLED, 0, days(3)],
  [UNTITLED, 2, days(3)],
  [UNTITLED, 1, days(3)],
  [UNTITLED, 0, days(4)],
  ["This session is being continued from a previous conversation", 1, days(14)],
  [UNTITLED, 2, days(14)],
  [UNTITLED, 0, days(14)],
];

/** The board shows twelve of 28 drafts; the other sixteen are plain, older ones. */
export const visionDrafts: DraftListItem[] = [
  ...drafts12.map(([title, sessionCount, updatedAt], index) => ({ id: `vd${index + 1}`, title, sessionCount, updatedAt })),
  ...Array.from({ length: 16 }, (_, index) => ({ id: `vd${index + 13}`, title: UNTITLED, sessionCount: index % 3, updatedAt: days(21 + index) })),
];

const session = (
  id: string,
  firstPrompt: string,
  client: string,
  modelName: string | null,
  createdAt: string,
  draftIds: string[],
): SessionSummary => ({
  id,
  client,
  model: modelName,
  modelName,
  targetBuildId: null,
  firstPrompt,
  promptCount: 3,
  turnCount: 6,
  createdAt,
  buildId: draftIds[0] ?? null,
  status: "claimed",
  draftIds,
});

export const visionSessions: SessionSummary[] = [
  session("vs1", "This session is being continued from a previous conversation", "claude", "Haiku 4.5", "2026-10-10T09:00:00.000Z", ["vd1", "vd2", "vd3"]),
  session("vs2", "This is my site https://agent-share-hub.lovable.app", "claude-code", null, "2026-10-08T09:00:00.000Z", ["vd1", "vd2", "vd3", "vd4"]),
  session("vs3", "Create 10 detailed implementation prompts (UI-P42 to UI-P51)", "claude", null, "2026-10-07T09:00:00.000Z", ["vd1", "vd2", "vd3", "vd4", "vd5"]),
  session("vs4", "Wire up keyboard shortcuts for the TipTap editor", "claude-code", null, "2026-10-03T09:00:00.000Z", ["vd1", "vd2", "vd3", "vd4"]),
  session("vs5", "I have uploaded 4 files: Final_transcript.pdf", "claude", null, "2026-09-25T09:00:00.000Z", ["vd1"]),
  session("vs6", "[Uploaded files: Final_transcript.pdf, IMG_8650.PNG]", "claude", null, "2026-09-25T08:00:00.000Z", ["vd1", "vd2"]),
  session("vs7", "What is Amazon customer article mobile number", "claude", null, "2026-09-24T09:00:00.000Z", ["vd1"]),
  session("vs8", "[Attached: buildgallery-brand-handover.md]", "claude", null, "2026-09-23T09:00:00.000Z", ["vd1"]),
];

/** The view's props for a state; `?state=` on the dev page picks one. */
export function visionDraftsProps(state: DesignState = "populated"): DraftsViewProps {
  const base: DraftsViewProps = {
    now: VISION_DRAFTS_NOW,
    draftsStatus: "ready",
    onRetryDrafts: () => undefined,
    sessionsStatus: "ready",
    onRetrySessions: () => undefined,
    drafts: visionDrafts,
    sessions: visionSessions,
    onAddToNew: () => undefined,
    onAddToDraft: () => undefined,
    onConnect: () => undefined,
  };
  if (state === "loading") return { ...base, draftsStatus: "loading", sessionsStatus: "loading" };
  if (state === "error") return { ...base, draftsStatus: "error", sessionsStatus: "error" };
  if (state === "empty") return { ...base, drafts: [], sessions: [] };
  return base;
}
