/* UI-P63 — the composer frame's sample data, as `SandboxView` takes it.

   DEV ONLY. Two builds: the one-prompt fox poster (board S1) and the bakery
   homepage (S3). Both are Lists; the bakery has three sessions, so Map is
   available and the one-time line shows. */

import type { DesignState } from "@/dev/useDesignTheme";
import { composeViewProps } from "@/dev/fixtures/compose";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { SandboxViewProps } from "@/pages/site/compose/SandboxView";
import type { SourcesPanelProps } from "@/pages/site/compose/SourcesPanel";
import type { SourcesFile, SourcesLibraryRow, SourcesSession } from "@/pages/site/compose/sourcesModel";

const noop = () => undefined;

export type SandboxFixture = "fox" | "bakery";

export function sandboxViewProps(which: SandboxFixture = "fox", state: DesignState = "populated"): SandboxViewProps {
  const base = composeViewProps(state);
  const fox = which === "fox";
  return {
    status: base.status,
    onRetry: noop,
    title: fox ? "A fox poster" : "Bakery homepage",
    onTitle: noop,
    description: fox ? "One prompt, one picture: a fox in a snowy wood." : "A warm homepage for a neighbourhood bakery, with opening hours and a menu.",
    onDescription: noop,
    audience: fox ? "designers" : "small businesses",
    onAudience: noop,
    audienceOptions: base.audienceOptions,
    cover: null,
    adding: null,
    mediaError: null,
    accept: base.accept,
    onFiles: noop,
    onRemoveCover: noop,
    madeWith: base.madeWith,
    onToggleMadeWith: noop,
    onAddMadeWith: noop,
    details: base.details,
    onDetail: noop,
    onGapSwitch: noop,

    save: "saved",
    onRetrySave: noop,
    missing: [{ key: "evidence", label: PUBLISH_WORDS.evidence }],
    slug: fox ? "a-fox-poster-k3f9x1" : "bakery-homepage-p2m8z4",
    published: null,
    publishing: false,
    onPublish: noop,

    counts: fox ? { sessions: 1, prompts: 1, files: 0 } : { sessions: 4, prompts: 5, files: 1 },
    lens: "list",
    onLens: noop,
    mapAvailable: !fox,
    mapHint: !fox,
  };
}

/* UI-P64 — Sources, as boards V2-List and S3-List draw it. The bakery has four
   sessions with a prompt each (the fourth gave two), CLAUDE.md, and a Midjourney
   session waiting; the fox poster has its one session and nothing else. */

const session = (
  number: number,
  tool: string,
  model: string,
  date: string,
  prompts: SourcesSession["prompts"],
): SourcesSession => ({ key: `s${number}`, sessionId: `s${number}`, number, tool, model, date, prompts });

const BAKERY_SESSIONS: SourcesSession[] = [
  session(1, "ChatGPT", "GPT-6 Astra", "3 Oct", [{ id: "p1", number: "1", title: "Brand brief", isDefault: false }]),
  session(2, "Claude", "Opus 5.5", "4 Oct", [{ id: "p2", number: "2", title: "Homepage copy", isDefault: false }]),
  session(3, "Gemini", "Gemini 4 Argon", "4 Oct", [{ id: "p3", number: "3", title: "Palette", isDefault: false }]),
  session(4, "Claude Code", "Sonnet 5.5", "6 Oct", [
    { id: "p4", number: "4", title: "Build the homepage", isDefault: false },
    { id: "p5", number: "5", title: "Prompt 5", isDefault: true },
  ]),
];

const FOX_SESSIONS: SourcesSession[] = [
  session(1, "Claude", "Opus 5.5", "2 Oct", [{ id: "p1", number: "1", title: "Prompt 1", isDefault: true }]),
];

const BAKERY_FILES: SourcesFile[] = [{ id: "f1", name: "CLAUDE.md", origin: "opened in session 4" }];

const BAKERY_LIBRARY: SourcesLibraryRow[] = [{ id: "l1", source: "Midjourney", line: "5 Oct · 6 prompts" }];

export function sourcesPanelProps(which: SandboxFixture = "fox", state: DesignState = "populated"): SourcesPanelProps {
  const fox = which === "fox";
  const empty = state === "empty";
  return {
    sessions: empty ? [] : fox ? FOX_SESSIONS : BAKERY_SESSIONS,
    files: empty || fox ? [] : BAKERY_FILES,
    library: fox ? [] : BAKERY_LIBRARY,
    libraryStatus: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    onRetryLibrary: noop,
    selected: fox || empty ? null : { kind: "prompt", id: "p4" },
    onSelect: noop,
    onAttachSession: noop,
    onFiles: noop,
    onPickFiles: noop,
    intakeNote: false,
  };
}
