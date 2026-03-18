import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeoHead } from "@/components/SeoHead";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ContentCard } from "@/components/ContentCard";
import {
  BadgeCheck, Download, FileText, Heart, Users, Loader2, Pencil, Camera, ExternalLink, Library,
} from "lucide-react";
import { TipSelector } from "@/components/TipSelector";

export default function Profile() {
  const { isLoggedIn, profile, loading, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileTab, setProfileTab] = useState<"content" | "library">("content");

  // Edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setWebsiteUrl((profile as any).website_url || "");
      setTwitterHandle((profile as any).twitter_handle || "");
    }
  }, [profile]);

  // Fetch user's approved content
  const { data: contentItems } = useQuery({
    queryKey: ["my_content", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("creator_id", profile!.id)
        .eq("status", "approved")
        .order("download_count", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && profile?.is_creator,
  });

  const totalDownloads = contentItems?.reduce((sum, item) => sum + item.download_count, 0) ?? 0;

  // Library items for the Library tab
  const { data: libraryItems } = useQuery({
    queryKey: ["profile_library", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library")
        .select("id, content_id, added_at, has_update, content_items(*)")
        .eq("user_id", profile!.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile?.id && profileTab === "library",
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl } as any).eq("id", profile.id);
    await refreshProfile();
    setUploading(false);
    toast({ title: "Avatar updated" });
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      website_url: websiteUrl.trim() || null,
      twitter_handle: twitterHandle.trim() || null,
    } as any).eq("id", profile.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      setEditing(false);
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="py-16 px-6 mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = (profile.display_name || profile.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="py-12 px-6">
      <SeoHead title="My Profile — NeoScale AI" description="Your NeoScale AI profile." path="/profile" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="mb-10">
              {/* Avatar + name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  {editing && (
                    <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                      {uploading ? <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" /> : <Camera className="h-3 w-3 text-primary-foreground" />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  {editing ? (
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="text-lg font-bold" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{profile.display_name || profile.username}</h1>
                      {profile.is_creator && (
                        <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
                          <BadgeCheck className="h-3 w-3 mr-1" /> Creator
                        </Badge>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit profile
                  </Button>
                )}
              </div>

              {/* Edit fields */}
              {editing ? (
                <div className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <Label>Bio</Label>
                    <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} rows={3} maxLength={200} />
                    <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Twitter</Label>
                    <Input value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@handle" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed mt-2">{profile.bio}</p>}
                  <div className="flex gap-4 mt-3 flex-wrap">
                    {(profile as any).website_url && (
                      <a href={(profile as any).website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Website
                      </a>
                    )}
                    {(profile as any).twitter_handle && (
                      <span className="text-xs text-muted-foreground">{(profile as any).twitter_handle}</span>
                    )}
                  </div>
                </>
              )}

              {/* Stats */}
              {profile.is_creator && (
                <div className="flex gap-6 mt-6">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{contentItems?.length ?? 0}</span>
                    <span className="text-muted-foreground">published</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{totalDownloads.toLocaleString()}</span>
                    <span className="text-muted-foreground">downloads</span>
                  </div>
                </div>
              )}
            </div>

            {/* Content grid for creators */}
            {profile.is_creator && contentItems && contentItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Your content</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {contentItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      id={item.id}
                      content_type={item.content_type}
                      title={item.title}
                      description={item.description ?? ""}
                      difficulty={item.difficulty}
                      ai_tools={item.ai_tools ?? []}
                      download_count={item.download_count}
                      monetisation_type={item.monetisation_type}
                      price_gbp={item.price_gbp ?? undefined}
                      creator_username={profile.username ?? undefined}
                      avg_rating={Number((item as any).avg_rating) || 0}
                      rating_count={(item as any).rating_count ?? 0}
                      view_count={(item as any).view_count ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
