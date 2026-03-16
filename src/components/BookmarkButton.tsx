import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface BookmarkButtonProps {
  contentId: string;
  className?: string;
}

export function BookmarkButton({ contentId, className }: BookmarkButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setLoaded(true);
      return;
    }
    supabase
      .from("user_saves")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .maybeSingle()
      .then(({ data }) => {
        setSaved(!!data);
        setLoaded(true);
      });
  }, [isLoggedIn, user, contentId]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isLoggedIn || !user) {
      toast({ title: "Sign in to save this" });
      setTimeout(() => navigate("/signup"), 1000);
      return;
    }

    if (saved) {
      setSaved(false);
      const { error } = await supabase
        .from("user_saves")
        .delete()
        .eq("user_id", user.id)
        .eq("content_id", contentId);
      if (error) setSaved(true);
    } else {
      setSaved(true);
      const { error } = await supabase
        .from("user_saves")
        .insert({ user_id: user.id, content_id: contentId });
      if (error) setSaved(false);
    }
  }, [saved, isLoggedIn, user, contentId, navigate, toast]);

  if (!loaded) return null;

  return (
    <button
      onClick={handleClick}
      className={`p-1 rounded-md transition-colors hover:bg-accent ${className ?? ""}`}
      aria-label={saved ? "Unsave" : "Save"}
    >
      <Bookmark
        className={`h-4 w-4 transition-colors ${
          saved ? "fill-primary text-primary" : "text-muted-foreground"
        }`}
      />
    </button>
  );
}
