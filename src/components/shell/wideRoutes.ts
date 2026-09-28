/* ────────────────────────────────────────────────────────────────────────────
   BG-P14 — the wide-layout route table.

   THE ONE PLACE A ROUTE OPTS INTO THE WIDE FRAME. `AppShell` reads this table
   and nothing else: there is no `pathname.startsWith(...)` for the layout mode
   scattered through the shell, because the moment there are two of those the
   answer to "which routes are wide?" stops being readable anywhere.

   BG-P15 FILLED IT. The three entries below are the gallery, the build page
   and the import page, which until this prompt rendered outside the frame
   entirely — no nav, no rails, no mobile chrome, and a text link back to the
   home page standing in for all of it. Their `<Route>` registrations moved
   inside `<Route element={<Layout />}>` in App.tsx and nothing else about the
   move touched this file's mechanism: BG-P14's capability took three lines of
   data to use, which is what it was built for.
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
}

/**
 * The routes that render in the wide frame.
 *
 * ADD TO THIS ARRAY TO MAKE A ROUTE WIDE. Nothing else has to change: the
 * layout prop, the frame's max-width and the centre's flex behaviour all
 * follow from an entry here.
 */
export const WIDE_ROUTES: readonly WideRoute[] = [
  /* The gallery — a grid of build cards, and the surface wide mode was
     measured for. The grid's columns are auto-filled from a 320px floor. */
  { pattern: "/gallery" },

  /* The build page — one build, read top to bottom.

     A PREFIX PATTERN, because `/b2/:slug` is one route per build and an exact
     pattern would match none of them. */
  { pattern: "/b2/*" },

  /* The import page — paste a document, get a Build File, drop it back.

     IT IS THE WEAKEST OF THE THREE CLAIMS ON WIDE, and that is recorded here
     rather than dressed up. BG-P15 moves all three routes into wide mode as
     one change, so this one comes with them; but its content is a three-step
     list authored against a 720px column, and in a ~1090px centre the step
     cards stretch while their contents keep their old measure, leaving a band
     of empty card to the right of every step. Nothing overflows and nothing is
     illegible — it is under-filled, not broken — and re-laying it out is not
     this prompt's to do. The honest fix is either a measure on the step list
     or this route going back to standard; see BG-P15's handoff note. */
  { pattern: "/import" },
];

/**
 * The dev-only demo route, appended to the table in development and absent
 * from a production build.
 *
 * `import.meta.env.DEV` is replaced with the literal `false` when Vite builds
 * for production, so this is a `false ? [...] : []` whose live branch Rollup
 * eliminates — the same guard, and for the same reason, as the `/dev/kit`
 * route in App.tsx. It is kept out of `WIDE_ROUTES` itself so that the
 * exported table holds only the routes that ship.
 */
const DEV_WIDE_ROUTES: readonly WideRoute[] = import.meta.env?.DEV
  ? [{ pattern: "/dev/wide" }]
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
 * override a wildcard covering it — `/dev/wide` wins over a hypothetical
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
