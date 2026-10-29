/* SV-21: "Offer a session", asked on OpenBuilds. The contributor picks one of their own sessions; it is copied by `addSession`'s
   rule (prompt text, model and source only) into their fork, and offered to the maker.

   PRESENTATIONAL. The page owns the reads and the write. One choice from a list is a radio group (Radix, as the report
   dialog's): one tab stop and the arrow keys. A real dialog (Radix): focus is trapped, Escape closes. */

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

export interface OfferChoice {
  id: string;
  /** Its first prompt. */
  name: string;
  /** "Claude Code · Opus 5.5 · 3 Oct · 6 prompts". */
  detail: string;
}

export interface OfferSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  choices: readonly OfferChoice[];
  /** Files the offer. Rejects with a sentence when it could not. */
  onOffer: (sessionId: string) => Promise<void>;
}

export function OfferSessionDialog({ open, onOpenChange, status, onRetry, choices, onOffer }: OfferSessionDialogProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  
  /* Each opening starts clean. */
  useEffect(() => {
    if (open) {
      setPicked(null);
      setBusy(false);
      setFailure(null);
    }
  }, [open]);

  const submit = async () => {
    if (!picked || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await onOffer(picked);
      onOpenChange(false);
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : "Couldn't offer that session. Try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="offer-session-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 41,
            width: "min(520px, calc(100vw - 28px))",
            maxHeight: "88dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "12px 16px 16px",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Dialog.Title style={{ ...display(22), margin: 0, color: t.text }}>Offer a session</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={38} />
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ margin: "8px 0 12px", fontSize: 13, lineHeight: 1.55, color: t.text2 }}>
            Pick one of your sessions. Its prompt text, model and source are copied into your own copy of the build, and offered to its maker. The rest of the
            session stays with you.
          </Dialog.Description>

          {status === "loading" ? (
            <p role="status" style={{ margin: 0, fontSize: 13, color: t.text2 }}>Loading your sessions.</p>
          ) : status === "error" ? (
            <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: t.text2 }}>
              <span style={{ flex: 1 }}>Your sessions didn't load.</span>
              <Button variant="ghost" size={44} fontSize={13} onClick={onRetry}>Retry</Button>
            </div>
          ) : choices.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>You have no finished sessions yet. Send one from your app, then come back.</p>
          ) : (
            <RadioGroup aria-label="Your sessions" value={picked ?? ""} onValueChange={setPicked} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {choices.map((choice, index) => (
                <label
                  key={choice.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, minHeight: 52, padding: "12px 0", borderTop: index === 0 ? "none" : `1px solid ${t.hairline}`, cursor: "pointer" }}
                >
                  <RadioGroupItem value={choice.id} aria-label={choice.name} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{choice.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: t.label }}>{choice.detail}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {failure ? <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: t.text2 }}>{failure}</p> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <Button variant="primary" size={44} fontSize={14} onClick={() => void submit()} disabled={!picked || busy}>
              {busy ? "Offering" : "Offer this session"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
