// UI-P91 — the Map's boxes and lanes in the refined look, per room.
//
// A box on the Map is a raised object laid on the well, not a surface, so its paint is ARTWORK: the constants below,
// one set per room, are the "artwork constants" RULES §2 allows, written here rather than as tokens, as
// `refined/{dusk,noon}/build-map.html` draws them. Dusk's box is shaded (the one gradient a raised object may carry in
// Dusk); Noon's is flat white. The lanes' fill is the faintest wash of the room's ink. Everything else the Map draws
// is a token.

import type { CSSProperties } from "react";

export type MapRoom = "dusk" | "noon";

export interface MapArtwork {
  /** A box at rest: fill, 1px edge, shadow. */
  box: CSSProperties;
  /** A selected box's shadow: Dusk lifts it, Noon rings it (`--selected-ring`, spent by the caller). */
  selectedShadow: string | null;
  /** A session lane's fill. */
  lane: string;
}

export const MAP_ARTWORK: Record<MapRoom, MapArtwork> = {
  dusk: {
    box: {
      background: "linear-gradient(#232327, #1E1E21)",
      border: "1px solid #303035",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.45)",
    },
    selectedShadow: "0 8px 20px -6px rgba(0,0,0,.6)",
    lane: "rgba(255,255,255,.018)",
  },
  noon: {
    box: {
      background: "#FFFFFF",
      border: "1px solid #D9D9D9",
      boxShadow: "0 1px 2px rgba(20,20,18,.06)",
    },
    selectedShadow: null,
    lane: "rgba(20,20,18,.018)",
  },
};
