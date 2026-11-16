import type { PreviewAuthStorage } from "@/integrations/supabase/previewAuthStorage";

/**
 * G13: "Keep me signed in" decides where the session is kept.
 *
 * Ticked (the default, D6): localStorage, which outlives the browser, as before.
 * Unticked: sessionStorage, which the browser clears when it closes. A session kept this way is in this tab only;
 * a new tab opened later is signed out (a duplicated tab carries it).
 *
 * The choice itself (not the session) sits in localStorage under its own key, so it holds across page loads until the
 * next sign-in sets it again. On the Lovable preview the editor's broker keeps the session, and is left alone.
 */
export const KEEP_SIGNED_IN_KEY = "ob-keep-signed-in";

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Whether the next session should outlive the browser. */
export function keepSignedIn(): boolean {
  return safely(() => localStorage.getItem(KEEP_SIGNED_IN_KEY) !== "0", true);
}

/** Record the box's state, just before a sign-in starts. */
export function setKeepSignedIn(keep: boolean): void {
  safely(() => (keep ? localStorage.removeItem(KEEP_SIGNED_IN_KEY) : localStorage.setItem(KEEP_SIGNED_IN_KEY, "0")), undefined);
}

/** The storage the auth client is given: one of the two browser stores, chosen by the box, at every write. */
export function keepSignedInStorage(base: PreviewAuthStorage | undefined): PreviewAuthStorage | undefined {
  if (typeof window === "undefined" || base === undefined || base !== window.localStorage) return base;
  return {
    getItem: (key) => safely(() => sessionStorage.getItem(key), null) ?? safely(() => localStorage.getItem(key), null),
    setItem: (key, value) => {
      const [keep, drop] = keepSignedIn() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(key, value);
      safely(() => drop.removeItem(key), undefined);
    },
    removeItem: (key) => {
      safely(() => sessionStorage.removeItem(key), undefined);
      safely(() => localStorage.removeItem(key), undefined);
    },
  };
}
