/* UI-P47 — the composer's small rules, pure: what publishing still needs, how
   it is said, how "Who it's for" is parsed and what the status line reads.

   WHAT PUBLISHING NEEDS is `computeCompleteness(...).missing` restricted to
   `MINIMUM_PUBLISHABLE_KEYS`, plus the title. The title counts as missing when
   it is empty or "Untitled build". The order is the canvas's, not the
   registry's: a cover picture or video, a title, a description, a prompt. */

import { MINIMUM_PUBLISHABLE_KEYS, type Completeness, type RequirementKey } from "@/lib/build/signals";

export const UNTITLED = "Untitled build";

/** The most "Who it's for" entries a build carries. */
export const AUDIENCE_MAX = 4;

/** The description's length. `builds.outcome` has no limit of its own, so this is the composer's. */
export const DESCRIPTION_MAX = 200;

export type PublishKey = "evidence" | "title" | "outcome" | "instruction_or_artefact";

/** The canvas's order. */
export const PUBLISH_ORDER: readonly PublishKey[] = ["evidence", "title", "outcome", "instruction_or_artefact"];

/** In plain words. */
export const PUBLISH_WORDS: Record<PublishKey, string> = {
  evidence: "a cover picture or video",
  title: "a title",
  outcome: "a description",
  instruction_or_artefact: "a prompt",
};

export const isUntitled = (title: string | null | undefined): boolean => {
  const trimmed = (title ?? "").trim();
  return trimmed === "" || trimmed === UNTITLED;
};

/**
 * What the build still needs before it can be published, in the canvas's order.
 * `completeness` is null before the draft exists, when everything is missing.
 */
export function missingForPublish(input: {
  title: string | null | undefined;
  completeness: Pick<Completeness, "missing"> | null;
}): PublishKey[] {
  const open = new Set<RequirementKey>(
    input.completeness
      ? input.completeness.missing.map((item) => item.key)
      : (MINIMUM_PUBLISHABLE_KEYS as readonly RequirementKey[]),
  );
  return PUBLISH_ORDER.filter((key) => (key === "title" ? isUntitled(input.title) : open.has(key)));
}

/** "a cover picture or video, a title, a description, a prompt". */
export function missingList(keys: readonly PublishKey[]): string {
  return keys.map((key) => PUBLISH_WORDS[key]).join(", ");
}

/** The toast when Publish is pressed with something missing. */
export function publishToast(keys: readonly PublishKey[]): string {
  return `To publish, add ${missingList(keys)}.`;
}

/** "photographers, families" → ["photographers", "families"]: trimmed, deduplicated, at most four. */
export function parseAudience(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length === AUDIENCE_MAX) break;
  }
  return out;
}

export type SaveState = "idle" | "saved" | "saving" | "error";

/** The save half of the status line. "not saved — " is followed by a button the view draws. */
export const SAVE_WORDS: Record<Exclude<SaveState, "idle">, string> = {
  saved: "saved just now",
  saving: "saving…",
  error: "not saved — ",
};

/** The saving state, from the hook's three facts. An error outranks a save in flight. */
export function saveState(input: { isSaving: boolean; saveError: unknown; lastSavedAt: Date | null }): SaveState {
  if (input.saveError) return "error";
  if (input.isSaving) return "saving";
  return input.lastSavedAt ? "saved" : "idle";
}
