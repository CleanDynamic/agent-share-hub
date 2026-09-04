import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ────────────────────────────────────────────────
   ThemeContext — the mechanism that flips the theme.

   The buildgallery theme switch is one attribute: <html data-theme="…">.
   Every colour in the system is a var(--token) resolved off that attribute
   (see src/lib/theme/tokens.ts), so this provider writes the attribute and
   nothing else — no re-render of consumers, no per-component theme prop, no
   second source of truth.

   The attribute is set before this module loads, by the inline boot script in
   index.html. This provider agrees with that script by construction: both read
   the same key, apply the same fallback, and resolve "system" the same way, so
   the first write here is a no-op and nobody sees a flash of the other room.
──────────────────────────────────────────────── */

/** What the visitor chose. "system" defers to the OS. */
export type ThemeChoice = "exhibition" | "dusk" | "system";

/** What is actually painted. "system" has been resolved away. */
export type ResolvedTheme = "exhibition" | "dusk";

export interface ThemeState {
  /** The stored choice, including "system". */
  theme: ThemeChoice;
  /** Persist and apply a choice. */
  setTheme: (theme: ThemeChoice) => void;
  /** The concrete theme on the root element right now. */
  resolved: ResolvedTheme;
}

/** localStorage key. Kept in sync with the boot script in index.html. */
export const THEME_STORAGE_KEY = "bg-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Duration of the colour cross-fade. Mirrors the CSS in index.css. */
const TRANSITION_MS = 180;

/* BG-P02. A visitor with no stored preference gets Exhibition, not the Dusk
   the theme spec names: a gallery that opens in the dark undersells itself, and
   most visitors arrive with no preference either way. "system" stays
   selectable for anyone who wants their OS to decide. */
const DEFAULT_THEME: ThemeChoice = "exhibition";

const CHOICES: readonly ThemeChoice[] = ["exhibition", "dusk", "system"];

const isThemeChoice = (value: unknown): value is ThemeChoice =>
  typeof value === "string" && (CHOICES as readonly string[]).includes(value);

/**
 * matchMedia, or null. A private window, an old browser and jsdom can each
 * leave it missing or throwing; a theme switch is not worth a blank page.
 */
function safeMatchMedia(query: string): MediaQueryList | null {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

/**
 * The stored choice, or the default. Storage throws in a private window and on
 * a browser with site data blocked — every read is wrapped, and a throw means
 * the visitor gets the default rather than a broken render.
 */
export function readStoredTheme(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeChoice(raw)) return raw;
  } catch {
    /* Storage unavailable. Fall through to the default. */
  }
  return DEFAULT_THEME;
}

const systemPrefersDark = (): boolean => safeMatchMedia(DARK_QUERY)?.matches ?? false;

const prefersReducedMotion = (): boolean => safeMatchMedia(REDUCED_MOTION_QUERY)?.matches ?? false;

const resolveTheme = (theme: ThemeChoice, dark: boolean): ResolvedTheme =>
  theme === "system" ? (dark ? "dusk" : "exhibition") : theme;

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  const resolved = resolveTheme(theme, systemDark);

  /* Track the OS preference continuously rather than only while "system" is
     chosen, so selecting "system" never resolves against a stale value. */
  useEffect(() => {
    const query = safeMatchMedia(DARK_QUERY);
    if (!query) return;

    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);

    // Safari below 14 only has the deprecated listener pair.
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  /* The one write. useLayoutEffect so the attribute lands before paint on the
     mount where the boot script did not already agree (it always does today —
     this is the guard for the day it does not). */
  const isFirstWrite = useRef(true);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const first = isFirstWrite.current;
    isFirstWrite.current = false;

    if (root.dataset.theme === resolved) return;

    /* The cross-fade is scoped to an attribute that exists only for its own
       duration, so it cannot run on first paint and cannot leak into ordinary
       interaction. Reduced motion skips it entirely — belt and braces with the
       media query guarding the same rule in index.css. */
    if (first || prefersReducedMotion()) {
      root.dataset.theme = resolved;
      return;
    }

    root.dataset.themeChanging = "";
    root.dataset.theme = resolved;
    const timer = window.setTimeout(() => {
      delete root.dataset.themeChanging;
    }, TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
      delete root.dataset.themeChanging;
    };
  }, [resolved]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Storage unavailable. The choice holds for this page and is forgotten
         on reload, which is the most a private window can offer. */
    }
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
