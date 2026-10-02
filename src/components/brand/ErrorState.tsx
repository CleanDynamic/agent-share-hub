// The error state (UI-P37): a panel that did not load, said once, with a way
// to ask again.
//
// A column, 10 apart: one sentence in Figtree 14px `--text` ("That didn't
// load."), the panel's own name under it in DM Mono 11px `--label` so a page
// with two failures says which two, and a secondary 34/12 "Try again" that calls
// the query's `refetch`. The sentence is the same in every panel on purpose: a
// failure is recognised, not read.
//
// NEVER THE EXCEPTION. No message, no stack, no id — a visitor cannot act on
// "PGRST116" and a maintainer does not want it printed over a build. The real
// error goes to the console, once, where the maintainer looks; `error` is how a
// container hands it over. A refusal ("You don't have access to this.") is a
// truer sentence than the default and is passed as `line`; it is still words,
// never the thrown thing.
//
// THE FAILURE STAYS INSIDE THE PANEL THAT FAILED. The page's header, breadcrumb
// and footer render around it, and so does every panel that did load: one
// failing panel never blanks the page. Where a write fails after the screen has
// already shown its result (reproduce, me too, mark read), this is the line the
// panel falls back to, with `line` saying "That didn't save." instead.
//
// On a phone the button is 44 tall, the touch floor. The region is an alert, so
// a failure that arrives after the page has settled is announced; each one names
// its panel, so a screen reader hears which.

import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, mono } from "@/lib/theme/type";

import { Button } from "./Button";

export const DEFAULT_ERROR_LINE = "That didn't load.";

/**
 * A panel's failure, as a pure view takes it: the retry and the real error. The
 * container maps a query's `error` and `refetch` to this; the view hands both to
 * `ErrorState`, which logs the error and shows neither the error nor its message.
 */
export interface PanelFailure {
  onRetry: () => void;
  error?: unknown;
}

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "style" | "role"> {
  /** The sentence. The same words everywhere unless a panel has a truer one. */
  line?: string;
  /** The panel's name, in DM Mono under the sentence: "The visitors’ book". */
  panel: string;
  /** The query's `refetch`, or the write's retry. */
  onRetry: () => void;
  /** The real error. Logged once, never shown. */
  error?: unknown;
  /** Spacing from the panel's head, where the panel needs it. */
  style?: CSSProperties;
}

/** Log `error` the first time it is seen, and not again when the panel re-renders. */
function useLogOnce(error: unknown, panel: string) {
  const logged = useRef<unknown>(undefined);
  useEffect(() => {
    if (error === undefined || logged.current === error) return;
    logged.current = error;
    console.error(`[${panel}] did not load`, error);
  }, [error, panel]);
}

export function ErrorState({ line = DEFAULT_ERROR_LINE, panel, onRetry, error, style, ...rest }: ErrorStateProps) {
  const phone = useIsPhone();
  useLogOnce(error, panel);

  return (
    <div
      data-ui="error-state"
      {...rest}
      role="status"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, ...style }}
    >
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: "normal", color: t.text }}>{line}</p>
      <span style={{ ...mono(11), lineHeight: "normal", color: t.label }}>{panel}</span>
      <Button variant="secondary" size={phone ? 44 : 34} fontSize={phone ? 13 : 12} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export default ErrorState;
