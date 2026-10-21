// CA-13 rule 4 and P2: what "Copy" gives for a Decision. The maker's real code when a Code tile calls it; a request written
// from the stored questions only when there is none. Pure.

import { COPY_REQUEST_NOTE, decisionRequest, modelShort } from "./decision";
import type { Step } from "./graph";

/** The Code tiles a decision names, in the order it names them, as they exist in the build. */
export function calledFromTiles(step: Pick<Step, "decision">, parts: readonly Pick<Step, "id" | "kind" | "text" | "filename" | "title" | "defaultTitle">[]): { id: string; name: string; text: string }[] {
  return (step.decision?.calledFrom ?? []).flatMap((id) => {
    const tile = parts.find((part) => part.id === id && part.kind === "code");
    return tile ? [{ id, name: tile.filename ?? tile.title ?? tile.defaultTitle, text: tile.text }] : [];
  });
}

export interface DecisionCopy {
  /** "Copy the code": the maker's own code, when a Code tile calls the decision. */
  code: { label: string; text: string } | null;
  /** "Copy as a request": written from the stored questions, labelled as such. */
  request: { label: string; text: string; python: string; curl: string };
}

const fileBanner = (name: string) => `# ${name}`;

export function decisionCopy(step: Pick<Step, "decision">, parts: readonly Pick<Step, "id" | "kind" | "text" | "filename" | "title" | "defaultTitle">[]): DecisionCopy | null {
  const facts = step.decision;
  if (!facts) return null;
  const tiles = calledFromTiles(step, parts);
  const request = decisionRequest(facts);
  return {
    code: tiles.length ? { label: "Copy the code", text: tiles.length === 1 ? tiles[0].text : tiles.map((tile) => `${fileBanner(tile.name)}\n${tile.text}`).join("\n\n") } : null,
    request: { label: "Copy as a request", text: `${request.python}\n\n${request.curl}`, python: request.python, curl: request.curl },
  };
}

export { COPY_REQUEST_NOTE };

/** What a Code tile says of the decisions that name it: "Calls Decision 'team' (Jev)". One entry for each such decision. */
export function callsOf(codeId: string, steps: readonly Pick<Step, "id" | "kind" | "title" | "defaultTitle" | "decision">[]): { id: string; label: string }[] {
  return steps.flatMap((step) => {
    if (step.kind !== "decision" || !step.decision?.calledFrom.includes(codeId)) return [];
    const lab = modelShort(step.decision.provider, step.decision.model).split(" ")[0];
    return [{ id: step.id, label: `Calls Decision '${step.title ?? step.defaultTitle}'${lab ? ` (${lab})` : ""}` }];
  });
}
