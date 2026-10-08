// "Report this build" / "Report this comment" (RC-P17b).
//
// THE EXISTING DIALOG (STATES.md row 17): --r-panel, overlay elevation and its
// scrim, so the page recedes in both rooms and the dialog is the only figure
// ⟦law-of-figure-ground › Overlays and scrims⟧. Five reasons as radios, most
// likely first and "Something else" last ⟦hicks-law › Budgets: dialog, ≤ 5⟧,
// none chosen until the reader chooses; an optional note of at most 500
// characters; one filled button, and it says what it does: "Send report"
// ⟦von-restorff-effect⟧ ⟦critique-affordance › CTA Clarity⟧, beside a tertiary
// Cancel. Once sent, the dialog says "Thanks. An admin will look at it."
//
// The note is the reader's own words and never reaches an error or a log
// ⟦neoscale-error-monitoring › Privacy⟧; a refusal is one sentence (row 21) and
// what the reader wrote stays in the dialog.

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isPermissionError } from "@/lib/errors/permission";
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  reportTarget,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/moderation";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SPACE_COMPACT as SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, label as labelType } from "@/lib/theme/type";

export interface ReportDialogProps {
  /** What is being reported; null closes the dialog. */
  target: { type: ReportTargetType; id: string } | null;
  onClose: () => void;
}

export function ReportDialog({ target, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  /* UI-P59 (density): controls drawn 44 tall are 36 through the table, and keep 44 on a phone, the touch target. */
  const phone = useIsPhone();
  const touch = phone ? 44 : 36;
  const noteId = useId();
  const field = useInteractive<HTMLTextAreaElement>();

  // A new target starts a new report.
  useEffect(() => {
    setReason("");
    setNote("");
    setSent(false);
    setRefusal(null);
  }, [target?.type, target?.id]);

  const title = target?.type === "comment" ? "Report this comment" : "Report this build";

  const send = async () => {
    if (!target || !reason || sending) return;
    setSending(true);
    setRefusal(null);
    try {
      await reportTarget({ targetType: target.type, targetId: target.id, reason, note });
      setSent(true);
    } catch (error) {
      setRefusal(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (!open && !sending ? onClose() : undefined)}>
      <DialogContent data-testid="report-dialog" style={{ maxWidth: 480 }}>
        <DialogTitle style={{ ...body, fontSize: 15, fontWeight: 600 }}>{title}</DialogTitle>
        {sent ? (
          <>
            <DialogDescription style={{ ...body, color: t.text }}>Thanks. An admin will look at it.</DialogDescription>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="button" variant="outline" onClick={onClose} style={{ background: "transparent", minHeight: touch }}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
          >
            <DialogDescription style={{ ...body, color: t.text2 }}>What is wrong with it?</DialogDescription>
            <RadioGroup
              aria-label="Reason"
              value={reason}
              onValueChange={(value) => setReason(value as ReportReason)}
              style={{ display: "flex", flexDirection: "column", gap: 0 }}
            >
              {REPORT_REASONS.map((option) => (
                <label
                  key={option.value}
                  style={{ ...body, color: t.text, display: "flex", alignItems: "center", gap: SPACE.xs, minHeight: touch, cursor: "pointer" }}
                >
                  <RadioGroupItem value={option.value} aria-label={option.label} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
              <label htmlFor={noteId} style={{ ...labelType, color: t.text2 }}>
                Anything to add? (optional)
              </label>
              <textarea
                id={noteId}
                value={note}
                maxLength={REPORT_NOTE_MAX}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                {...field.handlers}
                style={{ ...fieldStyle(field.state), ...body, width: "100%", padding: "7px 9px", resize: "vertical" }}
              />
            </div>
            {refusal ? (
              <p role="alert" style={{ ...body, color: t.text, margin: 0 }}>
                {refusal}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
              <Button type="button" variant="ghost" onClick={onClose} disabled={sending} style={{ minHeight: touch }}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={!reason || sending} style={{ minHeight: touch }}>
                Send report
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReportDialog;
