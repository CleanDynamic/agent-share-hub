/* UI-P63 — the composer frame's sample data, as `SandboxView` takes it.

   DEV ONLY. Two builds: the one-prompt fox poster (board S1) and the bakery
   homepage (S3). Both are Lists; the bakery has three sessions, so Map is
   available and the one-time line shows. */

import type { DesignState } from "@/dev/useDesignTheme";
import { composeViewProps } from "@/dev/fixtures/compose";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { SandboxViewProps } from "@/pages/site/compose/SandboxView";
import type { SourcesPanelProps } from "@/pages/site/compose/SourcesPanel";

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

    counts: fox ? { sessions: 1, prompts: 1, files: 0 } : { sessions: 3, prompts: 12, files: 2 },
    lens: "list",
    onLens: noop,
    mapAvailable: !fox,
    mapHint: !fox,
  };
}

/** The Sources panel's rows for each build: the fox poster's one session, the bakery's three, two files and two waiting. */
export function sandboxSourcesProps(which: SandboxFixture = "fox", state: DesignState = "populated"): SourcesPanelProps {
  const fox = which === "fox";
  const empty = state === "empty";
  return {
    phone: false,
    fine: true,
    status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    onRetry: noop,
    sessions: empty
      ? []
      : fox
        ? [{ key: "s1", number: 1, tool: "Claude", detail: "Opus 5.5 · 3 Mar", prompts: [{ id: "p1", number: "1", title: "Prompt 1", isDefault: true }] }]
        : [
            {
              key: "s1",
              number: 1,
              tool: "Claude",
              detail: "Opus 5.5 · 3 Mar",
              prompts: [
                { id: "p1", number: "1", title: "Write the homepage copy", isDefault: false },
                { id: "p2", number: "2", title: "Prompt 2", isDefault: true },
              ],
            },
            { key: "s2", number: 2, tool: "Claude Code", detail: "Sonnet 5.5 · 4 Mar", prompts: [{ id: "p3", number: "3", title: "Build the page", isDefault: false }] },
            { key: "typed-3", number: 3, tool: "ChatGPT", detail: "typed here", prompts: [{ id: "p4", number: "4", title: "Prompt 4", isDefault: true }] },
          ],
    files: empty || fox ? [] : [
      { id: "f1", name: "menu.pdf", note: "opened in session 1" },
      { id: "f2", name: "logo.png", note: "added by you" },
    ],
    library: empty || fox ? [] : [
      { id: "l1", label: "Claude", line: "1 Mar · 4 prompts", adding: false },
      { id: "l2", label: "Cursor", line: "28 Feb · 2 prompts", adding: false },
    ],
    selectedId: fox ? "p1" : "p3",
    onSelect: noop,
    onAddSession: noop,
    onDropFiles: noop,
    onPick: noop,
    connectHref: "/connect",
  };
}
