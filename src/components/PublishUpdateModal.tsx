import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Upload } from "lucide-react";

function suggestNext(current: string): string {
  const parts = current.split(".");
  if (parts.length >= 2) {
    const minor = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(minor)) {
      const copy = [...parts];
      copy[copy.length - 1] = String(minor + 1);
      return copy.join(".");
    }
  }
  return current + ".1";
}

interface PublishUpdateModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contentId: string;
  contentTitle: string;
  currentVersion: string;
  creatorId: string;
}

export function PublishUpdateModal({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  currentVersion,
  creatorId,
}: PublishUpdateModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [version, setVersion] = useState(suggestNext(currentVersion));
  const [changelog, setChangelog] = useState("");
  const [replaceFile, setReplaceFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  const handleOpenChange = useCallback((o: boolean) => {
    if (o) {
      setVersion(suggestNext(currentVersion));
      setChangelog("");
      setReplaceFile(false);
      setFile(null);
    }
    onOpenChange(o);
  }, [currentVersion, onOpenChange]);

  async function handleSubmit() {
    if (!user || !version.trim() || !changelog.trim()) return;
    if (replaceFile && !file) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let newFileUrl: string | undefined;

      if (replaceFile && file) {
        const ext = file.name.split(".").pop() || "txt";
        const filePath = `${user.id}/${contentId}/main.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("content-files")
          .upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("content-files").getPublicUrl(filePath);
        newFileUrl = urlData.publicUrl;
      }

      // Update content_items
      const updatePayload: Record<string, any> = { current_version: version.trim() };
      if (replaceFile) {
        updatePayload.status = "pending";
        if (newFileUrl) updatePayload.file_url = newFileUrl;
      }
      const { error: updateError } = await supabase
        .from("content_items")
        .update(updatePayload as any)
        .eq("id", contentId);
      if (updateError) throw updateError;

      // Insert version record
      await supabase.from("content_versions").insert({
        content_id: contentId,
        version_number: version.trim(),
        changelog: changelog.trim(),
        created_by: user.id,
        blocks_snapshot: null,
      });

      // Notify bookmarkers/downloaders
      await supabase.functions.invoke("notify-version-update", {
        body: {
          content_id: contentId,
          version_number: version.trim(),
          changelog: changelog.trim(),
          content_title: contentTitle,
          creator_id: creatorId,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["my_uploads"] });

      toast({
        title: replaceFile
          ? `Version ${version} submitted for review. The updated file will go live after admin approval.`
          : `Version ${version} published. Followers have been notified.`,
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message || "Something went wrong.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-visual-slot="modal-surface"
        style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle>Publish update</DialogTitle>
          <DialogDescription>Update "{contentTitle}" (currently v{currentVersion})</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version">New version number</Label>
            <Input
              id="version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.1"
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changelog">Changelog</Label>
            <Textarea
              id="changelog"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="What changed? e.g. 'Updated for Claude 3.7', 'Fixed the Zapier trigger'"
              className="bg-background border-border"
            />
            <p className="text-[10px] text-muted-foreground text-right">{changelog.length}/500</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <Label htmlFor="replace-file" className="text-sm cursor-pointer">Replace the main file?</Label>
            <Switch id="replace-file" checked={replaceFile} onCheckedChange={setReplaceFile} />
          </div>

          {replaceFile && (
            <div className="space-y-2">
              <Label>New file</Label>
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">
                  {file ? file.name : "Click to select file"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-[10px] text-muted-foreground">
                File changes require admin re-review before going live.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !version.trim() || !changelog.trim()}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publish update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
