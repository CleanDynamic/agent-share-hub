import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Eye } from "lucide-react";

interface ProjectCardProps {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  creatorDisplayName: string;
  creatorUsername: string;
  componentTypes: string[];
  componentCount: number;
  viewCount: number;
}

export function ProjectCard({
  id,
  title,
  description,
  coverImageUrl,
  creatorDisplayName,
  creatorUsername,
  componentTypes,
  componentCount,
  viewCount,
}: ProjectCardProps) {
  return (
    <div className="border border-border rounded-xl bg-card p-4 flex gap-4 hover:border-primary/30 transition-colors">
      {/* Cover */}
      <div className="w-[120px] h-[80px] rounded-lg bg-muted/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          <Link
            to={`/creator/${creatorUsername}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            By {creatorDisplayName}
          </Link>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 min-w-0">
            {componentTypes.length > 0 && (
              <span className="text-[10px] text-muted-foreground truncate">
                {componentTypes.join(" · ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {componentCount} component{componentCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {viewCount}
            </span>
          </div>
        </div>

        <Link to={`/project/${id}`}>
          <Button
            size="sm"
            className="mt-2 text-xs h-7 w-full"
            style={{ backgroundColor: "#E8571A" }}
          >
            View Project
          </Button>
        </Link>
      </div>
    </div>
  );
}
