/* CA-18 P2: Details' handlers, held back until Save.

   PURE. A tile's window in edit mode shows the fields Details used to have, and they call the handlers they always did
   (`DetailsHandlers`): these are the same handlers, wrapped so that each call waits in a `WriteBuffer`. Save flushes the
   buffer, which makes the calls (the same handler, the same arguments); Cancel and Escape clear it, so nothing is written.
   A thing asked for and then put back (an input added, then removed) is taken off the queue and never written. */

import type { DetailsHandlers } from "./DetailsPanel";
import { WriteBuffer } from "./editBuffer";

const keysOf = (patch: object): string => Object.keys(patch).sort().join(",");

/** The handlers, queued. A handler that was absent stays absent, so a field that needs it still does not draw. */
export function bufferedHandlers(h: DetailsHandlers, buffer: WriteBuffer): DetailsHandlers {
  /** One write per tile: the first argument is the tile's id (or a session's key), and the prefix names the handler. */
  const later = <A extends [string, ...unknown[]]>(prefix: string, run: ((...args: A) => void) | undefined): ((...args: A) => void) | undefined =>
    run ? (...args: A) => buffer.set(`${prefix}:${args[0]}`, () => run(...args)) : undefined;

  const keyOfUse = (id: string, use: { kind: string; node_id: string }) => `${id}:${use.kind}:${use.node_id}`;

  return {
    ...h,
    onExtras: h.onExtras ? (id, patch) => buffer.set(`extras:${id}:${keysOf(patch)}`, () => h.onExtras?.(id, patch)) : undefined,
    onDecision: later("decision", h.onDecision),
    onRunsWhen: later("runsWhen", h.onRunsWhen),
    onRuntime: h.onRuntime ? (id, patch) => buffer.set(`runtime:${id}:${keysOf(patch)}`, () => h.onRuntime?.(id, patch)) : undefined,
    onReadHelpers: later("readHelpers", h.onReadHelpers),
    onRename: (id, title) => buffer.set(`rename:${id}`, () => h.onRename(id, title)),
    onModel: (id, model) => buffer.set(`model:${id}`, () => h.onModel(id, model)),
    onAddUse: (id, use) => {
      if (buffer.has(`use-:${keyOfUse(id, use)}`)) buffer.drop(`use-:${keyOfUse(id, use)}`);
      else buffer.set(`use+:${keyOfUse(id, use)}`, () => h.onAddUse(id, use));
    },
    onRemoveUse: (id, use) => {
      if (buffer.has(`use+:${keyOfUse(id, use)}`)) buffer.drop(`use+:${keyOfUse(id, use)}`);
      else buffer.set(`use-:${keyOfUse(id, use)}`, () => h.onRemoveUse(id, use));
    },
    onAddMade: h.onAddMade ? (stepId, name) => buffer.set(`made+:${stepId}:${name}`, () => h.onAddMade?.(stepId, name)) : undefined,
    onRemoveMade: h.onRemoveMade
      ? (fileId) => {
          if (buffer.has(`made+:${fileId}`)) buffer.drop(`made+:${fileId}`);
          else buffer.set(`made-:${fileId}`, () => h.onRemoveMade?.(fileId));
        }
      : undefined,
    onRuns: (id, runs) => buffer.set(`runs:${id}`, () => h.onRuns(id, runs)),
    onManual: h.onManual ? (id, fields) => buffer.set(`manual:${id}:${keysOf(fields)}`, () => h.onManual?.(id, fields)) : undefined,
    onManualPicture: later("manualPicture", h.onManualPicture),
    onInstructions: later("instructions", h.onInstructions),
    onAgentSetup: later("agentSetup", h.onAgentSetup),
    onRemoveInside: (id) => buffer.set(`inside-:${id}`, () => h.onRemoveInside(id)),
    onAgentNotes: h.onAgentNotes ? (id, notes) => buffer.set(`agentNotes:${id}:${keysOf(notes)}`, () => h.onAgentNotes?.(id, notes)) : undefined,
    onModelRun: later("modelRun", h.onModelRun),
    onCheckRuns: later("checkRuns", h.onCheckRuns),
    onCheckCases: later("checkCases", h.onCheckCases),
    onCheckText: h.onCheckText ? (id, patch) => buffer.set(`checkText:${id}:${keysOf(patch)}`, () => h.onCheckText?.(id, patch)) : undefined,
    onCodeSource: h.onCodeSource ? (id, patch) => buffer.set(`codeSource:${id}:${keysOf(patch)}`, () => h.onCodeSource?.(id, patch)) : undefined,
    onToolConnection: later("connection", h.onToolConnection),
    onFields: (id, fields) => buffer.set(`fields:${id}:${keysOf(fields)}`, () => h.onFields(id, fields)),
    onAddPicture: (id, file) => buffer.set(`picture+:${id}:${file.name}:${file.size}`, () => h.onAddPicture(id, file)),
    onUseAsCover: (mediaId) => buffer.set(`cover:${mediaId}`, () => h.onUseAsCover(mediaId)),
    onTrainedOn: later("trainedOn", h.onTrainedOn),
    onSessionTool: later("sessionTool", h.onSessionTool),
    onSessionMeta: h.onSessionMeta ? (key, change) => buffer.set(`sessionMeta:${key}:${keysOf(change)}`, () => h.onSessionMeta?.(key, change)) : undefined,
    onSessionGoal: later("sessionGoal", h.onSessionGoal),
    onSessionExtras: later("sessionExtras", h.onSessionExtras),
    onSessionTogether: later("sessionTogether", h.onSessionTogether),
    onNotShared: later("notShared", h.onNotShared),
    onToggleSessionPrompt: (view, row, on) => buffer.set(`toggle:${view.key}:${row.ordinal}`, () => h.onToggleSessionPrompt(view, row, on)),
  };
}
