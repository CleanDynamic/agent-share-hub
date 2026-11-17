/* CA-24 P3: one boundary per panel.

   `ErrorBoundary` (App.tsx) replaces the whole screen with a reload prompt and has one fixed fallback; `RouteBoundary` keeps a
   route's failure inside its frame. Neither can be set per use, so the composer's panels (Sources, the post, the build list,
   Details, the map) each get this: a failure stays inside the panel that failed and the others keep working.

   THE FALLBACK sits in the panel's own place, at its top-left, with padding 16: "{Panel} didn't load" (13/500) and, 8 below,
   a small Retry. A panel's query failing (`failed`) shows the same fallback as a render error.

   RETRY resets this boundary and runs `onRetry`, which refetches that panel's own queries and no others.

   WHAT IS REPORTED (SV-01). The failure goes to reportError once, with the panel's name and the route. reportError keeps the
   error's name and code and drops its message, which can quote what the panel was drawing (a prompt's text, a post). */

import { Component, useMemo, type CSSProperties, type ReactNode } from "react";

import { PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import { failedLine, type Thing } from "@/lib/copy/copy";
import { reportError } from "@/lib/errors/report";

export type PanelName = "Sources" | "Post" | "Build" | "Details" | "Map";

/** What each panel shows, for "Couldn't load <thing>. Try again." Sources lists the member's sessions; the rest are the build. */
const PANEL_THING: Record<PanelName, Thing> = { Sources: "your sessions", Post: "this build", Build: "this build", Details: "this build", Map: "this build" };

export const panelFailedLine = (panel: PanelName): string => failedLine(PANEL_THING[panel]);

const FALLBACK: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", padding: 16, boxSizing: "border-box", minWidth: 0 };

/**
 * The fallback itself, for a panel that has its own query failure to show (Sources' status, the post's), and for a panel that
 * threw while drawing. G20: PageState's failed state, so the panel says what every page says, with Try again. A failed read
 * is reported once, by the query cache (lib/errors/wire.ts), not again here.
 */
export function PanelFailed({ panel, onRetry, error }: { panel: PanelName; onRetry: () => void; error?: unknown }) {
  const failure = useMemo(() => error ?? { name: "PanelError", message: `${panel} failed` }, [error, panel]);
  return (
    <div data-testid="panel-failed" data-panel={panel} style={FALLBACK}>
      <PageState read={readOf("error", undefined, onRetry, failure)} thing={PANEL_THING[panel]} region={panel} skeleton={null} log={`[Compose] ${panel} failed`}>
        {() => null}
      </PageState>
    </div>
  );
}

interface Props {
  panel: PanelName;
  /** The panel's own query has failed: show the fallback without a render error. */
  failed?: boolean;
  /** The real error of that query, for the log. */
  error?: unknown;
  /** Refetch this panel's queries, and only these. */
  onRetry?: () => void;
  children: ReactNode;
}

interface State {
  thrown: boolean;
}

class Boundary extends Component<Props, State> {
  state: State = { thrown: false };

  static getDerivedStateFromError(): State {
    return { thrown: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error, { source: "panel-boundary", context: this.props.panel, route: window.location.pathname });
  }

  private retry = () => {
    this.setState({ thrown: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.thrown || this.props.failed) return <PanelFailed panel={this.props.panel} error={this.props.failed ? this.props.error : undefined} onRetry={this.retry} />;
    return this.props.children;
  }
}

export function PanelBoundary(props: Props) {
  return <Boundary {...props} />;
}

export default PanelBoundary;
