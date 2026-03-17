import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { useToast } from "@/hooks/use-toast";

interface VerificationButtonProps {
  contentId: string;
  contentTitle: string;
  isVerified: boolean;
  verificationCount: number;
  isEligible: boolean;
}

export function VerificationButton({
  contentId,
  contentTitle,
  isVerified,
  verificationCount,
  isEligible,
}: VerificationButtonProps) {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: toolNames } = useApprovedToolNames();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedTool, setSelectedTool] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: alreadyVerified } = useQuery({
    queryKey: ["user_verification", contentId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_verifications")
        .select("id")
        .eq("content_id", contentId)
        .eq("user_id", user!.id)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  async function handleConfirm() {
    if (!user || !selectedTool) return;
    setSubmitting(true);
    try {
      await supabase.from("content_verifications").insert({
        content_id: contentId,
        user_id: user.id,
        ai_tool_used: selectedTool,
      });
      await supabase.from("user_interactions").insert({
        user_id: user.id,
        content_id: contentId,
        interaction_type: "verified",
        interaction_meta: { content_title: contentTitle, ai_tool: selectedTool },
      } as any);
      queryClient.invalidateQueries({ queryKey: ["user_verification", contentId] });
      queryClient.invalidateQueries({ queryKey: ["content_detail", contentId] });
      setShowConfirm(false);
      toast({ title: "Verification recorded ✓" });
    } catch {
      toast({ title: "Failed to verify", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-2">
      {isVerified && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#1D9E75]/10 text-[#1D9E75]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">
            Verified working by {verificationCount} {verificationCount === 1 ? "person" : "people"}
          </span>
        </div>
      )}

      {isLoggedIn && isEligible && alreadyVerified === true && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> You verified this ✓
        </p>
      )}

      {isLoggedIn && isEligible && alreadyVerified === false && !showConfirm && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-[#1D9E75]/40 text-[#1D9E75] hover:bg-[#1D9E75]/10"
          onClick={() => setShowConfirm(true)}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Mark as tested — it worked for me
        </Button>
      )}

      {showConfirm && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
          <p className="text-xs text-muted-foreground">Which AI tool did you use?</p>
          <div className="relative">
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 appearance-none pr-8 text-foreground"
            >
              <option value="">Select a tool…</option>
              {toolNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs" onClick={handleConfirm} disabled={!selectedTool || submitting}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VerifiedBadgeInline({ isVerified }: { isVerified: boolean }) {
  if (!isVerified) return null;
  return (
    <Badge className="bg-[#1D9E75] text-white border-transparent text-[11px] font-medium px-1.5 py-0">
      ✓ Verified working
    </Badge>
  );
}
