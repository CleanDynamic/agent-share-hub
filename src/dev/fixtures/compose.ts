/* UI-P47 / UI-P48 — the composer's sample data, as `ComposeView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**`, and by the view's
   unit test). There is no board for this page, so the values are the prompts'
   own: a titled draft with a description and an audience, and no cover; two
   sessions (Claude Code on Sonnet 5.5 today, Claude on Opus 5.5 yesterday), of
   whose prompts three are already added — session 1's first and third, and
   session 2's first. */

import type { DesignState } from "@/dev/useDesignTheme";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { ComposeSession, ComposeViewProps } from "@/pages/site/compose/ComposeView";

const noop = () => undefined;

const SESSION_1 = "session-1";
const SESSION_2 = "session-2";

const PROMPTS_1 = [
  "Build me a script that renames photos by the date they were taken. Keep the original name in brackets.",
  "It says exiftool: command not found. What do I install?",
  "Skip files with no EXIF date and list them at the end.",
  "Run it on ~/Pictures/2024 and show me what changed.",
];

const PROMPTS_2 = [
  "My iPhone photos are HEIC. Make the script handle them too.",
  "WhatsApp photos have no capture date. Use the file's date for those instead.",
];

/** Session 1's first and third, and session 2's first. */
const ADDED: Record<string, readonly number[]> = { [SESSION_1]: [1, 3], [SESSION_2]: [1] };

const sessionPrompts = (id: string, texts: readonly string[]) =>
  texts.map((text, index) => ({ ordinal: index + 1, text, added: ADDED[id]?.includes(index + 1) ?? false }));

export const COMPOSE_SESSIONS: readonly ComposeSession[] = [
  { id: SESSION_1, number: 1, label: "Sonnet 5.5", modelKnown: true, date: "Today", prompts: sessionPrompts(SESSION_1, PROMPTS_1), promptsError: false },
  { id: SESSION_2, number: 2, label: "Opus 5.5", modelKnown: true, date: "Yesterday", prompts: sessionPrompts(SESSION_2, PROMPTS_2), promptsError: false },
];

export function composeViewProps(state: DesignState = "populated"): ComposeViewProps {
  const empty = state === "empty";
  return {
    status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    onRetry: noop,
    title: empty ? "" : "Photo renamer by date taken",
    onTitle: noop,
    description: empty ? "" : "Renames every photo in a folder to the date it was taken, so your camera roll sorts itself.",
    onDescription: noop,
    audience: empty ? "" : "photographers, families",
    onAudience: noop,
    audienceOptions: ["photographers", "families", "designers"],
    save: "idle",
    onRetrySave: noop,
    missing: empty ? [PUBLISH_WORDS.evidence, PUBLISH_WORDS.title, PUBLISH_WORDS.outcome, PUBLISH_WORDS.instruction_or_artefact] : [PUBLISH_WORDS.evidence],
    slug: empty ? null : "photo-renamer-by-date-taken-k3f9x1",
    published: null,
    publishing: false,
    onPublish: noop,
    cover: null,
    adding: null,
    mediaError: null,
    accept: ["image/png", "image/jpeg", "video/mp4"],
    onFiles: noop,
    onRemoveCover: noop,

    prompts: empty
      ? []
      : [
          { key: "prompt-1", text: PROMPTS_1[0], source: "Session 1 · Sonnet 5.5", saved: true },
          { key: "prompt-2", text: PROMPTS_1[2], source: "Session 1 · Sonnet 5.5", saved: true },
          { key: "prompt-3", text: PROMPTS_2[0], source: "Session 2 · Opus 5.5", saved: true },
        ],
    focusPrompt: null,
    onPromptText: noop,
    onMovePrompt: noop,
    onRemovePrompt: noop,
    onWritePrompt: noop,
    onDropPrompt: noop,

    sessionsStatus: "ready",
    onRetrySessions: noop,
    sessions: empty ? [] : COMPOSE_SESSIONS,
    onSessionsOpen: noop,
    onRetrySessionPrompts: noop,
    onAddSessionPrompt: noop,
    onSetSessionModel: noop,
    otherSessions: [],
    onAttachSession: noop,

    madeWith: empty
      ? []
      : [
          { key: "session:Claude Code · Sonnet 5.5", tool: "Claude Code", model: "Sonnet 5.5", label: "Claude Code · Sonnet 5.5", on: true, kind: "model" },
          { key: "session:Claude · Opus 5.5", tool: "Claude", model: "Opus 5.5", label: "Claude · Opus 5.5", on: true, kind: "model" },
        ],
    onToggleMadeWith: noop,
    onAddMadeWith: noop,

    details: { symptom: "", resolution: "", costMonthly: "", costSetup: "", firstResult: "", gapOn: false, gapProblem: "" },
    onDetail: noop,
    onGapSwitch: noop,
  };
}
