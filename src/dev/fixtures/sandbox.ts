/* UI-P63 — the composer frame's sample data, as `SandboxView` takes it.

   DEV ONLY. Two builds: the one-prompt fox poster (board S1) and the bakery
   homepage (S3). Both are Lists; the bakery has three sessions, so Map is
   available and the one-time line shows. */

import type { DesignState } from "@/dev/useDesignTheme";
import { composeViewProps } from "@/dev/fixtures/compose";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { SandboxViewProps } from "@/pages/site/compose/SandboxView";

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
