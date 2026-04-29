import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initial: {
    displayName: string;
    customBio: string | null;
    coverUrl: string | null;
    location: string | null;
    website: string | null;
  };
  onSaved?: () => void;
}

export function EditProfileSheet({
  open,
  onOpenChange,
  userId,
  initial,
  onSaved,
}: EditProfileSheetProps) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [customBio, setCustomBio] = useState(initial.customBio ?? "");
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [saving, setSaving] = useState(false);

  // Reset when re-opened with fresh data
  useEffect(() => {
    if (open) {
      setDisplayName(initial.displayName);
      setCustomBio(initial.customBio ?? "");
      setCoverUrl(initial.coverUrl ?? "");
      setLocation(initial.location ?? "");
      setWebsite(initial.website ?? "");
    }
  }, [open, initial]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: customBio.trim() || null,
          banner_url: coverUrl.trim() || null,
          location: location.trim() || null,
          website_url: website.trim() || null,
        } as any)
        .eq("id", userId);
      if (error) throw error;

      toast({ title: "Profile updated" });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Could not save profile",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="ep-name">Display name</Label>
            <Input
              id="ep-name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-bio">Bio</Label>
            <Textarea
              id="ep-bio"
              rows={3}
              value={customBio}
              onChange={e => setCustomBio(e.target.value)}
              maxLength={280}
              placeholder="A short line about yourself"
            />
            <p className="text-xs text-muted-foreground">
              {customBio.length}/280
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-cover">Cover image URL</Label>
            <Input
              id="ep-cover"
              type="url"
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-location">Location</Label>
            <Input
              id="ep-location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ep-website">Website</Label>
            <Input
              id="ep-website"
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
