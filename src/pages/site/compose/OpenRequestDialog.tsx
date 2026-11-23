/* SV-21, UX-08 P1: "Mark still open", asked in the composer. The maker says in a sentence what is missing: a session, the next
   session of a part, or a step tile. It marks the piece in the draft (`open` in `making`, or `is_gap` on a step tile); the topic is
   started on OpenBuilds when the build is published, and only for what is marked.

   PRESENTATIONAL. The caller writes. A real dialog (Radix): focus is trapped, Escape closes. */

import { useEffect, useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { OPEN_PROBLEM_MAX } from "@/lib/build/openRequest";

export { OPEN_REQUEST_COPY } from "./openRequestCopy";
import { OPEN_REQUEST_COPY } from "./openRequestCopy";
import { ModalForm, ModalShell } from "./ModalFrame";
import { Block, BlockHead, FieldArea, MODAL_WIDTH } from "./modalRecipes";

export interface OpenRequestDialogProps {
  open: boolean;
  title: string;
  /** UX-08 P1: what is already written, when the mark is being edited. */
  initial?: string;
  onClose: () => void;
  /** Called with the problem, trimmed. */
  onSubmit: (problem: string) => void;
}

export function OpenRequestDialog({ open, title, initial, onClose, onSubmit }: OpenRequestDialogProps) {
  const [problem, setProblem] = useState("");
  const [tried, setTried] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (open) {
      setProblem(initial ?? "");
      setTried(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read when the window opens, not when the text it started from changes
  }, [open]);

  const empty = problem.trim() === "";
  const phone = useIsPhone();

  /* Synth 09: the shared window (the same place, width and layers as every other), its one box empty with Expand. Pressing
     Mark still open with nothing written says so, as before, rather than greying the button. */
  return (
    <ModalShell open={open} onOpenChange={(next) => (next ? undefined : onClose())} title={title} subtitle={OPEN_REQUEST_COPY.description} width={MODAL_WIDTH.standard} testId="open-request-dialog">
      <ModalForm
        phone={phone}
        missing={null}
        addLabel={OPEN_REQUEST_COPY.submit}
        status=""
        alert={tried && empty ? OPEN_REQUEST_COPY.empty : null}
        onCancel={onClose}
        onSubmit={() => {
          setTried(true);
          if (!empty) onSubmit(problem.trim());
        }}
      >
        <Block noRule>
          <BlockHead label={OPEN_REQUEST_COPY.label} htmlFor={`${id}-problem`} />
          <FieldArea id={`${id}-problem`} phone={phone} rows={3} value={problem} maxLength={OPEN_PROBLEM_MAX} aria-invalid={tried && empty} onChange={(event) => setProblem(event.target.value)} />
        </Block>
      </ModalForm>
    </ModalShell>
  );
}
