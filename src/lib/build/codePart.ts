// SV-30 P9: what a piece of code belongs to, and where it runs. PURE.
//
// A build with an eval harness holds code for the app, the harness and CI side by side. `payload.part_of` on a Code tile says which,
// and `payload.runs_where` (40 characters) says where it runs ("Terminal 2, in the harness folder", "GitHub Actions"). Unset reads as
// before. Both are the maker's to say; a copy keeps both (they are method).

export const PART_OF = ["app", "eval_harness", "ci", "setup"] as const;
export type PartOf = (typeof PART_OF)[number];

/** What the picker says. */
export const PART_OF_LABEL: Record<PartOf, string> = { app: "Part of the app", eval_harness: "Part of the eval harness", ci: "CI configuration", setup: "Setup script" };
/** What the line above the code says. */
export const PART_OF_SHORT: Record<PartOf, string> = { app: "App", eval_harness: "Eval harness", ci: "CI configuration", setup: "Setup script" };
export const RUNS_WHERE_MAX = 40;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const partOfOf = (payload: unknown): PartOf | null => (isRecord(payload) && PART_OF.includes(payload.part_of as PartOf) ? (payload.part_of as PartOf) : null);
export const runsWhereOf = (payload: unknown): string | null => {
  const said = isRecord(payload) && typeof payload.runs_where === "string" ? payload.runs_where.trim().slice(0, RUNS_WHERE_MAX) : "";
  return said || null;
};

/** "Eval harness · Terminal 2, in the harness folder"; null when neither is set. */
export function partLine(facts: { partOf?: PartOf | null; runsWhere?: string | null }): string | null {
  const parts = [facts.partOf ? PART_OF_SHORT[facts.partOf] : null, facts.runsWhere || null].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The words the setup prompt introduces a code file with. */
export const PART_INSTRUCTION: Record<PartOf, string> = {
  app: "Add this to the app",
  eval_harness: "Add this to the eval harness, not the app",
  ci: "Add this to the CI configuration, not the app",
  setup: "Run this as a setup script, not as part of the app",
};
