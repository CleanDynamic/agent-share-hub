/* CA-27 P1: the words a find is looking for, and the match it is on, for the pieces that draw them.

   The List provides it; with no find open the value is empty and `FindHit` draws its text as it came. */

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { findRanges } from "@/lib/build/findInBuild";
import { t } from "@/lib/theme/tokens";

export interface FindView {
  /** What is typed, settled (after the wait). Empty: no find. */
  query: string;
  /** The id of the match the find is on: a tile, a session or a part. */
  current: string | null;
}

export const NO_FIND: FindView = { query: "", current: null };

const FindContext = createContext<FindView>(NO_FIND);
export const FindProvider = FindContext.Provider;
export const useFindView = (): FindView => useContext(FindContext);

/** A found word: a faint fill, a 1.5px line under it, radius 3. */
export const FOUND_WORD: CSSProperties = { backgroundColor: t.findFill, boxShadow: `inset 0 -1.5px 0 ${t.text2}`, borderRadius: 3, color: "inherit" };

/** The ring on the tile (or head) the find is on: 1px, `--selected-edge`. */
export const FOUND_RING: CSSProperties = { boxShadow: `0 0 0 1px ${t.selectedEdge}` };

/** Prompt 23: on a phone a found word is filled in Mint, at 30% on Dusk and 18% on Noon (the light Mint, #1F6A24). */
export const phoneFoundWord = (dark: boolean): CSSProperties => ({ ...FOUND_WORD, backgroundColor: `color-mix(in srgb, ${t.brandAccent} ${dark ? 30 : 18}%, transparent)`, boxShadow: "none" });

/** `text` with the found words marked. */
export function FindHit({ text }: { text: string }) {
  const { query } = useFindView();
  const phone = useIsPhone();
  const dark = useResolvedTheme() === "dusk";
  if (!query) return <>{text}</>;
  const ranges = findRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([from, to], index) => {
    if (from > at) parts.push(text.slice(at, from));
    parts.push(
      <mark key={index} data-testid="find-hit" style={phone ? phoneFoundWord(dark) : FOUND_WORD}>
        {text.slice(from, to)}
      </mark>,
    );
    at = to;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** The ring for the element with this id: only while the find is on it. */
export function useFoundRing(id: string | null | undefined): CSSProperties | null {
  const { current } = useFindView();
  return id && current === id ? FOUND_RING : null;
}
