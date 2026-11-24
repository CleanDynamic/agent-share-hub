/* Prompt 23: Find on a phone. Find in More turns the top bar into the search field: the field 40 tall, radius 20, on Card with
   a 2px Mint inset and 16px text (so iOS does not zoom); the count "1 of 2" in mono 13 Text 3; previous and next (32, their
   hit grown to 44); and Cancel. It stands over the shell's bar, under the safe-area inset, while the find is open. What it
   finds, how it moves and what it opens are the page's `useBuildFind`, unchanged. */

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { FIND_COPY } from "@/lib/build/findInBuild";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { BuildFind } from "../useBuildFind";
import { PHONE_EDITOR_COPY } from "./phoneEditorModel";

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{ boxSizing: "border-box", width: 32, height: 32, padding: 0, margin: -6, border: "6px solid transparent", backgroundClip: "padding-box", borderRadius: 22, background: "transparent", color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

const BAR: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 40,
  boxSizing: "border-box",
  height: `calc(${PHONE_TOPBAR}px + env(safe-area-inset-top))`,
  paddingTop: "env(safe-area-inset-top)",
  paddingInline: `${PHONE_MARGIN}px 4px`,
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: t.bg,
};

export function PhoneFindBar({ find }: { find: BuildFind }) {
  const cancel = useInteractive<HTMLButtonElement>();
  /* The field takes focus as the bar replaces the top bar. */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => find.inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [find.inputRef]);
  /* A portal: the page's main column is a stacking context of its own, under the top bar this stands over. */
  return createPortal(
    <div role="search" data-testid="phone-find-bar" style={BAR}>
      <div style={{ flex: "1 1 0", minWidth: 0, boxSizing: "border-box", height: 40, borderRadius: 20, background: t.module, boxShadow: `inset 0 0 0 2px ${t.brandAccent}`, display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 12px" }}>
        <span aria-hidden="true" style={{ color: t.label, display: "inline-flex" }}>
          <MobileIcon name="search" size={16} />
        </span>
        <input
          ref={find.inputRef}
          type="search"
          data-testid="find-input"
          data-notepad-field=""
          aria-label={FIND_COPY.button}
          placeholder={FIND_COPY.placeholder}
          value={find.input}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => find.setInput(event.target.value)}
          onKeyDown={find.onFieldKey}
          style={{ flex: "1 1 0", minWidth: 0, height: "100%", background: "transparent", border: 0, padding: 0, outline: "none", color: t.text, fontFamily: FIGTREE, fontSize: 16 }}
        />
        {find.words ? (
          <span data-testid="find-count" aria-live="polite" style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: DM_MONO, fontSize: 13, color: t.label, fontVariantNumeric: "tabular-nums" }}>
            {find.words}
          </span>
        ) : null}
        <Step label={FIND_COPY.previous} onClick={() => find.move(-1)}>
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <MobileIcon name="chev" size={16} />
          </span>
        </Step>
        <Step label={FIND_COPY.next} onClick={() => find.move(1)}>
          <MobileIcon name="chev" size={16} />
        </Step>
      </div>
      <button
        type="button"
        data-testid="find-cancel"
        onClick={find.close}
        {...cancel.handlers}
        style={{ minHeight: 44, padding: "0 12px", border: 0, borderRadius: 22, background: "transparent", color: t.text, fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, cursor: "pointer", flexShrink: 0, ...ring(cancel.state.focusVisible) }}
      >
        {PHONE_EDITOR_COPY.cancel}
      </button>
    </div>,
    document.body,
  );
}

export default PhoneFindBar;
