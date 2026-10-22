/* CA-16 P2: the shape of `builds.classification`.

   `declared` is what the maker chose in the Classification Card. `derived` is read from the build's tiles, each value
   with the tile ids it came from. `disputes` is where the maker corrected a derived value, with a reason. Nothing here
   is a secret; a custom entry is the maker's own words, kept for review and never put in `facets`. */

import type { Facet } from "./taxonomy";

/** A value from a list, or the maker's own text. Task entries carry `primary: true` on the first. */
export type Entry = { id: string; primary?: true } | { custom: string; primary?: true };

export const isCustomEntry = (entry: Entry): entry is { custom: string; primary?: true } => "custom" in entry;

export interface Declared {
  field: Entry[];
  task: Entry[];
  setting: Entry[];
  data: Entry[];
  age: string | null;
  stack: Entry[];
}

export interface DerivedFacet {
  /** List ids; a name the lists do not know is `custom:<text>`. */
  values: string[];
  /** The ids of the tiles the values came from. */
  from: string[];
}

export interface Dispute {
  values: string[];
  reason: string;
  /** ISO time. */
  at: string;
}

export type DerivedMap = Partial<Record<Facet, DerivedFacet>>;
export type DisputeMap = Partial<Record<Facet, Dispute>>;

export interface Classification {
  version: number;
  declared: Declared;
  derived: DerivedMap;
  disputes: DisputeMap;
  questions_dismissed: string[];
}

/** Where a shown value came from. */
export type Provenance = "derived" | "stated" | "none";
