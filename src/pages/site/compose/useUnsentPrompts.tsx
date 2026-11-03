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
  /** Move a box's text to another key (Session 1 before the build exists takes its real key). */
  rename: (from: string, to: string) => void;
  /** Every box with text in it. */
  entries: () => UnsentEntry[];
  /** Changes on every write, so a reader re-renders. */
  version: number;
}

/** Storage can be missing or throw (a private window, blocked site data): every use is wrapped, and the text then lives in memory only. */
const safe = <T,>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};
const read = (key: string): string | null => safe(() => window.sessionStorage.getItem(key), null);
const write = (key: string, value: string | null): void => safe(() => (value === null ? window.sessionStorage.removeItem(key) : window.sessionStorage.setItem(key, value)), undefined);
const storedKeys = (prefix: string): string[] => safe(() => Object.keys(window.sessionStorage).filter((name) => name.startsWith(prefix)), []);

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
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const lastBuildKey = useRef(buildKey);
  const at = (build: string, key: string) => `${PREFIX}${build}:${key}`;

  /* The real id arrives: what was typed under `new:<token>` moves to it. */
  useEffect(() => {
    const was = lastBuildKey.current;
    if (was === buildKey) return;
    lastBuildKey.current = buildKey;
    const from = at(was, "");
    for (const name of storedKeys(from)) {
      const value = read(name);
      write(name, null);
      if (value !== null) write(at(buildKey, name.slice(from.length)), value);
    }
    bump();
  }, [buildKey, bump]);

  const get = useCallback((key: string): string => read(at(buildKey, key)) ?? memory.current.get(`${buildKey}:${key}`) ?? "", [buildKey]);
  const set = useCallback(
    (key: string, text: string) => {
      if (text) memory.current.set(`${buildKey}:${key}`, text);
      else memory.current.delete(`${buildKey}:${key}`);
      write(at(buildKey, key), text || null);
      bump();
    },
    [buildKey, bump],
  );
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
    const prefix = at(buildKey, "");
    const found = new Map<string, string>();
    for (const [name, text] of memory.current) if (name.startsWith(`${buildKey}:`)) found.set(name.slice(buildKey.length + 1), text);
    for (const name of storedKeys(prefix)) found.set(name.slice(prefix.length), read(name) ?? "");
    return [...found].filter(([, text]) => text.trim()).map(([key, text]) => ({ key, text }));
    // `version` is read so the list is fresh on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey, version]);

  return useMemo(() => ({ get, set, rename, entries, version }), [get, set, rename, entries, version]);
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
