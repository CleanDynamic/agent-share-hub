/* CA-10 (CA-08 F6): ONE TOAST WHEN A NEW POST'S DRAFT CANNOT BE MADE.

   On /compose/new every first change goes through `ensureBuild`, which makes the draft. When that fails it says so
   itself, once ("Couldn't start your draft. Try again."), and throws a `DraftNotStartedError`. Every caller that
   failed only because of it then says nothing more: `sayFailed(cause, line)` shows its own line only when the cause
   is not one that has already been told. */

import { toast } from "sonner";

export class DraftNotStartedError extends Error {
  /** The maker has been told already. */
  readonly told = true;

  constructor(cause: unknown) {
    super("The draft was not made.");
    this.name = "DraftNotStartedError";
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

/** How far down a chain of causes to look. */
const MAX_DEPTH = 4;

/** True when the failure is (or wraps) one the maker has already been told about. */
export function alreadyTold(cause: unknown): boolean {
  let current: unknown = cause;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    if (current instanceof DraftNotStartedError || (current as { told?: unknown }).told === true) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The caller's own failure line, unless the maker has been told already. `retry` puts Retry on the toast: it runs the same operation again. */
export function sayFailed(cause: unknown, line: string, retry?: () => void) {
  if (alreadyTold(cause)) return;
  if (retry) toast.error(line, { action: { label: "Retry", onClick: retry } });
  else toast.error(line);
}
