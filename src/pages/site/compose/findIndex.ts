/* CA-27 P1: what Find in build reads, in the order the page draws it.

   PURE. The same inputs the List is drawn from (steps, session heads, parts) give one target per part, session and tile: a part's
   name; a session's title and its app's name; a tile's title, its prompt text, its file name and the values Details shows for it. */

import { stepTitle, withSentWith, type Step } from "@/lib/build/graph";
import type { FindField, FindTarget } from "@/lib/build/findInBuild";

import type { BuildListProps } from "./BuildList";
import { runsOf, withEmptySessions } from "./buildRuns";
import type { SourceSession } from "./sourcesModel";

type FindInput = Pick<BuildListProps, "steps" | "dividers" | "emptySessions" | "parts">;

/** A tile and every tile inside it, in order. */
const tilesIn = (step: Step): Step[] => [...withSentWith(step).flatMap((entry) => [entry, ...entry.children.flatMap(tilesIn)])];

/** The values Details shows for a tile, as plain text. */
export function detailValues(step: Step): string[] {
  const values: (string | null | undefined)[] = [step.model, step.tool, step.harness, step.language, step.reply, step.memory, step.where?.name, ...(step.lines ?? [])];
  return values.filter((value): value is string => Boolean(value));
}

function tileTarget(step: Step, session: string | null, part: string | null): FindTarget {
  const fields: { field: FindField; text: string }[] = [{ field: "title", text: stepTitle(step) }];
  if (step.text) fields.push({ field: "prompt", text: step.text });
  if (step.filename) fields.push({ field: "file", text: step.filename });
  for (const text of detailValues(step)) fields.push({ field: "details", text });
  return { id: step.id, kind: "tile", session, part, fields };
}

function sessionTarget(head: SourceSession, part: string | null): FindTarget {
  const fields: { field: FindField; text: string }[] = [];
  if (head.title) fields.push({ field: "session", text: head.title });
  fields.push({ field: "app", text: head.tool });
  return { id: head.key, kind: "session", session: head.key, part, fields };
}

export function findTargetsOf(input: FindInput): FindTarget[] {
  const runs = withEmptySessions(runsOf(input.steps, input.dividers), input.emptySessions ?? []);
  const parts = input.parts && input.parts.parts.length >= 2 ? input.parts : null;
  const out: FindTarget[] = [];
  const draw = (run: (typeof runs)[number], part: string | null) => {
    const key = run.head && !run.head.key.startsWith("typed-legacy-") ? run.head.key : null;
    if (run.head && key) out.push(sessionTarget(run.head, part));
    for (const step of run.steps) for (const tile of tilesIn(step)) out.push(tileTarget(tile, key, part));
  };
  if (!parts) {
    for (const run of runs) draw(run, null);
    return out;
  }
  for (const run of runs) if (!run.head) draw(run, null);
  for (const part of parts.parts) {
    out.push({ id: part.view.key, kind: "part", session: null, part: part.view.key, fields: [{ field: "part", text: [part.view.label, part.view.name].filter(Boolean).join(" ") }] });
    for (const key of part.sessions) {
      const run = runs.find((candidate) => candidate.head?.key === key);
      if (run) draw(run, part.view.key);
    }
  }
  return out;
}
