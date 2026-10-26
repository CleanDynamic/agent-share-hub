// colourSwatches: the maker's Recent and Favourites colours, kept on their profile (CA-06 P6).
//
// `profiles.colour_swatches` is `{ recent: string[], favourites: string[] }`: up to 8 and 24 colours, each
// "#RRGGBB" in upper case (the column's check says the same). They belong to the maker, not to a build, so they
// follow them across builds and devices.
//
// ONLY THE SIGNED-IN MAKER'S OWN ROW is read or written: the id is the session's, never a caller's, and the update
// policy ("Users can update own profile") refuses any other row anyway.
//
// THE COLUMN IS NEWER THAN THE GENERATED TYPES, so the table is reached through a narrow cast, as making.ts does.

import { supabase } from "@/integrations/supabase/client";
import { FAVOURITES_MAX, RECENT_MAX } from "@/lib/theme/colourWheel";
import { normaliseHex } from "@/lib/theme/partColour";

export interface ColourSwatches {
  recent: string[];
  favourites: string[];
}

export const NO_SWATCHES: ColourSwatches = { recent: [], favourites: [] };

/** A list read defensively: colours only, each once, in order, at most `max`. */
function colours(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const hex = normaliseHex(entry);
    if (hex && !out.includes(hex)) out.push(hex);
    if (out.length === max) break;
  }
  return out;
}

/** The stored value, read defensively: anything that is not a colour is left out. */
export function swatchesOf(value: unknown): ColourSwatches {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { recent: colours(raw.recent, RECENT_MAX), favourites: colours(raw.favourites, FAVOURITES_MAX) };
}

/** Why these swatches cannot be saved, or null. Every entry must already be "#RRGGBB" in upper case. */
export function swatchesRefusal(next: ColourSwatches): string | null {
  if (!Array.isArray(next.recent) || !Array.isArray(next.favourites)) return "Swatches are two lists of colours.";
  if (next.recent.length > RECENT_MAX) return `Recent holds at most ${RECENT_MAX} colours.`;
  if (next.favourites.length > FAVOURITES_MAX) return `Favourites hold at most ${FAVOURITES_MAX} colours.`;
  for (const entry of [...next.recent, ...next.favourites]) {
    if (typeof entry !== "string" || normaliseHex(entry) !== entry) return "A swatch is a colour written as #RRGGBB.";
  }
  return null;
}

interface ProfilesSwatches {
  select: (columns: string) => {
    eq: (column: string, value: string) => { limit: (n: number) => { maybeSingle: () => PromiseLike<{ data: { colour_swatches: unknown } | null; error: unknown }> } };
  };
  update: (patch: { colour_swatches: ColourSwatches }) => { eq: (column: string, value: string) => PromiseLike<{ error: unknown }> };
}

const profiles = (): ProfilesSwatches => (supabase as unknown as { from: (table: string) => ProfilesSwatches }).from("profiles");

async function signedInId(): Promise<string | null> {
  // The stored session names the maker with no round trip to the auth server (SV-03).
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** The signed-in maker's swatches; none when signed out. */
export async function getColourSwatches(): Promise<ColourSwatches> {
  const id = await signedInId();
  if (!id) return NO_SWATCHES;
  const { data, error } = await profiles().select("colour_swatches").eq("id", id).limit(1).maybeSingle();
  if (error) throw error;
  return swatchesOf(data?.colour_swatches);
}

/** Saves the signed-in maker's swatches. Refuses a value that is not two lists of colours in their limits. */
export async function saveColourSwatches(next: ColourSwatches): Promise<ColourSwatches> {
  const why = swatchesRefusal(next);
  if (why) throw new Error(why);
  const id = await signedInId();
  if (!id) throw new Error("Sign in to keep your colours.");
  const value = { recent: [...next.recent], favourites: [...next.favourites] };
  const { error } = await profiles().update({ colour_swatches: value }).eq("id", id);
  if (error) throw error;
  return value;
}
