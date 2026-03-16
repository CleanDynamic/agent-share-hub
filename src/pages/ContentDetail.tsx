import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDownloadLabel, triggerDownload } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Lock, Loader2, ArrowLeft, User } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
};

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const ContentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [localCount, setLocalCount] = useState<number | null>(null);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ["content_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, profiles(username, display_name)")
        .eq("id", id!)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const count = localCount ?? item?.download_count ?? 0;
  const isPaid = item?.monetisation_type === "paid";
  const label = item ? getDownloadLabel(item.content_type, item.monetisation_type, item.price_gbp ?? undefined) : "";

  async function handleDownload() {
    if (!item) return;
    if (isPaid) {
      toast({ title: "Payment coming soon", description: "Check back shortly." });
      return;
    }
    setDownloading(true);
    const result = await triggerDownload(item.id, item.file_url);
    if (result.error) {
      toast({ title: "Download failed", description: result.error, variant: "destructive" });
    } else if (result.newCount !== undefined) {
      setLocalCount(result.newCount);
    }
    setDownloading(false);
  }

  if (isLoading) {
    return (
      <div className="py-16 px-6 mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-5 w-1/2 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!item || error) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Content not found or not yet approved.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse</Link>
        </Button>
      </div>
    );
  }

  const creator = item.profiles as { username: string; display_name: string | null } | null;

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-3xl">
        {/* Back */}
        <Link to="/browse" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Browse
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 mb-2">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}
          >
            {item.content_type}
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
            {item.difficulty}
          </Badge>
          {!isPaid && (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">
              Free
            </Badge>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{item.title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.description}</p>

        {/* Creator + stats */}
        <div className="flex flex-wrap items-center gap-4 mb-8 text-sm">
          {creator && (
            <Link
              to={`/creator/${creator.username}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              <span>{creator.display_name || creator.username}</span>
            </Link>
          )}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Download className="h-3.5 w-3.5" />
            <span>{count.toLocaleString()} downloads</span>
          </div>
        </div>

        {/* AI Tools */}
        {item.ai_tools && item.ai_tools.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Works with</h3>
            <div className="flex flex-wrap gap-2">
              {item.ai_tools.map((tool) => (
                <span key={tool} className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Use Cases */}
        {item.use_cases && item.use_cases.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Use cases</h3>
            <div className="flex flex-wrap gap-2">
              {item.use_cases.map((uc) => (
                <span key={uc} className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground">
                  {uc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Download button */}
        <div className="border border-border rounded-xl p-6 bg-card mb-8">
          <Button size="lg" className="w-full" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isPaid ? (
              <Lock className="mr-2 h-4 w-4" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {label}
          </Button>
          {isPaid && (
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              £{(item.price_gbp ?? 0).toFixed(2)} — one-time payment
            </p>
          )}
        </div>

        {/* Instructions */}
        {item.use_instructions && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">How to Use</h2>
            <div className="border border-border rounded-xl p-5 bg-card">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-[inherit] leading-relaxed">
                {item.use_instructions}
              </pre>
            </div>
          </div>
        )}

        {/* What to expect */}
        {item.what_to_expect && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">What to Expect</h2>
            <div className="border border-border rounded-xl p-5 bg-card">
              <p className="text-sm text-muted-foreground leading-relaxed">{item.what_to_expect}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentDetail;
