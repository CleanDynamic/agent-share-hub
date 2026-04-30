import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientLabel: string;
  /** Receives the optional first-message body (empty string allowed). */
  onSubmit: (firstMessage: string) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Tiny "Send a first message" modal used when starting a new direct
 * conversation from a profile. The body is optional — pressing Skip
 * just opens the empty thread.
 */
export function MessageComposeModal({
  open, onOpenChange, recipientLabel, onSubmit, submitting,
}: MessageComposeModalProps) {
  const [text, setText] = useState("");

  const handleSubmit = async (skip = false) => {
    await onSubmit(skip ? "" : text.trim());
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message {recipientLabel}</DialogTitle>
          <DialogDescription>
            Optional — write a quick first message, or skip to open the empty thread.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say hi…"
          rows={3}
          autoFocus
          disabled={submitting}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
          >
            Skip
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={submitting}>
            {submitting ? "Opening…" : text.trim() ? "Send & open" : "Open thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
