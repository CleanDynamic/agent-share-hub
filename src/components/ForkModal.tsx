import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ForkModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  originalItem: {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    difficulty: string;
    ai_tools: string[] | null;
    monetisation_type: string;
    price_gbp: number | null;
    use_cases: string[] | null;
    use_instructions: string | null;
    what_to_expect: string | null;
    donation_enabled: boolean;
    creator_id: string;
  };
  originalCreatorUsername: string;
}

export function ForkModal({ open, onOpenChange, originalItem, originalCreatorUsername }: ForkModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(`Fork of ${originalItem.title}`);
  const [submitting, setSubmitting] = useState(false);

  async function handleFork() {
    if (!user || !title.trim()) return;
    setSubmitting(true);

    try {
      // 1. Insert forked content item
      const { data: newItem, error: insertErr } = await supabase
        .from("content_items")
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: originalItem.description,
          content_type: originalItem.content_type,
          difficulty: originalItem.difficulty,
          ai_tools: originalItem.ai_tools ?? [],
          monetisation_type: "free",
          use_cases: originalItem.use_cases ?? [],
          use_instructions: originalItem.use_instructions,
          what_to_expect: originalItem.what_to_expect,
          donation_enabled: false,
          status: "pending",
          current_version: "1.0",
          fork_of_content_id: originalItem.id,
          fork_of_creator_id: originalItem.creator_id,
          download_count: 0,
          view_count: 0,
          avg_rating: 0,
          rating_count: 0,
        })
        .select("id")
        .single();

      if (insertErr || !newItem) throw insertErr || new Error("Failed to create fork");

      // 2. Copy content blocks
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("content_id", originalItem.id)
        .order("position");

      if (blocks && blocks.length > 0) {
        const blockIdMap: Record<string, string> = {};
        for (const block of blocks) {
          const { data: newBlock } = await supabase
            .from("content_blocks")
            .insert({
              content_id: newItem.id,
              block_type: block.block_type,
              position: block.position,
              text_content: block.text_content,
              image_url: block.image_url,
              image_description: block.image_description,
              file_url: block.file_url,
              file_name: block.file_name,
              file_size_bytes: block.file_size_bytes,
              formatting: block.formatting,
            })
            .select("id")
            .single();
          if (newBlock) blockIdMap[block.id] = newBlock.id;
        }

        // 3. Copy block variations
        const blockIds = Object.keys(blockIdMap);
        if (blockIds.length > 0) {
          const { data: variations } = await supabase
            .from("block_variations")
            .select("*")
            .in("block_id", blockIds);
          if (variations && variations.length > 0) {
            const newVariations = variations.map((v) => ({
              block_id: blockIdMap[v.block_id],
              variation_type: v.variation_type,
              variation_label: v.variation_label,
              position: v.position,
              text_content: v.text_content,
              image_url: v.image_url,
              image_description: v.image_description,
              file_url: v.file_url,
              file_name: v.file_name,
              formatting: v.formatting,
            }));
            await supabase.from("block_variations").insert(newVariations);
          }
        }
      }

      // 4. Log interaction
      await supabase.from("user_interactions").insert({
        user_id: user.id,
        content_id: originalItem.id,
        interaction_type: "forked",
        interaction_meta: {
          original_title: originalItem.title,
          original_creator: originalCreatorUsername,
        },
      } as any);

      queryClient.invalidateQueries({ queryKey: ["content_detail", originalItem.id] });
      toast({ title: "Fork created. Find it in My Uploads to edit and publish." });
      onOpenChange(false);
      navigate("/my-uploads");
    } catch (err: any) {
      toast({ title: "Fork failed", description: err.message || "Something went wrong.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-visual-slot="modal-surface"
        style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle>Fork '{originalItem.title}'</DialogTitle>
          <DialogDescription>
            This creates a copy in your drafts. Modify it and publish as your own version.
            The original creator will be credited automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fork-title">New title</Label>
            <Input
              id="fork-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <Button className="w-full" onClick={handleFork} disabled={submitting || !title.trim()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fork it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
