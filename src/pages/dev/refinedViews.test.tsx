/* UI-P96 — two rules every refined view keeps, checked on the dev fixture it is drawn with:

   1. One primary action per view: at most one element is painted with `--action` as its background.
   2. No icon in a labelled button: a `button` or `a` that carries text has no `svg` in it, except `MenuButton`'s
      chevron and a disclosure's chevron.

   The tokens are stood in for here, because jsdom drops `var()` from a colour: `--action` becomes a colour jsdom
   keeps, and everything else stays a `var()`. */

import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/theme/tokens", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/theme/tokens")>();
  const ACTION = "rgb(1, 2, 3)";
  const t = new Proxy(real.t as Record<string, string>, {
    get: (target, key: string) => (key === "action" ? ACTION : target[key]),
  });
  return { ...real, t };
});

import { ThemeProvider } from "@/contexts/ThemeContext";

import KitPages from "./KitPages";

const PAGES = [
  "frame", "home", "gallery-dashboard", "gallery-feed", "build", "build-steps", "activity", "sandbox",
  "rebuild", "lineage", "profile", "drafts", "bounty-board", "signin",
] as const;

const VIEWPORTS = ["desktop", "mobile"] as const;

function setViewport(kind: "desktop" | "mobile") {
  const width = kind === "desktop" ? 1440 : 390;
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return { matches, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** The svgs a labelled control may carry: a chevron (`MenuButton`'s, or a disclosure's), the lockup's own mark, a chart
    (a sparkline is data, not an icon), and the phone dock's tiles, which are a tab bar of icon over word. */
const isAllowedIcon = (svg: Element): boolean => {
  const name = `${svg.getAttribute("class") ?? ""} ${svg.getAttribute("data-glyph") ?? ""}`;
  return (
    /chevron/i.test(name) ||
    svg.matches('[data-ui="sparkline"]') ||
    svg.closest('[data-ui="lockup"], [data-ui="menu-button"], [data-testid^="dock-tile"]') !== null
  );
};

/** An icon button wearing only a count ("3" unread) has no label to be an icon inside of. */
const isCountOnly = (el: Element): boolean => /^\d+\+?$/.test((el.textContent ?? "").trim());

beforeEach(() => {
  vi.stubGlobal("scrollTo", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe.each(VIEWPORTS)("the refined dev pages at %s", (viewport) => {
  it.each(PAGES)("%s has one primary and no icon in a labelled button", async (page) => {
    setViewport(viewport);
    const search = `?look=refined&theme=noon&viewport=${viewport}`;
    window.history.replaceState({}, "", `/dev/kit/pages/${page}${search}`);
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/dev/kit/pages/${page}${search}`]}>
          <Routes>
            <Route path="/dev/kit/pages/:page" element={<KitPages />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(container.querySelector('[data-design-ready="true"]')).not.toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(container.querySelector('[data-design-ready="true"]')?.childElementCount ?? 0).toBeGreaterThan(0), { timeout: 5000 });

    const primaries = [...container.querySelectorAll<HTMLElement>('button, a, [role="button"]')].filter((el) => {
      const bg = el.style.backgroundColor || el.style.background;
      return bg.replace(/\s+/g, "") === "rgb(1,2,3)";
    });
    expect(primaries.map((el) => el.outerHTML.slice(0, 80)), `${page}: more than one --action background`).toHaveLength(Math.min(primaries.length, 1));

    const offenders = [...container.querySelectorAll("button, a")]
      .filter((el) => (el.textContent ?? "").trim() !== "" && !isCountOnly(el))
      .flatMap((el) => [...el.querySelectorAll("svg")].filter((svg) => !isAllowedIcon(svg)).map((svg) => `${svg.getAttribute("class") ?? "svg"} in ${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? el.tagName}`));
    expect(offenders, `${page}: an icon inside a labelled button or link`).toEqual([]);
  });
});
