import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AddToLibraryButtonProps {
  contentId: string;
  currentVersion?: string;
  contentTitle?: string;
  /** "icon" = small icon-only for cards, "full" = labelled button for detail page */
  variant?: "icon" | "full";
}

export function AddToLibraryButton({
  contentId,
  currentVersion,
  contentTitle,
  variant = "icon",
}: AddToLibraryButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inLibrary, setInLibrary] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setLoaded(true);
      return;
    }
    supabase
      .from("user_library")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .maybeSingle()
      .then(({ data }) => {
        setInLibrary(!!data);
        setLoaded(true);
      });
  }, [isLoggedIn, user, contentId]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!isLoggedIn || !user) {
        toast({ title: "Sign in to build your library" });
        setTimeout(() => navigate("/signup"), 1000);
        return;
      }

      if (inLibrary) {
        // Remove
        setInLibrary(false);
        const { error } = await supabase
          .from("user_library")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", contentId);
        if (error) {
          setInLibrary(true);
        } else {
          toast({ title: "Removed from library" });
        }
      } else {
        // Add
        setInLibrary(true);
        const { error } = await supabase.from("user_library").insert({
          user_id: user.id,
          content_id: contentId,
          last_seen_version: currentVersion || null,
        } as any);
        if (error) {
          setInLibrary(false);
        } else {
          toast({ title: "Added to your library" });
          // Log interaction
          supabase.from("user_interactions").insert({
            user_id: user.id,
            content_id: contentId,
            interaction_type: "added_to_library",
            interaction_meta: { content_title: contentTitle || "" },
          } as any);
        }
      }
    },
    [inLibrary, isLoggedIn, user, contentId, currentVersion, contentTitle, navigate, toast]
  );

  if (!loaded) return null;

  if (variant === "full") {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`w-full text-xs ${
          inLibrary
            ? "text-secondary border-secondary/40 hover:bg-secondary/10"
            : "text-foreground border-border hover:text-foreground"
        }`}
        onClick={handleClick}
      >
        <Library
          className={`h-3.5 w-3.5 mr-1.5 ${inLibrary ? "fill-secondary text-secondary" : ""}`}
        />
        {inLibrary ? "In Your Library" : "Add to Library"}
      </Button>
    );
  }

  // Icon variant for cards
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="p-1 rounded-md transition-colors hover:bg-accent"
            aria-label={inLibrary ? "Remove from library" : "Add to library"}
          >
            <Library
              className={`h-4 w-4 transition-colors ${
                inLibrary ? "fill-secondary text-secondary" : "text-muted-foreground"
              }`}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{inLibrary ? "In your library" : "Add to library"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
