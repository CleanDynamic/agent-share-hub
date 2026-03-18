import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  contentId: string;
  creatorId: string;
  compatibilityStatus: string | null;
  lastVerifiedAt: string | null;
  /** "detail" for full bar, "card" for icon only */
  variant?: "detail" | "card";
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function CompatibilityBadge({ contentId, creatorId, compatibilityStatus, lastVerifiedAt, variant = "detail" }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(compatibilityStatus);
  const [verifiedAt, setVerifiedAt] = useState(lastVerifiedAt);

  const isCreator = user?.id === creatorId;
  const days = daysSince(verifiedAt);

  async function handleVerify() {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("content_items")
      .update({ last_verified_at: now, verified_by_creator_at: now, compatibility_status: "verified" } as any)
      .eq("id", contentId);
    if (!error) {
      setStatus("verified");
      setVerifiedAt(now);
      toast({ title: "Marked as verified", description: "Your content is now marked as working." });
    }
  }

  if (variant === "card") {
    if (status === "outdated") {
      return (
        <span title="Compatibility unverified — over 90 days since last update.">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
        </span>
      );
    }
    if (status === "verified") {
      return (
        <span title={`Verified ${days != null ? `${days}d ago` : ""}`}>
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        </span>
      );
    }
    return null;
  }

  // Detail variant
  if (status === "verified" && days != null) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" /> Verified {days}d ago
      </div>
    );
  }

  if (status === "outdated") {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border" style={{ backgroundColor: "#1A1500", borderColor: "#BA7517" }}>
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#EF9F27" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Last verified over 90 days ago — AI tools change fast. Check before using.
        </p>
        {isCreator && (
          <Button size="sm" variant="outline" className="shrink-0 text-xs h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handleVerify}>
            Still working ✓
          </Button>
        )}
      </div>
    );
  }

  return null;
}
