// CA-22: what the maker just did, said before the change lands, so the page can move the way that change should.
//
// The build page learns WHAT changed by comparing what it drew with what it is now given (ids that went, ids that came). It
// learns WHY from here: the actions say "this is a clear", "this is a duplicate" the moment they start, and the page reads it when
// the data catches up (a write, then a read, can take a moment). An intent is spent by the change that uses it, and lapses after
// `INTENT_FRESH_MS`, so a build that is simply swapped for another, or a write from another tab, never lifts anything.

export type MotionKind = "remove" | "clear" | "duplicate" | "convert" | "merge" | "split" | "add" | "change" | "move" | "part" | "undo" | "redo" | "restore";

export interface MotionIntent {
  kind: MotionKind;
  at: number;
  /** The step's sentence, for the notice and the status line. */
  sentence?: string;
}

export const INTENT_FRESH_MS = 8000;

let current: MotionIntent | null = null;

/** Says what is about to change. The newest wins; an older intent that was never used is gone. */
export function announce(kind: MotionKind, sentence?: string): MotionIntent {
  // The step that was just announced by name ("move") is not made vaguer by the history recording it ("change").
  if (kind === "change" && current && current.kind !== "change" && Date.now() - current.at < 2000) return current;
  current = { kind, at: Date.now(), sentence };
  return current;
}

/** The intent that is still fresh, or null. */
export function peekIntent(now: number = Date.now()): MotionIntent | null {
  if (current && now - current.at > INTENT_FRESH_MS) current = null;
  return current;
}

/** The change that used it has been drawn. */
export function spendIntent(intent: MotionIntent): void {
  if (current === intent) current = null;
}

/** Tests. */
export function resetIntent(): void {
  current = null;
}
