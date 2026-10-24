// buildHistory: one history for every change made in the composer (CA-20 P5). PURE.
//
// WHAT A STEP IS. Each change the maker makes, other than typing, is one step: a sentence, an undo and a redo. The history
// does not know what a step changes; it only keeps them in order. That is why CA-19's colour and link steps join it without
// changing it: each is a step like any other (`useReferenceHistory` hands its own undo and redo over).
//
// SIZE AND LIFE. Up to 50 steps, for the visit. A reload starts empty: everything is already saved.
//
// ORDER. A new step goes on top of `done` and clears what was waiting to be redone. Undo takes the top of `done` and puts it
// on `undone`; redo does the reverse. A step whose undo (or redo) fails stays where it was, so it can be tried again.
//
// A GROUP is one step made of several: a removal that also changes colours, groups and links is undone, and redone, as one.
// Its children are undone in the reverse of the order they were made, and redone in the order they were made.
//
// Nothing here touches the database or the screen.

export const HISTORY_LIMIT = 50;

export interface BuildStep {
  /** The sentence the notice and the title row's tooltips use: "Removed Prompt 3". */
  sentence: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export interface BuildHistory {
  done: BuildStep[];
  undone: BuildStep[];
}

export const EMPTY_BUILD_HISTORY: BuildHistory = { done: [], undone: [] };

export const HISTORY_COPY = {
  nothingToUndo: "Nothing to undo",
  nothingToRedo: "Nothing to redo",
  undoFailed: "Couldn't undo that. Try again.",
  redoFailed: "Couldn't redo that. Try again.",
  undo: "Undo",
  redo: "Redo",
  /** The title row's tooltip: "Undo: Removed Prompt 3". */
  undoStep: (sentence: string) => `Undo: ${sentence}`,
  redoStep: (sentence: string) => `Redo: ${sentence}`,
} as const;

/** A new step: on top of `done`, the oldest dropped past 50, and nothing left to redo. */
export function recordStep(history: BuildHistory, step: BuildStep): BuildHistory {
  return { done: [...history.done, step].slice(-HISTORY_LIMIT), undone: [] };
}

export const canUndoStep = (history: BuildHistory): boolean => history.done.length > 0;
export const canRedoStep = (history: BuildHistory): boolean => history.undone.length > 0;

/** The sentence of the step an undo would take back, or null. */
export const nextUndo = (history: BuildHistory): string | null => history.done.at(-1)?.sentence ?? null;
/** The sentence of the step a redo would put back, or null. */
export const nextRedo = (history: BuildHistory): string | null => history.undone.at(-1)?.sentence ?? null;

/** After an undo went through: the step moves from `done` to `undone`. */
export function afterUndone(history: BuildHistory): BuildHistory {
  const step = history.done.at(-1);
  if (!step) return history;
  return { done: history.done.slice(0, -1), undone: [...history.undone, step].slice(-HISTORY_LIMIT) };
}

/** After a redo went through: the step moves from `undone` back to `done`. */
export function afterRedone(history: BuildHistory): BuildHistory {
  const step = history.undone.at(-1);
  if (!step) return history;
  return { done: [...history.done, step].slice(-HISTORY_LIMIT), undone: history.undone.slice(0, -1) };
}

/** Several steps as one: undone last to first, redone first to last. The sentence is the group's own. */
export function groupSteps(sentence: string, children: readonly BuildStep[]): BuildStep {
  return {
    sentence,
    undo: async () => {
      for (const child of [...children].reverse()) await child.undo();
    },
    redo: async () => {
      for (const child of children) await child.redo();
    },
  };
}
