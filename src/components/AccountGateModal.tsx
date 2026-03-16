import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Lock } from "lucide-react";

interface AccountGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  mode: "purchase" | "subscription";
}

export function AccountGateModal({ open, onOpenChange, contentId, mode }: AccountGateModalProps) {
  const navigate = useNavigate();

  const param = mode === "purchase" ? "after_purchase" : "after_subscribe";

  const handleCreateAccount = useCallback(() => {
    onOpenChange(false);
    navigate(`/signup?${param}=${contentId}`);
  }, [contentId, navigate, onOpenChange, param]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md max-w-[calc(100vw-32px)]">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Account required</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You need a free account to {mode === "purchase" ? "purchase" : "subscribe to"} content on NeoScale AI.
          </p>
          <Button onClick={handleCreateAccount} className="w-full min-h-[44px]">
            Create free account
          </Button>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
