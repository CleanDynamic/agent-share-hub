import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface GuestDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  onDownload: () => void;
}

export function GuestDownloadModal({ open, onOpenChange, contentId, onDownload }: GuestDownloadModalProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const [ready, setReady] = useState(false);

  // Log ad impression on open
  useEffect(() => {
    if (!open) {
      setCountdown(5);
      setReady(false);
      return;
    }
    supabase.from("ad_impressions").insert({
      content_id: contentId,
      user_id: null,
    });
  }, [open, contentId]);

  // Countdown timer
  useEffect(() => {
    if (!open) return;
    if (countdown <= 0) {
      setReady(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  const handleContinueAsGuest = useCallback(() => {
    // Mark ad as dismissed
    supabase.from("ad_impressions").update({ dismissed_at: new Date().toISOString() } as any)
      .eq("content_id", contentId)
      .is("user_id", null)
      .is("dismissed_at", null)
      .order("shown_at", { ascending: false })
      .limit(1);
    onOpenChange(false);
    onDownload();
  }, [contentId, onOpenChange, onDownload]);

  const handleCreateAccount = useCallback(() => {
    onOpenChange(false);
    navigate(`/signup?after_download=${contentId}`);
  }, [contentId, navigate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (ready || !v) onOpenChange(v); }}>
      <DialogContent className="bg-card border-border sm:max-w-md max-w-[calc(100vw-32px)] p-0 gap-0 overflow-hidden">
        {/* Ad placeholder */}
        <div className="flex items-center justify-center bg-accent/50 border-b border-border" style={{ minHeight: 100 }}>
          <div className="w-full max-w-[320px] h-[100px] rounded-lg border border-dashed border-border flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              Ad placeholder — will be replaced with live ad network code before launch.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center py-1">Advertisement</p>

        {/* Countdown / ready */}
        <div className="flex items-center justify-center py-3 border-b border-border">
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Your download starts in {countdown}…</span>
            </div>
          ) : (
            <p className="text-sm text-secondary font-medium">Ready to download</p>
          )}
        </div>

        {/* Account prompt */}
        <div className="p-6 space-y-3">
          <h3 className="text-base font-semibold text-foreground">One more thing</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create a free account to skip this wait, save content, and follow your favourite creators. It takes 30 seconds.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleCreateAccount} className="w-full min-h-[44px]">
              Create free account
            </Button>
            <button
              onClick={handleContinueAsGuest}
              disabled={!ready}
              className={`text-sm transition-colors ${
                ready ? "text-muted-foreground hover:text-foreground cursor-pointer" : "text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              Continue as guest
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
