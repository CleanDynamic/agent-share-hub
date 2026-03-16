import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

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
  download_count,
  monetisation_type,
  price_gbp,
}: ContentCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/content/${id}`)}
      className="w-full text-left border border-border rounded-xl p-5 bg-card hover:border-primary/40 transition-colors flex flex-col group"
    >
      {/* Top row: type + price */}
      <div className="flex items-start justify-between mb-3">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium ${TYPE_COLORS[content_type] ?? TYPE_COLORS["Failure Library"]}`}
        >
          {content_type}
        </Badge>
        {monetisation_type === "free" ? (
          <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">
            Free
          </Badge>
        ) : (
          <span className="text-xs font-semibold text-foreground">
            £{(price_gbp ?? 0).toFixed(2)}
          </span>
        )}
      </div>

      {/* Title + description */}
      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
        {description}
      </p>

      {/* AI tools pills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {ai_tools.map((tool) => (
          <span
            key={tool}
            className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground"
          >
            {tool}
          </span>
        ))}
      </div>

      {/* Bottom row: difficulty + downloads */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(difficulty)}`}>
          {difficulty}
        </Badge>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Download className="h-3 w-3" />
          <span className="text-[10px]">{download_count.toLocaleString()}</span>
        </div>
      </div>
    </button>
  );
}
