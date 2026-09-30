// RC-P25 — the one-time note that progress was reset.
//
// XP-DESIGN.md › Reset: every user's XP and level returned to the start, and
// this is the one in-app sentence that says why. It is shown until the reader
// says "Got it", then never again in this browser. RC-P27 mounts it on the
// progress page; nothing mounts it yet.
//
// THE PANEL is STATES.md row 15's treatment: a --recess ground, --text copy,
// --r-panel. No category hue, and no amber: amber is light, never type, and
// this note is nothing but type ⟦buildgallery-theme › Progress and achievement⟧.
// THE ACTION is STATES.md row 3, the one tertiary control: a ghost button,
// --text2 on the same --recess ground, which measures 4.55:1 on Noon and
// 5.73:1 on Dusk (contrast.test.ts), so it never goes on a darker ground than
// this one. There is no primary action here, and the page that mounts the note
// keeps the one it already has.
//
// THE MEMORY is one localStorage key, and storage is allowed to refuse: a
// private window, blocked site data and a full quota all throw, some on merely
// reading `window.localStorage`. Every touch of it is inside a try, so a
// browser that remembers nothing shows the note on each visit and never breaks
// the page it sits on. The key names the browser, not the account, so a second
// account on the same browser will not see it.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, measure } from "@/lib/theme/type";

/** XP-DESIGN.md › Reset, word for word. A test holds the two together. */
export const RESET_NOTE_TEXT =
  "Progress has been reset to match how buildgallery works now: XP comes from builds others get working.";

/** Where the browser remembers that the note has been read. */
export const RESET_NOTE_KEY = "bg-xp-reset-note-seen";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(RESET_NOTE_KEY) !== null;
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(RESET_NOTE_KEY, "1");
  } catch {
    // Storage refused. The note still closes for this visit; it may come back on the next.
  }
}

export function ResetNote() {
  const [open, setOpen] = useState<boolean>(() => !alreadySeen());

  if (!open) return null;

  return (
    <div
      role="note"
      data-testid="xp-reset-note"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: SPACE.xs,
        padding: SPACE.sm,
        backgroundColor: t.recess,
        color: t.text,
        borderRadius: r.panel,
      }}
    >
      <p style={{ ...body, ...measure, margin: 0, flex: "1 1 240px" }}>{RESET_NOTE_TEXT}</p>
      <Button
        variant="ghost"
        size="lg"
        style={{ marginInlineStart: "auto" }}
        onClick={() => {
          remember();
          setOpen(false);
        }}
      >
        Got it
      </Button>
    </div>
  );
}

export default ResetNote;
