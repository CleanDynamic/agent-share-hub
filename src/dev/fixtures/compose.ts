/* UI-P47 — the composer's sample data, as `ComposeView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**`, and by the
   view's unit test). No board exists for this page, so the draft is the
   prompt's own: a titled draft with a description and an audience and no cover.
   Nothing here reaches a production bundle. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { ComposeViewProps } from "@/pages/site/compose/ComposeView";
import { missingWords } from "@/pages/site/compose/composeModel";

export const COMPOSE_TITLE = "Photo renamer by date taken";
export const COMPOSE_DESCRIPTION = "Renames every photo in a folder to the date it was taken, so your camera roll sorts itself.";
export const COMPOSE_AUDIENCE = "photographers, families";

const noop = () => undefined;

export function composeViewProps(state: DesignState = "populated"): ComposeViewProps {
  const base: ComposeViewProps = {
    status: "ready",
    onRetry: noop,
    showStartLink: false,
    heading: COMPOSE_TITLE,
    title: COMPOSE_TITLE,
    description: COMPOSE_DESCRIPTION,
    audience: COMPOSE_AUDIENCE,
    audienceOptions: ["photographers", "families", "founders"],
    onTitle: noop,
    onDescription: noop,
    onAudience: noop,
    saveState: "saved",
    savedJustNow: true,
    onSaveRetry: noop,
    // Title and description are written; the cover and a prompt are not.
    missing: missingWords(["evidence", "instruction_or_artefact"]),
    slug: "photo-renamer-by-date-taken",
    published: null,
    publishing: false,
    onPublish: noop,
    media: { state: "empty" },
    onFile: noop,
    onReplace: noop,
    onRemoveMedia: noop,
  };
  if (state === "loading") return { ...base, status: "loading" };
  if (state === "error") return { ...base, status: "error" };
  if (state === "empty") {
    return {
      ...base,
      showStartLink: true,
      heading: "",
      title: "",
      description: "",
      audience: "",
      saveState: "idle",
      slug: null,
      missing: missingWords(["evidence", "title", "outcome", "instruction_or_artefact"]),
    };
  }
  return base;
}
