import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PromoteToBlueprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bountyTitle: string;
  onConfirm: () => void | Promise<void>;
  submitting?: boolean;
}

export function PromoteToBlueprintDialog({
  open,
  onOpenChange,
  bountyTitle,
  onConfirm,
  submitting = false,
}: PromoteToBlueprintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-6 border border-white/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="w-5 h-5" style={{ color: "#2EC4B6" }} />
            <span>
              Promote{" "}
              <span className="text-foreground">'{bountyTitle}'</span> to a
              blueprint?
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-[13px] font-medium text-foreground/85">
            Here's what happens next:
          </p>
          <ul className="space-y-2 text-[13px] text-foreground/80">
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>A new blueprint will be created.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                All bounty content — article body, accepted solutions merged
                in, results, and references — copies over.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                Co-authors (you plus all accepted solvers) carry forward in
                the byline.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>Provenance markers stay intact.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-300 select-none">•</span>
              <span>
                The original bounty is preserved as a permanent record. The
                new blueprint is a separate, canonical post.
              </span>
            </li>
          </ul>
          <p className="text-[11px] italic text-muted-foreground pt-1 border-t border-white/5">
            You can edit metadata on the blueprint before it's discovered. The
            bounty stays as the historical record of the competition.
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
            style={{ background: "#F59E0B" }}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {submitting ? "Promoting…" : "Confirm and promote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromoteToBlueprintDialog;
