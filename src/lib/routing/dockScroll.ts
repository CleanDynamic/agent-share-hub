// 29c: where each dock tab was scrolled to. On a phone, tapping a dock tab opens that section where it was left, not at the
// top, as the tabs of a native app do. The map is kept for the visit (memory only); a pushed page (a build, a post, a
// profile) returns to where it was through the history entry's own position (ScrollKeeper), and is not a tab.
//
// A section's position is the scroll of its ROOT page only ("/", "/builds", "/import", "/openbuilds", "/notifications"):
// scrolling a build page inside Builds never overwrites where the Builds list was.

export type DockSection = "home" | "builds" | "import" | "openbuilds" | "activity";

const ROOTS: Readonly<Record<string, DockSection>> = {
  "/": "home",
  "/builds": "builds",
  "/gallery": "builds",
  "/import": "import",
  "/openbuilds": "openbuilds",
  "/notifications": "activity",
};

/** The dock tab whose root page this is, or null for any other page. */
export function dockSectionOf(pathname: string): DockSection | null {
  return ROOTS[pathname === "" ? "/" : pathname] ?? null;
}

const saved = new Map<DockSection, number>();

export function saveDockScroll(section: DockSection, y: number): void {
  saved.set(section, Math.max(0, Math.round(y)));
}

export function readDockScroll(section: DockSection): number | null {
  return saved.get(section) ?? null;
}

export function forgetDockScroll(): void {
  saved.clear();
}

export const isPhoneView = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
