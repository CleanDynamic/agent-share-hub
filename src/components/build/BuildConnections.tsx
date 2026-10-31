// What the build page knows about how its parts are connected to the rest of the site (SV-25).
//
// One context, so the session heads, tiles and anatomy rows read it without the page threading props through every
// layer, and the views stay pure: the page (BuildPage) loads the data and provides it. Absent, nothing is drawn.

import { createContext, useContext } from "react";

export type SaveKind = "part" | "step" | "session";

export interface BuildConnections {
  /** Present for a signed-in reader on a published build. */
  save: { isSaved: (kind: SaveKind, ref: string) => boolean; toggle: (kind: SaveKind, ref: string) => void } | null;
  /** Tile id -> the number of other builds with a tile that came from it. Only ids with a count above 0. */
  usedIn: ReadonlyMap<string, number>;
}

const BuildConnectionsContext = createContext<BuildConnections | null>(null);

export const BuildConnectionsProvider = BuildConnectionsContext.Provider;

export const useBuildConnections = (): BuildConnections | null => useContext(BuildConnectionsContext);

/** "Used in 3 builds" / "Used in 1 build". */
export const usedInText = (n: number): string => `Used in ${n.toLocaleString("en-GB")} ${n === 1 ? "build" : "builds"}`;

/** "In 3 collections" / "In 1 collection". */
export const inCollectionsText = (n: number): string => `In ${n.toLocaleString("en-GB")} ${n === 1 ? "collection" : "collections"}`;
