// RC-P18 — asking for the "Add to a collection" dialog from anywhere.
//
// The ask comes from the Save toast, and Save lives inside a gallery card. A
// dialog rendered there would be the card's React child, and React delivers a
// portalled dialog's clicks to its React ancestors, so the card's link and the
// engagement row's own click guard would receive every press made inside it.
// So the dialog is mounted once, by AddToCollectionHost beside the app's
// toasters, and this is the one line between them: which build it is for, or
// null. Nothing else is kept here.

import { useSyncExternalStore } from "react";

/** The library's query keys, shared by the page, the dialog and the host. */
export const LIBRARY_SAVED_KEY = "library-saved";
export const LIBRARY_COLLECTIONS_KEY = "library-collections";
export const LIBRARY_COLLECTION_KEY = "library-collection";
export const LIBRARY_COLLECTION_BUILDS_KEY = "library-collection-builds";

let requested: string | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** Open the dialog for this build. */
export function requestAddToCollection(buildId: string): void {
  requested = buildId;
  announce();
}

/** Close it. */
export function closeAddToCollection(): void {
  requested = null;
  announce();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The build the dialog is open for, or null. */
export function useAddToCollectionRequest(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => requested,
    () => null,
  );
}
