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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Eyebrow } from "@/components/brand/Eyebrow";
import { IconButton } from "@/components/brand/IconButton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { ConnectorTool } from "@/lib/connect/connector";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

import { ConnectorGuide, type GuideStep } from "./ConnectorGuide";

/** The guide and its state, mounted only while the dialog or sheet is open. */
function GuideState({ onDone, gutter }: { onDone: () => void; gutter?: number }) {
  const [step, setStep] = useState<GuideStep>(1);
  const [tool, setTool] = useState<ConnectorTool>("Claude");
  return (
    <ConnectorGuide
      step={step}
      onStep={setStep}
      tool={tool}
      onTool={setTool}
      onDone={onDone}
      doneLabel="Done"
      gutter={gutter}
    />
  );
}

export interface ConnectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorDialog({ open, onOpenChange }: ConnectorDialogProps) {
  const phone = useIsPhone();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const { pathname } = useLocation();
  const at = useRef(pathname);
  useEffect(() => {
    if (at.current !== pathname) {
      at.current = pathname;
      close();
    }
  }, [pathname, close]);

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Connect a tool">
        <GuideState onDone={close} gutter={0} />
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="connector-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 51,
            width: 680,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "90dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowFloat,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "24px 24px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Eyebrow>Connector</Eyebrow>
              <Dialog.Title style={{ ...display(28), margin: 0, color: t.text }}>
                Send your sessions to buildgallery
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={34} />
            </Dialog.Close>
          </div>
          <GuideState onDone={close} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
  return (
    <ConnectorDialogContext.Provider value={api}>
      {children}
      <ConnectorDialog open={open} onOpenChange={setOpen} />
    </ConnectorDialogContext.Provider>
  );
}

export function useConnectorDialog(): ConnectorDialogApi {
  const api = useContext(ConnectorDialogContext);
  if (!api) throw new Error("useConnectorDialog must be used inside a ConnectorDialogProvider (SiteFrame mounts one).");
  return api;
}
