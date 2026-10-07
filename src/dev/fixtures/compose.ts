/* UI-P47 — the composer's sample data, as `ComposeView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**`, and by the view's
   unit test). There is no board for this page, so the values are the prompt's
   own: a titled draft with a description and an audience, and no cover. */

import type { DesignState } from "@/dev/useDesignTheme";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { ComposeViewProps } from "@/pages/site/compose/ComposeView";

const noop = () => undefined;

export function composeViewProps(state: DesignState = "populated"): ComposeViewProps {
  return {
    status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    onRetry: noop,
    title: state === "empty" ? "" : "Photo renamer by date taken",
    onTitle: noop,
    description: state === "empty" ? "" : "Renames every photo in a folder to the date it was taken, so your camera roll sorts itself.",
    onDescription: noop,
    audience: state === "empty" ? "" : "photographers, families",
    onAudience: noop,
    audienceOptions: ["photographers", "families", "designers"],
    save: "idle",
    onRetrySave: noop,
    missing: [PUBLISH_WORDS.evidence, PUBLISH_WORDS.instruction_or_artefact],
    slug: state === "empty" ? null : "photo-renamer-by-date-taken-k3f9x1",
    published: null,
    publishing: false,
    onPublish: noop,
    cover: null,
    adding: null,
    mediaError: null,
    accept: ["image/png", "image/jpeg", "video/mp4"],
    onFiles: noop,
    onRemoveCover: noop,
  };
}
