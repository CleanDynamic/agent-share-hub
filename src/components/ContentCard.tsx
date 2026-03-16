import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Lock, Loader2 } from "lucide-react";
import { getDownloadLabel, triggerDownload } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface ContentCardProps {
  id: string;
  content_type: string;
  title: string;
  description: string;
  difficulty: string;
  ai_tools: string[];
  download_count: number;
  monetisation_type: string;
  price_gbp?: number;
  file_url?: string | null;
}

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

export function ContentCard({
  id,
  content_type,
  title,
  description,
  difficulty,
  ai_tools,
  download_count: initialCount,
  monetisation_type,
  price_gbp,
  file_url,
}: ContentCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [count, setCount] = useState(initialCount);
  const [downloading, setDownloading] = useState(false);
  const isPaid = monetisation_type === "paid";
  const label = getDownloadLabel(content_type, monetisation_type, price_gbp);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();

    if (isPaid) {
      setDownloading(true);
      try {
        const priceInPence = Math.round((price_gbp ?? 0) * 100);
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            content_id: id,
            price_amount: priceInPence,
            success_url: `${window.location.origin}/content/${id}?payment=success`,
            cancel_url: `${window.location.origin}/content/${id}`,
          },
        });
        if (error || !data?.url) {
          toast({ title: "Checkout failed", description: "Could not start payment. Please try again.", variant: "destructive" });
        } else {
          window.location.href = data.url;
        }
      } catch {
        toast({ title: "Checkout failed", description: "Something went wrong.", variant: "destructive" });
      }
      setDownloading(false);
      return;
    }

    setDownloading(true);
    const result = await triggerDownload(id, file_url ?? null);
    if (result.error) {
      toast({ title: "Download failed", description: result.error, variant: "destructive" });
    } else if (result.newCount !== undefined) {
      setCount(result.newCount);
    }
    setDownloading(false);
  }

  return (
    <div
      onClick={() => navigate(`/content/${id}`)}
      className="w-full text-left border border-border rounded-xl p-5 bg-card hover:border-primary/40 transition-colors flex flex-col group cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium ${TYPE_COLORS[content_type] ?? TYPE_COLORS["Failure Library"]}`}
        >
          {content_type}
        </Badge>
        {!isPaid ? (
          <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">
            Free
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] font-medium bg-orange-500/15 text-orange-400 border-orange-500/30">
            £{(price_gbp ?? 0).toFixed(2)}
          </Badge>
        )}
      </div>

      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">{description}</p>

      {/* AI tools */}
      <div className="flex flex-wrap gap-1 mb-3">
        {ai_tools.map((tool) => (
          <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground">
            {tool}
          </span>
        ))}
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(difficulty)}`}>
          {difficulty}
        </Badge>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Download className="h-3 w-3" />
            <span className="text-[10px]">{count.toLocaleString()}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-primary hover:text-primary h-7 px-2"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isPaid ? (
              <><Lock className="h-3 w-3 mr-1" />{label}</>
            ) : (
              label
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
