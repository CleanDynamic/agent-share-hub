// useColourSwatches: the maker's Recent and Favourites colours, for the colour picker (CA-06 P5, P6).
//
// They belong to the maker, not to a build: one store for the visit, shared by every picker on the page. P6 reads
// them from the maker's profile once per visit and saves after a change, a moment later; signed out, or while a save
// fails, they live in memory for the visit and nothing is said. The build is never held up by them.

import { useCallback, useSyncExternalStore } from "react";

import type { Swatches } from "./ColourPicker";

let current: Swatches = { recent: [], favourites: [] };
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;

/** Replaces the swatches for every picker on the page. */
export function setSwatchStore(next: Swatches): void {
  current = next;
  listeners.forEach((listener) => listener());
}

/** The swatches as they stand, and a way to change them. `onChange` hears every change the maker makes. */
export function useColourSwatches(onChange?: (next: Swatches) => void): [Swatches, (next: Swatches) => void] {
  const swatches = useSyncExternalStore(subscribe, read, read);
  const set = useCallback(
    (next: Swatches) => {
      setSwatchStore(next);
      onChange?.(next);
    },
    [onChange],
  );
  return [swatches, set];
}
