import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P05 — RouteBoundary.

   ONE ROUTE FAILS, NOT THE SITE. The application-level ErrorBoundary in App.tsx
   replaces the whole screen, frame included, with a reload prompt: one broken
   page becomes a blank site (neoscale-error-monitoring › Error boundaries).
   This one wraps a single route's element, so a page that throws while
   rendering is replaced by one sentence and one action inside the frame, and
   the navigation around it keeps working.

   WHAT THE READER SEES is STATES.md row 21: "Something went wrong." and a
   secondary "Try again" (row 2 — the outline button on a transparent ground).
   Try again clears the boundary and renders the route again.

   IT RESETS ON NAVIGATION. The wrapper keys the boundary on the pathname, so
   leaving a failed page and coming back, or following a nav link from the
   failed state, mounts a fresh boundary rather than carrying the failure to
   the next page.

   IT LOGS NOTHING, so it has no componentDidCatch. An error's message can
   quote whatever the page was rendering — a build's text, a search query —
   and CONTRACT §9 keeps user-authored text out of every log. No error tracker
   is installed, so there is nothing to report to either.
   ──────────────────────────────────────────────────────────────────────────── */

interface BoundaryState {
  failed: boolean;
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  private reset = () => {
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) return <RouteFailed onRetry={this.reset} />;
    return this.props.children;
  }
}

function RouteFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="route-error"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: SPACE.sm,
        paddingTop: SPACE.lg,
        paddingBottom: SPACE.lg,
      }}
    >
      <p style={{ ...body, margin: 0, color: t.text }}>Something went wrong.</p>
      <Button type="button" variant="outline" onClick={onRetry} style={{ background: "transparent" }}>
        Try again
      </Button>
    </div>
  );
}

/** Wraps one route's element; a render error inside it stays inside it. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <RouteErrorBoundary key={pathname}>{children}</RouteErrorBoundary>;
}

export default RouteBoundary;
