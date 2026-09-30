import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PendingRevealStrip } from "@/components/trophies/pending-reveal-strip";
import { badgeBySlug, type Badge } from "@/components/trophies/badge-data";

export interface DepthRevealModalProps {
  open: boolean;
  /** Server rows from user_badges with state='pending_reveal'. */
  pendingBadges: Array<{
    id: string;
    badge_key: string;
    title: string | null;
    description: string | null;
  }>;
  onClose: () => void;
}

/**
 * Level-5 depth reveal moment. Wraps PendingRevealStrip and persists the
 * reveal server-side on close (the parent owns the markDepthRevealed call).
 */
export default function DepthRevealModal({ open, pendingBadges, onClose }: DepthRevealModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // A key in the catalogue of XP-DESIGN.md draws as its badge, tier and all; a key that is not
  // one of the ten (a row from before RC-P26 removed them) still draws, as a common badge.
  const stripBadges: Badge[] = pendingBadges.slice(0, 4).map((b) => {
    const known = badgeBySlug(b.badge_key);
    if (known) return { ...known, earned: true };
    return {
      id: b.id,
      name: b.title || b.badge_key || "New badge",
      description: b.description || "",
      icon: Sparkles,
      tier: "common",
      earned: true,
    };
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">A deeper layer just opened</DialogTitle>
          <DialogDescription>
            You've reached Level 5. New ways to progress — skill tracks, daily challenges, and a lineage view — are now visible across the app.
          </DialogDescription>
        </DialogHeader>

        {stripBadges.length > 0 && (
          <div className="py-6">
            <PendingRevealStrip badges={stripBadges} />
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} className="w-full">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
