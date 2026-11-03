/* UX-01 P1: text left in a prompt box is kept, and read by the two things that need to know.

   One store per composer page, backed by `sessionStorage` under `ux-unsent:<buildKey>:<sessionKey>`. The boxes (`AddPrompt`,
   `AgentPromptField`) read and write through it; the page reads `entries()` for the Publish checklist and the leave window.
   Without storage (a private window, blocked site data) every read and write is caught and the boxes work in memory, as before.

   BEFORE THE BUILD EXISTS the key is `new:<a token for this tab>`. The token is kept in `sessionStorage` too, so a reload of
   /compose/new finds its text. When the real id arrives the entries move to it. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const PREFIX = "ux-unsent:";
const TAB_TOKEN = "ux-unsent-tab";

export interface UnsentEntry {
  key: string;
  text: string;
}

export interface UnsentStore {
  get: (key: string) => string;
  set: (key: string, text: string) => void;
  clear: (key: string) => void;
  /** Move a box's text to another key (Session 1 before the build exists takes its real key). */
  rename: (from: string, to: string) => void;
  /** Every box with text in it, in the order they were first typed in. */
  entries: () => UnsentEntry[];
  /** Changes on every write, so a reader re-renders. */
  version: number;
}

const read = (key: string): string | null => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* no storage: the text lives in memory only */
  }
};
const storedKeys = (): string[] => {
  try {
    const found: string[] = [];
    for (let at = 0; at < window.sessionStorage.length; at += 1) {
      const name = window.sessionStorage.key(at);
      if (name) found.push(name);
    }
    return found;
  } catch {
    return [];
  }
};

/** One token per tab, kept for reloads. */
export function tabToken(): string {
  const stored = read(TAB_TOKEN);
  if (stored) return stored;
  const made = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Math.random()).slice(2);
  write(TAB_TOKEN, made);
  return made;
}

/** The key a build's boxes live under: its id, or `new:<token>` until it has one. */
export const unsentBuildKey = (buildId: string | null | undefined): string => buildId || `new:${tabToken()}`;

export function useUnsentPrompts(buildId: string | null | undefined): UnsentStore {
  const buildKey = unsentBuildKey(buildId);
  const memory = useRef(new Map<string, string>());
  const order = useRef<string[]>([]);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const lastBuildKey = useRef(buildKey);

  const fullKey = (build: string, key: string) => `${PREFIX}${build}:${key}`;

  /* The real id arrives: what was typed under `new:<token>` moves to it. */
  useEffect(() => {
    const was = lastBuildKey.current;
    if (was === buildKey) return;
    lastBuildKey.current = buildKey;
    const from = `${PREFIX}${was}:`;
    for (const name of storedKeys()) {
      if (!name.startsWith(from)) continue;
      const value = read(name);
      write(name, null);
      if (value !== null) write(fullKey(buildKey, name.slice(from.length)), value);
    }
    bump();
  }, [buildKey, bump]);

  const get = useCallback(
    (key: string): string => {
      const stored = read(fullKey(buildKey, key));
      return stored ?? memory.current.get(`${buildKey}:${key}`) ?? "";
    },
    [buildKey],
  );
  const set = useCallback(
    (key: string, text: string) => {
      if (!order.current.includes(key)) order.current.push(key);
      if (text) {
        memory.current.set(`${buildKey}:${key}`, text);
        write(fullKey(buildKey, key), text);
      } else {
        memory.current.delete(`${buildKey}:${key}`);
        write(fullKey(buildKey, key), null);
      }
      bump();
    },
    [buildKey, bump],
  );
  const clear = useCallback((key: string) => set(key, ""), [set]);
  const rename = useCallback(
    (from: string, to: string) => {
      const text = get(from);
      if (!text || from === to) return;
      set(from, "");
      set(to, text);
    },
    [get, set],
  );
  const entries = useCallback((): UnsentEntry[] => {
    const prefix = fullKey(buildKey, "");
    const found = new Map<string, string>();
    for (const [name, text] of memory.current) if (name.startsWith(`${buildKey}:`) && text.trim()) found.set(name.slice(buildKey.length + 1), text);
    for (const name of storedKeys()) {
      if (!name.startsWith(prefix)) continue;
      const text = read(name);
      if (text && text.trim()) found.set(name.slice(prefix.length), text);
    }
    const rank = (key: string) => {
      const at = order.current.indexOf(key);
      return at === -1 ? Number.MAX_SAFE_INTEGER : at;
    };
    return [...found].map(([key, text]) => ({ key, text })).sort((a, b) => rank(a.key) - rank(b.key));
    // `version` is read so the list is fresh on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey, version]);

  return useMemo(() => ({ get, set, clear, rename, entries, version }), [get, set, clear, rename, entries, version]);
}

export const UnsentContext = createContext<UnsentStore | null>(null);

/** A prompt box's text. Without a page's store (a dev page, a test) it is plain state, as it was. */
export function useUnsentBox(key: string | null): [string, (text: string) => void] {
  const store = useContext(UnsentContext);
  const [local, setLocal] = useState("");
  const slot = key ?? "__footer__";
  const setStored = useCallback((text: string) => (store ? store.set(slot, text) : setLocal(text)), [store, slot]);
  return [store ? store.get(slot) : local, setStored];
}
