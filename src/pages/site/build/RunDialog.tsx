/* UI-P29 — "I ran this", asked properly: which model, and anything worth adding.

   The proof panel's one primary opens this, because the panel promises "your run
   relights the lamp and records the model you used" — and a model nobody was
   asked for cannot be recorded. The words are ReproductionAction's (the legacy
   page's sheet), so the two pages ask the same question in the same way.

   PRESENTATIONAL. The page owns the write: `onSubmit` is `recordReproduction()`
   for a reader and `recordSelfConfirmation()` for the build's creator, who has
   no note to leave and no "it did not work" — that is an edit to make, not a
   signal to file.

   A real dialog (Radix): focus is trapped, Escape closes, the page behind is
   inert. Solid `--solid`, no blur — the page's three blurred surfaces are the
   header, the title plate and the action dock. */

import { useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { fieldStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

export interface RunSubmission {
  worked: boolean;
  model: string;
  note: string;
}

export interface RunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The build's creator: a re-confirmation, not a reproduction. */
  creator: boolean;
  /** The models the build says it was made with, offered rather than imposed. */
  suggestions: readonly string[];
  /** What the model field starts with. */
  initialModel?: string;
  /** Records it. Rejects with the reason when it could not. */
  onSubmit: (submission: RunSubmission) => Promise<void>;
}

const label: CSSProperties = {
  fontFamily: DM_MONO,
  fontSize: 11,
  letterSpacing: ".09em",
  textTransform: "uppercase",
  color: t.label,
};

const input: CSSProperties = {
  ...fieldStyle(),
  fontFamily: FIGTREE,
  /* 16px: anything smaller makes mobile Safari zoom the page on focus. */
  fontSize: 16,
  width: "100%",
  padding: "10px 12px",
  color: t.text,
  boxSizing: "border-box",
};

export function RunDialog({ open, onOpenChange, creator, suggestions, initialModel = "", onSubmit }: RunDialogProps) {
  const [model, setModel] = useState(initialModel);
  const [note, setNote] = useState("");
  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  /* Each opening starts from what the page knows, not from the last attempt. */
  useEffect(() => {
    if (!open) return;
    setModel(initialModel);
    setNote("");
  }, [open, initialModel]);

  /* OPTIMISTIC: the page shows the new count at once and writes after, so the dialog closes on submit rather than
     waiting. A write that fails is the page's to say (in the proof panel, with a retry), never an exception here. */
  const submit = (worked: boolean) => {
    onOpenChange(false);
    void onSubmit({ worked, model, note });
  };

  const onForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(true);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="build-run-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 41,
            width: "min(480px, calc(100vw - 28px))",
            maxHeight: "88dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "18px 20px 20px",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <form onSubmit={onForm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <Dialog.Title style={{ ...display(22), margin: 0, color: t.text }}>
                {creator ? "You ran your own build" : "You ran this build"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Close" size={38} />
              </Dialog.Close>
            </div>
            <Dialog.Description style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: t.text2 }}>
              {creator
                ? "This moves the date on the freshness line. It does not touch the count — that stays other people."
                : "What you say here is what the next reader sees. Both answers are worth having."}
            </Dialog.Description>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor={`${ids}-model`} style={label}>
                Which model did you run it on?
              </label>
              <input
                id={`${ids}-model`}
                type="text"
                list={`${ids}-models`}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                autoComplete="off"
                style={input}
              />
              <datalist id={`${ids}-models`}>
                {suggestions.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
              <span style={{ fontSize: 12, lineHeight: 1.45, color: t.text2 }}>
                {suggestions.length > 0
                  ? `The creator used ${suggestions.join(", ")}. Say what you used.`
                  : "Leave it blank rather than guess."}
              </span>
            </div>

            {creator ? null : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor={`${ids}-note`} style={label}>
                  Anything worth adding? (optional)
                </label>
                <textarea
                  id={`${ids}-note`}
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What you changed, what tripped you up, what it cost you."
                  style={{ ...input, minHeight: 72, resize: "vertical", display: "block" }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {creator ? (
                <span />
              ) : (
                <Button variant="ghost" size={44} fontSize={13} onClick={() => submit(false)}>
                  It did not work
                </Button>
              )}
              <Button type="submit" variant="primary" size={44} fontSize={14}>
                {creator ? "It still works" : "It worked"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RunDialog;
