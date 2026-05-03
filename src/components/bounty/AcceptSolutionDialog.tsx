import * as React from "react";
import { CheckCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface AcceptSolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solverHandle: string;
  solverDisplayName?: string;
  slotName: string;
  remainingSlotsAfter: number; // slots still unsolved after this accept
  isLastSlot: boolean;
  onConfirm: () => void | Promise<void>;
  submitting?: boolean;
}

export function AcceptSolutionDialog({
  open,
  onOpenChange,
  solverHandle,
  solverDisplayName,
  slotName,
  remainingSlotsAfter,
  isLastSlot,
  onConfirm,
  submitting = false,
}: AcceptSolutionDialogProps) {
  const statusLine = isLastSlot
    ? "→ solved"
    : `→ still open (${remainingSlotsAfter} more ${
        remainingSlotsAfter === 1 ? "slot" : "slots"
      })`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] p-6 border border-white/10 bg-background/95 backdrop-blur-xl"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle className="w-5 h-5" style={{ color: "#2EC4B6" }} />
            <span>
              Accept solution by{" "}
              <span className="text-foreground">@{solverHandle}</span>?
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-[13px] font-medium text-foreground/85">
            This action is permanent and cannot be undone.
          </p>
          <ul className="space-y-2 text-[13px] text-foreground/80">
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                <span className="text-foreground">
                  {solverDisplayName ? solverDisplayName : `@${solverHandle}`}
                </span>{" "}
                becomes co-author on this bounty
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                Their solution merges into the bounty's{" "}
                <span className="text-foreground">{slotName}</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                The bounty status updates{" "}
                <span
                  className="text-foreground"
                  style={{ color: isLastSlot ? "#2EC4B6" : undefined }}
                >
                  {statusLine}
                </span>
              </span>
            </li>
          </ul>
          <p className="text-[11px] italic text-muted-foreground pt-1 border-t border-white/5">
            All accepted solutions are permanently attributed via the
            platform's acceptance log. Attribution cannot be removed.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="text-black font-semibold"
            style={{ background: "#2EC4B6" }}
          >
            <Check className="w-4 h-4 mr-1.5" />
            {submitting ? "Accepting…" : "Accept and merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AcceptSolutionDialog;
