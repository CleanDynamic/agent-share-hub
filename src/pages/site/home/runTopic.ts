// UX-08 P2: a failed run becomes a topic. The New post window opens prefilled and nothing is written until the person presses
// Post: the build attached, the words "Didn't work for me at Step <n> on <model>." and an empty line to add to, no space chosen.
//
// A run (`build_reproductions`) records the model it was made on and no step, so on disk the step is not known: the line then reads
// "Didn't work for me on <model>." and no step is marked still open. A caller that does know the failing step passes it, and the
// step is named in the words and marked still open (`about_node_id`).

import { modelLabel } from "@/lib/models/registry";

import { EMPTY_DRAFT, type NewPostDraft } from "../openbuilds/sendPost";

export interface FailedRun {
  buildId: string;
  /** `model_used` of the run, when it said. */
  model: string | null;
  /** The step it failed at, when known: its number as the build page shows it, and its node (null when the step is a replay step
      with no step tile, as a breakage on Where it broke is: UX-09 P1). */
  step?: { number: string; nodeId: string | null } | null;
}

/** "Didn't work for me at Step 3 on Opus 5.5." with whatever part is not known left out. */
export function failedRunLine({ model, step }: Pick<FailedRun, "model" | "step">): string {
  const at = step ? ` at Step ${step.number}` : "";
  const on = model?.trim() ? ` on ${modelLabel(model)}` : "";
  return `Didn't work for me${at}${on}.`;
}

/** The New post window's content for a failed run. */
export function failedRunDraft(run: FailedRun): NewPostDraft {
  const input = { kind: "build", buildId: run.buildId } as const;
  return {
    ...EMPTY_DRAFT,
    body: `${failedRunLine(run)}\n\n`,
    spaceIds: [],
    attachments: [{ key: JSON.stringify(input), input }],
    // Still open is marked only where there is a step tile to mark; the person can add it from + Add.
    added: run.step?.nodeId ? ["open"] : [],
    stillOpen: Boolean(run.step?.nodeId),
    openNodeId: run.step?.nodeId ?? null,
  };
}

export const START_TOPIC_FROM_RUN_LABEL = "Start a topic from this run";

/** Whether the viewer is offered the button on a run: they made the build and the run did not work. */
export const canStartTopicFromRun = (run: { worked: boolean }, buildMakerId: string | null | undefined, viewerId: string | null | undefined): boolean =>
  !run.worked && !!viewerId && viewerId === buildMakerId;
