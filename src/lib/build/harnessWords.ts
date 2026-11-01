// SV-27 P1: the words for a harness, the ready-made software around a model that runs the agent loop (Claude Code,
// Cursor, OpenClaw). On screen only: `sessions_meta[key].tool` and an agent's `payload.harness` keep their keys.

/** What a session with no harness reads as, wherever it shows (Sources, Your sessions, the Map, Drafts, Home, Library). */
export const NO_HARNESS = "No harness chosen";

/** An agent's harness field, and its row for an agent built in the maker's own code (saved as no harness). */
export const HARNESS_COPY = {
  label: "Harness",
  select: "Select a harness",
  builtInCode: "Built in code (no harness)",
  /** SV-27: the third state: the maker did not say. Stores nothing; an old agent with no harness reads so too. */
  notSure: "Not sure",
  notSaid: "Not said",
} as const;
