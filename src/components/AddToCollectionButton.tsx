import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AddToCollectionModal } from "@/components/AddToCollectionModal";

interface AddToCollectionButtonProps {
  contentId: string;
  contentTitle?: string;
  className?: string;
}

export function AddToCollectionButton({ contentId, contentTitle, className }: AddToCollectionButtonProps) {
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!isLoggedIn) {
      toast({ title: "Sign in to create collections" });
      setTimeout(() => navigate("/signup"), 1000);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`p-1 rounded-md transition-colors hover:bg-accent ${className ?? ""}`}
        aria-label="Add to collection"
        title="Add to collection"
      >
        <LayoutGrid className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
      {open && (
        <AddToCollectionModal
          open={open}
          onOpenChange={setOpen}
          contentId={contentId}
          contentTitle={contentTitle}
        />
      )}
    </>
  );
}
