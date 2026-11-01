/* SV-21: "Open as a request", asked in the composer. The maker says in a sentence what they want from someone else: a
   session in place of the one they have, or the next session of a part. It marks the session or the part in the draft
   (`open` in `making`); the request itself is filed when the build is published, and only for what is marked.

   PRESENTATIONAL. The caller writes. A real dialog (Radix): focus is trapped, Escape closes. */

import { useEffect, useId, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { OPEN_PROBLEM_MAX } from "@/lib/build/openRequest";
import { fieldStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

export { OPEN_REQUEST_COPY } from "./openRequestCopy";
import { OPEN_REQUEST_COPY } from "./openRequestCopy";

export interface OpenRequestDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Called with the problem, trimmed. */
  onSubmit: (problem: string) => void;
}

export function OpenRequestDialog({ open, title, onClose, onSubmit }: OpenRequestDialogProps) {
  const [problem, setProblem] = useState("");
  const [tried, setTried] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (open) {
      setProblem("");
      setTried(false);
    }
  }, [open]);

  const empty = problem.trim() === "";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTried(true);
    if (empty) return;
    onSubmit(problem.trim());
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="open-request-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 41,
            width: "min(480px, calc(100vw - 32px))",
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
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <Dialog.Title style={{ ...display(22), margin: 0, color: t.text }}>{title}</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Close" size={38} />
              </Dialog.Close>
            </div>
            <Dialog.Description style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: t.text2 }}>{OPEN_REQUEST_COPY.description}</Dialog.Description>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor={`${id}-problem`} style={{ fontSize: 12, color: t.label }}>
                {OPEN_REQUEST_COPY.label}
              </label>
              <textarea
                id={`${id}-problem`}
                rows={3}
                value={problem}
                maxLength={OPEN_PROBLEM_MAX}
                aria-invalid={tried && empty}
                aria-describedby={tried && empty ? `${id}-why` : undefined}
                onChange={(event) => setProblem(event.target.value)}
                style={{ ...fieldStyle(), fontFamily: FIGTREE, fontSize: 16, width: "100%", padding: "8px", color: t.text, boxSizing: "border-box", resize: "vertical" }}
              />
              {tried && empty ? (
                <span id={`${id}-why`} role="alert" style={{ fontSize: 12, color: t.text2 }}>
                  {OPEN_REQUEST_COPY.empty}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary" size={44} fontSize={14}>
                {OPEN_REQUEST_COPY.submit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
