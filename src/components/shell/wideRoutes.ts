/* ────────────────────────────────────────────────────────────────────────────
   BG-P14 — the wide-layout route table.

   THE ONE PLACE A ROUTE OPTS INTO THE WIDE FRAME. `AppShell` reads this table
   and nothing else: there is no `pathname.startsWith(...)` for the layout mode
   scattered through the shell, because the moment there are two of those the
   answer to "which routes are wide?" stops being readable anywhere.

   IT IS EMPTY, AND THAT IS THIS PROMPT'S POINT. BG-P14 builds the capability
   and proves it on a dev-only route; BG-P15 moves the gallery, the build page
   and the import page in by adding three entries below and deleting the
   `<Route>` registrations that currently put them outside the frame.
   ──────────────────────────────────────────────────────────────────────────── */

export interface WideRoute {
  /**
   * A path pattern. Either an exact path (`"/gallery"`), or one ending in
   * `"/*"` (`"/b2/*"`), which matches that prefix and everything under it.
   *
   * Deliberately not a regular expression and deliberately not React Router's
   * matcher: this table is read by `AppShell` on every navigation and by the
   * people editing it, and both are better served by a pattern language with
   * two rules in it.
   */
  pattern: string;

  /**
   * Show the right rail on this route when the frame is wide.
   *
   * DEFAULT FALSE — suppressed. The two surfaces wide mode exists for want
   * opposite things: the gallery wants the rail's 300px for another grid
   * column, and the build page wants the rail. So the rail is a per-route
   * decision rather than a property of the mode, and the quieter of the two
   * answers is the default.
   *
   * A route that asks for it still loses it below 1280px, where a rail plus a
   * grid leaves neither enough room — see `.fs-wide .fs-right` in
   * flat-shell.css.
   */
  rightRail?: boolean;
}

/**
 * The routes that render in the wide frame.
 *
 * ADD TO THIS ARRAY TO MAKE A ROUTE WIDE. Nothing else has to change: the
 * layout prop, the frame's max-width, the centre's flex behaviour and the
 * right rail all follow from an entry here.
 */
export const WIDE_ROUTES: readonly WideRoute[] = [];

/**
 * The dev-only demo route, appended to the table in development and absent
 * from a production build.
 *
 * `import.meta.env.DEV` is replaced with the literal `false` when Vite builds
 * for production, so this is a `false ? [...] : []` whose live branch Rollup
 * eliminates — the same guard, and for the same reason, as the `/dev/kit`
 * route in App.tsx. It is kept out of `WIDE_ROUTES` itself so that the
 * exported table BG-P15 edits stays empty and stays honest.
 *
 * TWO PATTERNS FOR ONE PAGE, which is how the demo's right-rail control works:
 * the page toggles the rail by navigating between them. That exercises the
 * real mechanism — a route table entry deciding the rail — rather than a
 * second, demo-only path into `FlatShell` that no real route would ever use.
 */
const DEV_WIDE_ROUTES: readonly WideRoute[] = import.meta.env?.DEV
  ? [
      { pattern: "/dev/wide", rightRail: false },
      { pattern: "/dev/wide/rail", rightRail: true },
    ]
  : [];

/** True when `pathname` is matched by `pattern`. */
function matches(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === pattern;
}

/**
 * The wide-route entry for `pathname`, or null when the route is standard.
 *
 * Exact patterns are considered before prefix patterns so a specific entry can
 * override a wildcard covering it — `/dev/wide/rail` wins over a hypothetical
 * `/dev/*` — which is the only ordering rule the table has, and it is a rule
 * rather than "whichever was written first" so that adding an entry cannot
 * silently change what an existing one matches.
 */
export function matchWideRoute(pathname: string): WideRoute | null {
  const table = [...WIDE_ROUTES, ...DEV_WIDE_ROUTES];
  const exact = table.find((r) => !r.pattern.endsWith("/*") && matches(pathname, r.pattern));
  if (exact) return exact;
  return table.find((r) => r.pattern.endsWith("/*") && matches(pathname, r.pattern)) ?? null;
}

/** The layout mode for `pathname`. */
export function layoutForRoute(pathname: string): "standard" | "wide" {
  return matchWideRoute(pathname) ? "wide" : "standard";
}
