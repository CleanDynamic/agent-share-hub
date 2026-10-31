// SV-26 P2: the connector dialog and the guide inside it. ConnectorDialog.tsx keeps the open bit and loads this the first time
// the dialog opens, or at idle.

import { useCallback, useEffect, useRef, useState } from "react";
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

export default function ConnectorDialogView({ open, onOpenChange }: ConnectorDialogProps) {
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 9, padding: "17px 17px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
