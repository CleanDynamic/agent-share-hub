import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from "./ThemeContext";

/* Reports what the provider decided, so a test can read state and the root
   attribute in one place. */
function Probe() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setTheme("dusk")}>dusk</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

const rootTheme = () => document.documentElement.dataset.theme;
const read = (id: string) => screen.getByTestId(id).textContent;

/** A matchMedia stub whose dark-scheme answer the test controls. */
function stubMatchMedia(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? dark : false,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
      if (query.includes("prefers-color-scheme: dark")) listeners.add(fn);
    },
    removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
      listeners.delete(fn);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return {
    /** Fire an OS appearance change at every registered listener. */
    setDark(next: boolean) {
      dark = next;
      for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent);
    },
  };
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themeChanging;
  stubMatchMedia(false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("defaults a visitor with no stored preference to Exhibition", () => {
    renderProvider();
    expect(read("theme")).toBe("exhibition");
    expect(read("resolved")).toBe("exhibition");
  });

  it("defaults to Exhibition even where the OS prefers dark", () => {
    // The departure from the spec is deliberate: an unknown visitor gets the
    // lit room, and only an explicit "system" defers to the OS.
    stubMatchMedia(true);
    renderProvider();
    expect(read("resolved")).toBe("exhibition");
  });

  it("prefers a stored choice over the default", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dusk");
    renderProvider();
    expect(read("theme")).toBe("dusk");
    expect(read("resolved")).toBe("dusk");
  });

  it("ignores a stored value that is not a theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "midnight");
    renderProvider();
    expect(read("theme")).toBe("exhibition");
  });

  it("lands the resolved theme on the root element", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dusk");
    renderProvider();
    expect(rootTheme()).toBe("dusk");
  });

  it("persists a new choice and moves the root attribute", () => {
    renderProvider();
    act(() => screen.getByText("dusk").click());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dusk");
    expect(rootTheme()).toBe("dusk");
  });

  describe('"system"', () => {
    it("resolves to Dusk when the OS prefers dark", () => {
      stubMatchMedia(true);
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      renderProvider();
      expect(read("theme")).toBe("system");
      expect(read("resolved")).toBe("dusk");
      expect(rootTheme()).toBe("dusk");
    });

    it("resolves to Exhibition when the OS prefers light", () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      renderProvider();
      expect(read("resolved")).toBe("exhibition");
      expect(rootTheme()).toBe("exhibition");
    });

    it("follows an OS appearance change with no reload", () => {
      const media = stubMatchMedia(false);
      window.localStorage.setItem(THEME_STORAGE_KEY, "system");
      renderProvider();
      expect(rootTheme()).toBe("exhibition");

      act(() => media.setDark(true));
      expect(read("resolved")).toBe("dusk");
      expect(rootTheme()).toBe("dusk");

      act(() => media.setDark(false));
      expect(rootTheme()).toBe("exhibition");
    });

    it("does not follow the OS once a concrete theme is chosen", () => {
      const media = stubMatchMedia(false);
      window.localStorage.setItem(THEME_STORAGE_KEY, "exhibition");
      renderProvider();

      act(() => media.setDark(true));
      expect(read("resolved")).toBe("exhibition");
      expect(rootTheme()).toBe("exhibition");
    });
  });

  describe("a localStorage that throws", () => {
    it("still renders, at the default", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("access denied");
      });
      renderProvider();
      expect(read("theme")).toBe("exhibition");
      expect(rootTheme()).toBe("exhibition");
    });

    it("still switches, for the life of the page", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      renderProvider();
      act(() => screen.getByText("dusk").click());
      expect(read("resolved")).toBe("dusk");
      expect(rootTheme()).toBe("dusk");
    });
  });

  it("does not run the cross-fade on first paint", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dusk");
    renderProvider();
    expect(document.documentElement.dataset.themeChanging).toBeUndefined();
  });

  it("scopes the cross-fade to the switch itself", () => {
    vi.useFakeTimers();
    try {
      renderProvider();
      act(() => screen.getByText("dusk").click());
      expect(document.documentElement.dataset.themeChanging).toBe("");
      act(() => vi.advanceTimersByTime(180));
      expect(document.documentElement.dataset.themeChanging).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips the cross-fade under prefers-reduced-motion", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    renderProvider();
    act(() => screen.getByText("dusk").click());
    expect(rootTheme()).toBe("dusk");
    expect(document.documentElement.dataset.themeChanging).toBeUndefined();
  });
});

describe("useTheme", () => {
  it("refuses to be read outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <ThemeProvider>/);
  });
});
