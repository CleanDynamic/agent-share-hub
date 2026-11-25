/* Prompt 23: phone extras from a list's steps and sessions, with no page behind them (the dev pages and the tests). Every handler
   that would write does nothing; the reads are the same as the page's. */

import { groupKey, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";

import type { PhoneEditorExtras } from "./PhoneEditor";

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);
const noop = () => undefined;

export function phoneExtrasOf(steps: readonly Step[], groups: readonly SessionGroup[], onOpenStep: (id: string) => void = noop): PhoneEditorExtras {
  const byId = new Map(flatten(steps).map((step) => [step.id, step]));
  const sessions = groups.map((group) => ({
    key: groupKey(group),
    number: group.number,
    steps: steps.filter((step) => group.stepNumbers.includes(step.number)).map((step) => ({ id: step.id, number: step.number, kind: step.kind, title: stepTitle(step) })),
  }));
  return {
    onOpenStep,
    numberOf: (id) => byId.get(id)?.number ?? null,
    stepOf: (id) => {
      const step = byId.get(id);
      return step ? { kind: step.kind, title: stepTitle(step) } : null;
    },
    map: { sessions: sessions.filter((session) => session.steps.length > 0) },
    sources: {
      sessions: groups.map((group) => ({ key: groupKey(group), number: group.number, line: [group.model, group.startedAt?.slice(0, 10)].filter(Boolean).join(" / "), colour: group.colour ?? null })),
      files: [],
      onAddTo: noop,
      onPick: noop,
      importHref: "/import",
    },
    moveTo: groups.map((group) => ({ key: groupKey(group), label: `Session ${group.number}` })),
    onMoveTiles: noop,
    canGroup: false,
    onColours: noop,
    stillOpen: null,
  };
}
