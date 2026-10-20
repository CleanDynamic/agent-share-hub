/* CA-05 P9 — two optional lines of an agent: How it tidies its notes (under What it remembers) and What it changes each
   round (under Runs, when it runs again until a condition was met). Each is one Field marked Optional, one well up to
   120 characters, saved when it is left. PURE: the words in, the words out. */

import { CHANGES_EACH_ROUND_MAX, MEMORY_TIDY_MAX } from "@/lib/build/graph";

import { Field } from "./composeControls";
import { ExtrasInput } from "./SessionExtrasFields";

export const AGENT_NOTES_COPY = {
  optional: "Optional",
  tidy: "How it tidies its notes",
  tidyHint: "Every Sunday, keeps the 50 most useful notes",
  changes: "What it changes each round",
  changesHint: "Its own review checklist",
} as const;

export function MemoryTidyField({ id, value, phone, onCommit }: { id: string; value: string; phone: boolean; onCommit: (value: string) => void }) {
  return (
    <Field id={`${id}-tidy`} label={AGENT_NOTES_COPY.tidy} hint={AGENT_NOTES_COPY.optional}>
      <ExtrasInput key={`${id}:tidy:${value}`} label={AGENT_NOTES_COPY.tidy} value={value} placeholder={AGENT_NOTES_COPY.tidyHint} max={MEMORY_TIDY_MAX} phone={phone} onCommit={(said) => onCommit(said.trim())} />
    </Field>
  );
}

export function ChangesEachRoundField({ id, value, phone, onCommit }: { id: string; value: string; phone: boolean; onCommit: (value: string) => void }) {
  return (
    <Field id={`${id}-changes`} label={AGENT_NOTES_COPY.changes} hint={AGENT_NOTES_COPY.optional}>
      <ExtrasInput key={`${id}:changes:${value}`} label={AGENT_NOTES_COPY.changes} value={value} placeholder={AGENT_NOTES_COPY.changesHint} max={CHANGES_EACH_ROUND_MAX} phone={phone} onCommit={(said) => onCommit(said.trim())} />
    </Field>
  );
}
