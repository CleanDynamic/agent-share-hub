// useColourSwatches: the maker's Recent and Favourites colours, for the colour picker (CA-06 P5, P6).
//
// They belong to the maker, not to a build: one store for the visit, shared by every picker on the page. They are
// read from the maker's profile once per visit, the first time a picker needs them, and saved 500ms after a change.
// Signed out, or while a save fails, they live in memory for the visit and nothing is said: the build is never held
// up by them.

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { getColourSwatches, saveColourSwatches, type ColourSwatches } from "@/lib/profile/colourSwatches";

export type Swatches = ColourSwatches;

/** How long after the last change the swatches are saved. */
export const SAVE_DEBOUNCE_MS = 500;

/** Where swatches are read from and saved to; null keeps them in memory only. */
export interface SwatchSaving {
  load: () => Promise<Swatches>;
  save: (next: Swatches) => Promise<unknown>;
}

let saving: SwatchSaving | null = { load: getColourSwatches, save: saveColourSwatches };
let current: Swatches = { recent: [], favourites: [] };
let loaded: "no" | "loading" | "yes" = "no";
/** The maker changed them before the profile's arrived: theirs win. */
let touched = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;
const tell = () => listeners.forEach((listener) => listener());

/** Tests and dev pages: where swatches go, or null for memory only. Starts the visit afresh. */
export function configureSwatchSaving(next: SwatchSaving | null, start: Swatches = { recent: [], favourites: [] }): void {
  clearTimeout(timer);
  saving = next;
  current = start;
  loaded = next ? "no" : "yes";
  touched = false;
  tell();
}

/** Replaces the swatches for every picker on the page, without saving them. */
export function setSwatchStore(next: Swatches): void {
  current = next;
  tell();
}

function loadOnce(): void {
  if (loaded !== "no" || !saving) return;
  loaded = "loading";
  const from = saving;
  from
    .load()
    .then((stored) => {
      if (!touched) setSwatchStore(stored);
    })
    .catch(() => undefined)
    .finally(() => {
      loaded = "yes";
    });
}

function saveSoon(next: Swatches): void {
  clearTimeout(timer);
  const to = saving;
  if (!to) return;
  timer = setTimeout(() => {
    // Signed out, or the save failed: they stay in memory for the visit, and nothing is said.
    void Promise.resolve()
      .then(() => to.save(next))
      .catch(() => undefined);
  }, SAVE_DEBOUNCE_MS);
}

/** The swatches as they stand, and a way to change them: every picker sees the change, and it is saved soon after. */
export function useColourSwatches(): [Swatches, (next: Swatches) => void] {
  const swatches = useSyncExternalStore(subscribe, read, read);
  useEffect(loadOnce, []);
  const set = useCallback((next: Swatches) => {
    touched = true;
    setSwatchStore(next);
    saveSoon(next);
  }, []);
  return [swatches, set];
}
