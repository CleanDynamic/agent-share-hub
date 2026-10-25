/* CA-24 P3: one boundary per panel.

   `ErrorBoundary` (App.tsx) replaces the whole screen with a reload prompt and has one fixed fallback; `RouteBoundary` keeps a
   route's failure inside its frame. Neither can be set per use, so the composer's panels (Sources, the post, the build list,
   Details, the map) each get this: a failure stays inside the panel that failed and the others keep working.

   THE FALLBACK sits in the panel's own place, at its top-left, with padding 16: "{Panel} didn't load" (13/500) and, 8 below,
   a small Retry. A panel's query failing (`failed`) shows the same fallback as a render error.

   RETRY resets this boundary and runs `onRetry`, which refetches that panel's own queries and no others.

   WHAT IS REPORTED (CA-29). The failure goes to reportError once, naming the panel, the route and the kind of error. An error's
   message can quote what the panel was drawing (a prompt's text, a post), and reportError never keeps or sends a message. */

import { Component, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { reportError } from "@/lib/errors/report";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type PanelName = "Sources" | "Post" | "Build" | "Details" | "Map";

export const panelFailedLine = (panel: PanelName): string => `${panel} didn't load`;

const FALLBACK: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: 16, boxSizing: "border-box", minWidth: 0 };
const LINE: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "normal", color: t.text };
const RETRY: CSSProperties = {
  appearance: "none",
  boxSizing: "border-box",
  height: 26,
  padding: "0 9px",
  borderRadius: 7,
  fontFamily: FIGTREE,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: "normal",
  color: t.text,
  cursor: "pointer",
};

function RetryButton({ onClick }: { onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-testid="panel-retry" onClick={onClick} {...handlers} style={{ ...RETRY, ...controlPaint({ hovered: state.hovered, pressed: state.pressed }), ...ring(state.focusVisible) }}>
      Retry
    </button>
  );
}

/** The fallback itself, for a panel that has its own query failure to show (Sources' status, the post's). */
export function PanelFailed({ panel, onRetry, error }: { panel: PanelName; onRetry: () => void; error?: unknown }) {
  const logged = useRef<unknown>(undefined);
  useEffect(() => {
    if (error === undefined || logged.current === error) return;
    logged.current = error;
    reportError(error, { source: "boundary", boundary: panel, route: window.location.pathname });
  }, [error, panel]);
  return (
    <div role="alert" data-testid="panel-failed" data-panel={panel} style={FALLBACK}>
      <p style={LINE}>{panelFailedLine(panel)}</p>
      <RetryButton onClick={onRetry} />
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
    reportError(error, { source: "boundary", boundary: this.props.panel, route: window.location.pathname });
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
