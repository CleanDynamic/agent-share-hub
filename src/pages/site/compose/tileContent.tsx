/* Synth 09: a step tile's content, on the notepad's tone.

   A tile's header is its number, its kind and its title. Under it, everything its window holds stands on one tonal layer in the
   notepad's colour (`--notepad`): the tile's own body (the prompt's words, a tool's actions, a manual step's lines, a piece of
   code) and then every other section its window has filled in, in the window's own order and words. The sections come from
   `readSections` (lib/build/tileSections.ts), the one list the windows and Details already share, so a tile shows what its
   window holds and nothing its window lacks. A section the tile's body already draws is not drawn twice (`SHOWN_IN_BODY`), and
   "Used by" (the other side of another tile's Uses, not something filled in here) is left to Details.

   The layer runs the width of the tile's content; what is on it keeps the tile's indent, so its words line up with the title. A
   tile with nothing to show draws no layer. */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { ReadSection } from "@/lib/build/tileSections";
import type { StepKind } from "@/lib/build/graph";
import { r } from "@/lib/theme/radius";
import { space } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";

import { ValueView } from "./DetailsPanel";
import { TILE_INDENT } from "./tileRecipes";

/** The sections each kind's body already draws (or its header names), by the window's section keys. */
export const SHOWN_IN_BODY: Partial<Record<StepKind, ReadonlySet<string>>> = {
  prompt: new Set(["prompt", "response", "uses"]),
  manual: new Set(["where", "done"]),
  code: new Set(["code", "filename"]),
  tool: new Set(["tool", "connected", "did"]),
  decision: new Set(["questions"]),
  check: new Set(["tested", "passing", "runs", "lastRun"]),
  file: new Set(["file", "place"]),
  system_prompt: new Set(["name", "text"]),
  dataset: new Set(["name", "description", "columns"]),
  repo: new Set(["url", "description"]),
  retrieval: new Set(["name", "corpus"]),
  agent: new Set(["inside", "instructions", "tools", "starts"]),
  team: new Set(["inside"]),
};

/** Reverse links, read in Details: not something the maker filled in on this tile. */
const NEVER_ON_TILE = new Set(["goesInto", "usedBy"]);

/** The sections a tile draws on its layer, beyond its body. */
export function tileSectionsOf(kind: StepKind, sections: readonly ReadSection[]): ReadSection[] {
  const shown = SHOWN_IN_BODY[kind];
  return sections.filter((section) => !NEVER_ON_TILE.has(section.key) && !shown?.has(section.key));
}

/** The tonal layer: the notepad's fill, radius 10, padded 12 at the top, right and foot (the content keeps the tile's own indent). */
export const CONTENT_WELL: CSSProperties = {
  background: t.notepad,
  borderRadius: r.card,
  padding: `${space[3]}px ${space[3]}px ${space[3]}px 0`,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  minWidth: 0,
  boxSizing: "border-box",
};

/** A prose section is cut at this height on a tile; the whole of it is in Details and the window. */
const PROSE_ON_TILE = 132;

const ROW_TEXT: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.body, lineHeight: "22px" };

const SECTION_LABEL: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 500, lineHeight: "17px", color: t.label, margin: 0 };

/** The sections, each its label (13/500 Text 3) and its value as Details draws it, at the tile's indent. */
export function TileSections({ sections, onSelect, indent = TILE_INDENT }: { sections: readonly ReadSection[]; onSelect?: (id: string) => void; /** 0 on a tile with no indent (one sent with another). */ indent?: number }) {
  if (sections.length === 0) return null;
  return (
    <div data-testid="tile-sections" style={{ display: "flex", flexDirection: "column", gap: space[3], paddingLeft: indent, minWidth: 0 }}>
      {sections.map((section) => (
        <section key={section.key} data-testid="tile-section" data-section={section.key} aria-label={section.label} style={{ display: "flex", flexDirection: "column", gap: space[1], minWidth: 0 }}>
          <h4 style={SECTION_LABEL}>{section.label}</h4>
          <div style={{ minWidth: 0 }}>
            {section.value.type === "rows" ? (
              /* On a tile a row is its label then its value, side by side, not spread across the tile's width. */
              <div role="list" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {section.value.rows.map((row) => (
                  <div key={row.label} role="listitem" data-testid="tile-row" style={{ display: "flex", alignItems: "baseline", gap: space[2], minWidth: 0 }}>
                    <span style={{ ...ROW_TEXT, color: t.text2, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ ...ROW_TEXT, color: t.text, overflowWrap: "anywhere", minWidth: 0 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <ValueView value={section.value} onSelect={onSelect} clamp={section.value.type === "prose" ? PROSE_ON_TILE : undefined} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** What counts as something on the layer: words, or a picture, a preview or a control. */
const SHOWS = "svg, img, video, button, input, textarea, canvas, [role='img']";

/**
 * The layer itself, round the tile's body and its sections. A tile whose body draws nothing and that has no section draws no
 * layer: the layer measures itself once, and while it holds nothing it is not drawn, until what it is drawn from (`watch`, the
 * tile's data) changes and it looks again.
 */
export function ContentWell({ children, inset = false, watch }: { children: ReactNode; /** A tile with no indent of its own (one sent with another): the layer pads its left too. */ inset?: boolean; watch: unknown }) {
  const well = useRef<HTMLDivElement>(null);
  const [emptyFor, setEmptyFor] = useState<unknown>(undefined);
  const empty = emptyFor !== undefined && emptyFor === watch;
  useLayoutEffect(() => {
    const node = well.current;
    if (!node || empty) return;
    if (!(node.textContent ?? "").trim() && !node.querySelector(SHOWS)) setEmptyFor(watch);
  });
  if (empty) return null;
  return (
    <div ref={well} data-testid="tile-content" style={inset ? { ...CONTENT_WELL, paddingLeft: space[3] } : CONTENT_WELL}>
      {children}
    </div>
  );
}
