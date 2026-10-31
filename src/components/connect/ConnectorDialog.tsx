// UI-P45 — the connector guide as a dialog, opened from anywhere in the frame.
//
// `useConnectorDialog().open()` is how the footer's "Connect a tool", Drafts and
// the dashboard sidebar open it. The provider (mounted once, in `SiteFrame`)
// holds the one open/closed bit and renders the dialog; the step and the tool
// live inside the dialog's content, which Radix unmounts on close, so each
// opening starts at step 1 on Claude.
//
// 768px and up it is a real dialog (Radix: focus trapped, Escape closes, focus
// returns to whatever opened it, which the provider remembers) 680px wide on `--solid`; below that it is a
// `BottomSheet`. Neither blurs. Following a link inside the guide (Import)
// navigates under an open dialog, so a change of route closes it.

import { Suspense, createContext, lazy, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useEverOpened, useLoadAtIdle } from "@/lib/routing/lazyHost";

/** SV-26 P2: the dialog and the guide load the first time it opens, or at idle. */
const loadView = () => import("./ConnectorDialogView");
const ConnectorDialog = lazy(loadView);

interface ConnectorDialogApi {
  open: () => void;
}

const ConnectorDialogContext = createContext<ConnectorDialogApi | null>(null);

export function ConnectorDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  /* Radix returns focus only to a `Trigger`, and this dialog has none (any
     button in the frame opens it), so the opener is remembered here and
     focused again once the dialog or sheet has closed. */
  const opener = useRef<HTMLElement | null>(null);
  const api = useMemo<ConnectorDialogApi>(
    () => ({
      open: () => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(true);
      },
    }),
    [],
  );
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const id = setTimeout(() => opener.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);
  const mounted = useEverOpened(open);
  useLoadAtIdle(loadView);
  return (
    <ConnectorDialogContext.Provider value={api}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <ConnectorDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </ConnectorDialogContext.Provider>
  );
}

export function useConnectorDialog(): ConnectorDialogApi {
  const api = useContext(ConnectorDialogContext);
  if (!api) throw new Error("useConnectorDialog must be used inside a ConnectorDialogProvider (SiteFrame mounts one).");
  return api;
}
