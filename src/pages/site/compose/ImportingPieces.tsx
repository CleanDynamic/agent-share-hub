/* CA-24 P4: a slow import shows its progress.

   WHEN. Only when adding a session from a chat takes longer than a second (`SLOW_IMPORT_MS`, one timer for the whole import);
   a quicker one shows nothing extra.

   THE TAG, after the app name in the session head: "Importing", 20 tall, padding 0 7, radius 5, the control recipe, the data
   face 10.5 `--text2`.
   THE SOCKETS: every empty socket is filled with building blocks, its whole inner area inset 10 from every edge (SV-05), waving
   with the rest of the page (`SocketBlocks`).
   THE ROW under the sockets, 8 below: a bar 4 tall (radius 2, track `--hairline`, fill `--text2`) filling to done divided by
   total; 12 apart the count in the data face 11 `--label` ("6 of 18 prompts"); 12 apart a text link "Stop" (12.5/500,
   underlined). The row takes `progress` and `onStop`; with neither it is not drawn, and with only `progress` there is no Stop.
   Stop ends the import, keeps the prompts already in and closes the remaining sockets; the notice reads
   "Stopped. 6 of 18 prompts added." (`stoppedNotice`).

   WHAT THE PAGE FEEDS IT. `addSessionToBuild` writes a session in one go: its tiles in batches, the session's row last, and it
   takes the tiles away again if anything fails, so that nothing is ever half-added. So the page can show the tag and the
   sockets, and (SV-05) the count as each batch of tiles is written; a session cannot be stopped half-way without being
   half-added, so the page passes `progress` and never `onStop`. */

import { useEffect, useState, type CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { LoadingBlocks } from "./LoadingBlocks";
import { tileStyle } from "./tileRecipes";

export const SLOW_IMPORT_MS = 1000;
/** SV-05 P4: the tile's own padding: the blocks fill the socket's inner area, this far in from every edge. */
export const SOCKET_INSET = 10;

export const IMPORTING_COPY = {
  tag: "Importing",
  count: (done: number, total: number) => `${done} of ${total} ${total === 1 ? "prompt" : "prompts"}`,
  stop: "Stop",
} as const;

/** CA-20's notice after Stop. */
export const stoppedNotice = (done: number, total: number): string => `Stopped. ${done} of ${total} ${total === 1 ? "prompt" : "prompts"} added.`;

/** True once `active` has been so for a second. One timer; nothing for an import that finishes sooner. */
export function useSlow(active: boolean, after: number = SLOW_IMPORT_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), after);
    return () => window.clearTimeout(timer);
  }, [active, after]);
  return slow;
}

const TAG: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 20,
  padding: "0 7px",
  borderRadius: 5,
  boxSizing: "border-box",
  flexShrink: 0,
  background: t.control,
  border: `1px solid ${t.controlBorder}`,
  fontFamily: DM_MONO,
  fontSize: 10.5,
  fontWeight: 400,
  lineHeight: "normal",
  color: t.text2,
  whiteSpace: "nowrap",
};

export function ImportingTag() {
  return (
    <span data-testid="importing-tag" style={TAG}>
      {IMPORTING_COPY.tag}
    </span>
  );
}

/** SV-05 P4: the blocks that fill an empty socket, its whole inner area, 10 in from every edge. The socket is the positioned parent. */
export function SocketBlocks({ gone = false }: { gone?: boolean }) {
  return (
    <div data-testid="socket-blocks" style={{ position: "absolute", inset: SOCKET_INSET, visibility: "visible" }}>
      <LoadingBlocks kind="box" width="fill" height="fill" gone={gone} />
    </div>
  );
}

/* The arriving block is a column with a gap of 4, so 4 more makes the 8 under the sockets. */
/** A prompt that is already in, standing in its socket where its blocks were. */
export function WrittenPrompt({ text }: { text: string }) {
  return (
    <div data-testid="written-prompt" style={{ ...tileStyle(false), position: "absolute", inset: 0, visibility: "visible", overflow: "hidden" }}>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "normal", color: t.text, overflow: "hidden" }}>{text}</p>
    </div>
  );
}

const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginTop: 4, minWidth: 0 };
const BAR: CSSProperties = { flex: "1 1 auto", minWidth: 0, height: 4, borderRadius: 2, background: t.hairline, overflow: "hidden" };
const COUNT: CSSProperties = { fontFamily: DM_MONO, fontSize: 11, fontWeight: 400, lineHeight: "normal", color: t.label, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const STOP: CSSProperties = {
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  padding: 0,
  cursor: "pointer",
  fontFamily: FIGTREE,
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: "normal",
  color: t.text,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  textDecorationColor: t.line,
  flexShrink: 0,
};

/** The bar, the count and Stop, in one row under the sockets. Drawn only with `progress`; Stop only with `onStop`. */
export function ImportProgress({ progress, onStop }: { progress?: { done: number; total: number }; onStop?: () => void }) {
  if (!progress) return null;
  const { done, total } = progress;
  const filled = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <div data-testid="import-progress" style={ROW}>
      <div role="progressbar" aria-label="Importing" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} style={BAR}>
        <div data-testid="import-bar-fill" style={{ width: `${filled * 100}%`, height: "100%", background: t.text2 }} />
      </div>
      <span data-testid="import-count" style={COUNT}>
        {IMPORTING_COPY.count(done, total)}
      </span>
      {onStop ? (
        <button type="button" data-testid="import-stop" onClick={onStop} style={STOP}>
          {IMPORTING_COPY.stop}
        </button>
      ) : null}
    </div>
  );
}
