/* SV-18: the Add from Library board's sample data, as `AddFromLibraryWindow` takes it.

   Copied from `design/reference/vision/source/LibraryInsert.dc.html`: Session 2's Clean-up agent, four saved prompts, the second
   tab's three collections. DEV ONLY (the dev page `vision-composer-add-from-library` and the window's tests). The maker's
   pronoun in the board's footer is sample copy; the live window never infers one ("their step"). */

import type { DesignState } from "@/dev/useDesignTheme";
import type { AddFromLibraryWindowProps, LibraryWindowRow } from "@/pages/site/compose/AddFromLibraryWindow";

const noop = () => undefined;

export const visionLibraryInsertRows: LibraryWindowRow[] = [
  { id: "li1", title: "Summary on one prompt", state: "edited", detail: "Step 7 · Call notes that write themselves · @maya · Opus 5.5 · used in 4 builds", savedOn: "12 Oct", currentOn: "23 Oct" },
  { id: "li2", title: "Search plan", state: "same", detail: "Step 2 · Research brief agent · @mira · Opus 5.5 · used in 7 builds", savedOn: "3 Oct", currentOn: null },
  { id: "li3", title: "Label list for triage", state: "same", detail: "Step 1 · Inbox triage in one prompt · @kit · Sonnet 4.5 · used in 19 builds", savedOn: "28 Sep", currentOn: null },
  { id: "li4", title: "Objection classifier", state: "stale", detail: "Step 2 · Objection handling coach · @ava · last confirmed 5 months ago", savedOn: "14 May", currentOn: null },
];

export function visionAddFromLibraryProps(state: DesignState = "populated"): AddFromLibraryWindowProps {
  return {
    open: true,
    phone: false,
    place: "Session 2 · Clean-up agent",
    fits: "prompts",
    noun: "step",
    tab: "steps",
    counts: { steps: 14, collections: 3 },
    missing: "Sessions don't fit inside an agent",
    query: "",
    status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    rows: state === "empty" || state === "loading" || state === "error" ? [] : visionLibraryInsertRows,
    selectedId: state === "populated" ? "li1" : null,
    version: "saved",
    footer: "Copied as a new prompt with its source. @maya is credited on the tile, and their step will show used in 5 builds.",
    onTab: noop,
    onQuery: noop,
    onSelect: noop,
    onVersion: noop,
    onInsert: noop,
    onClose: noop,
    onRetry: noop,
  };
}
