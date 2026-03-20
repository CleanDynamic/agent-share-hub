import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Eye, User, Calendar, Download, X, Loader2 } from "lucide-react";
import { displayContentType, TYPE_COLORS } from "@/lib/content-types";
import { ContentBlockViewer } from "@/components/ContentBlockViewer";
import { formatDistanceToNow } from "date-fns";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// Inline edit drawer for a section
function EditDrawer({
  open,
  title: drawerTitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed right-0 top-0 bottom-0 w-[300px] bg-card border-l border-border z-40 flex flex-col shadow-2xl animate-in slide-in-from-right">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{drawerTitle}</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

// Hover edit icon
function EditIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent z-10"
    >
      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function ChangedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Changed
    </span>
  );
}

export default function ContentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoggedIn, profile, user, loading: authLoading } = useAuth();

  // State
  const [changeNote, setChangeNote] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerSection, setDrawerSection] = useState<string | null>(null);

  // Editable copies
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [editContentType, setEditContentType] = useState("");
  const [editAiTools, setEditAiTools] = useState<string[]>([]);
  const [editMonetisationType, setEditMonetisationType] = useState("");
  const [editPriceGbp, setEditPriceGbp] = useState<number>(0);
  const [editDonationEnabled, setEditDonationEnabled] = useState(false);

  // Track which sections have been changed
  const [changedSections, setChangedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  // Fetch live content
  const { data: item, isLoading } = useQuery({
    queryKey: ["content_edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name, bio)")
        .eq("id", id!)
        .eq("status", "approved")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!profile?.id,
  });

  const { data: blocks } = useQuery({
    queryKey: ["content_edit_blocks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("content_id", id!)
        .order("position", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  // Initialize editable state from fetched data
  useEffect(() => {
    if (item) {
      setEditTitle(item.title);
      setEditDescription((item as any).description || "");
      setEditCoverUrl((item as any).cover_image_url || "");
      setEditDifficulty(item.difficulty);
      setEditContentType(item.content_type);
      setEditAiTools(item.ai_tools || []);
      setEditMonetisationType(item.monetisation_type);
      setEditPriceGbp(Number(item.price_gbp) || 0);
      setEditDonationEnabled(item.donation_enabled);
    }
  }, [item]);

  // Redirect if not the creator
  useEffect(() => {
    if (item && profile && item.creator_id !== profile.id) {
      navigate("/", { replace: true });
    }
  }, [item, profile, navigate]);

  const markChanged = useCallback((section: string) => {
    setChangedSections((prev) => new Set(prev).add(section));
  }, []);

  const changedFieldsList = useMemo(() => {
    return Array.from(changedSections).map((s) => {
      switch (s) {
        case "title": return "Title & Description";
        case "cover": return "Cover image";
        case "badges": return "Type & Difficulty";
        case "tools": return "AI Tools";
        case "monetisation": return "Monetisation";
        default: return s;
      }
    });
  }, [changedSections]);

  async function handlePostUpdate() {
    if (!changeNote.trim()) return;
    if (!item || !user) return;
    setSubmitting(true);
    try {
      // 1. Build update payload from changed sections
      const updatePayload: Record<string, any> = {};
      if (changedSections.has("title")) {
        updatePayload.title = editTitle;
        updatePayload.description = editDescription;
      }
      if (changedSections.has("cover")) {
        updatePayload.cover_image_url = editCoverUrl;
      }
      if (changedSections.has("badges")) {
        updatePayload.content_type = editContentType;
        updatePayload.difficulty = editDifficulty;
      }
      if (changedSections.has("tools")) {
        updatePayload.ai_tools = editAiTools;
      }
      if (changedSections.has("monetisation")) {
        updatePayload.monetisation_type = editMonetisationType;
        updatePayload.price_gbp = editPriceGbp;
        updatePayload.donation_enabled = editDonationEnabled;
      }
      if (versionLabel.trim()) {
        updatePayload.current_version = versionLabel.trim();
      }

      // Apply content_items updates if any
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from("content_items").update(updatePayload).eq("id", id!);
      }

      // 2. Insert changelog entry
      await supabase.from("content_changelogs").insert({
        content_id: id!,
        change_note: changeNote.trim().slice(0, 140),
        version_label: versionLabel.trim() || null,
        created_by: user.id,
        fields_changed_count: changedSections.size,
      } as any);

      // 3. Fire notification edge function
      supabase.functions.invoke("notify-version-update", {
        body: {
          content_id: id,
          version_number: versionLabel.trim() || item.current_version,
          changelog: changeNote.trim().slice(0, 140),
          content_title: editTitle || item.title,
          creator_id: user.id,
        },
      });

      // 4. Mark library updates
      await supabase
        .from("user_library" as any)
        .update({ has_update: true } as any)
        .eq("content_id", id!);

      // 5. Invalidate queries and navigate
      queryClient.invalidateQueries({ queryKey: ["content_detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content_changelogs", id] });
      
      toast({ title: "Update posted ✓", description: "Library followers have been notified." });
      navigate(`/content/${id}`);
    } catch {
      toast({ title: "Failed to post update", variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (authLoading || isLoading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Content not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  const creator = item.profiles as any;
  const wteBlocks = (item as any).what_to_expect_blocks as any[] | null;

  return (
    <div className="py-0 px-0">
      <SeoHead title="Edit Update — NeoScale AI" description="Edit and post an update." path={`/content/${id}/edit`} noIndex />

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 h-[52px] flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card">
        <button
          onClick={() => navigate(`/content/${id}`)}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back to post
        </button>
        <div className="hidden sm:flex flex-col items-center">
          <span className="text-xs text-muted-foreground">Editing update</span>
          <span className="text-[13px] font-bold text-foreground truncate max-w-[200px]">
            {editTitle || item.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => setDiscardOpen(true)}
          >
            Discard changes
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full text-xs"
            disabled={submitting}
            onClick={() => setPostModalOpen(true)}
          >
            Post Update →
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl py-6 sm:py-10 px-4 sm:px-6">
        {/* Changelog note field — always visible */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6 border-l-2" style={{ borderLeftColor: "hsl(36, 77%, 41%)" }}>
          <p className="text-sm font-semibold text-foreground mb-2">What changed in this update?</p>
          <div className="relative mb-2">
            <Textarea
              placeholder="Describe what you changed..."
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value.slice(0, 140))}
              maxLength={140}
              className="bg-background border-border rounded-lg text-sm min-h-[60px] pr-12"
            />
            <span className="absolute right-3 bottom-2 text-[10px] text-muted-foreground">{changeNote.length}/140</span>
          </div>
          <Input
            placeholder="Version label e.g. v1.2 (optional)"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value.slice(0, 20))}
            maxLength={20}
            className="bg-background border-border rounded-lg w-48 text-xs h-8"
          />
        </div>

        {/* Cover image */}
        {editCoverUrl && (
          <div className="relative group mb-6 rounded-xl overflow-hidden">
            <img src={editCoverUrl} alt="Cover" className="w-full object-cover" style={{ maxHeight: 360 }} />
            {changedSections.has("cover") && (
              <div className="absolute top-2 left-2"><ChangedBadge /></div>
            )}
            <EditIcon onClick={() => setDrawerSection("cover")} />
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 relative group">
          <Badge className={`text-[10px] ${TYPE_COLORS[editContentType] || "bg-muted text-muted-foreground border-border"}`}>
            {displayContentType(editContentType)}
          </Badge>
          <Badge className={`text-[10px] ${difficultyColor(editDifficulty)}`}>
            {editDifficulty}
          </Badge>
          {changedSections.has("badges") && <ChangedBadge />}
          <EditIcon onClick={() => setDrawerSection("badges")} />
        </div>

        {/* Title */}
        <div className="relative group mb-2">
          <h1 className="text-[26px] font-bold text-foreground leading-[1.25]">
            {editTitle}
            {changedSections.has("title") && <span className="ml-2"><ChangedBadge /></span>}
          </h1>
          <EditIcon onClick={() => setDrawerSection("title")} />
        </div>

        {/* Description */}
        {editDescription && (
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">{editDescription}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {((item as any).view_count ?? 0).toLocaleString()} views</span>
          <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {item.download_count.toLocaleString()} downloads</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(item.approved_at ?? item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        {/* What to Expect */}
        {wteBlocks && wteBlocks.length > 0 && (
          <div className="relative group mb-6">
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">What to Expect</h3>
              <div className="space-y-2">
                {wteBlocks.map((wb: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground">{wb.text_content}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Blueprint blocks — shown unblurred */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">Blueprint:</h2>
          {blocks && blocks.length > 0 ? (
            <div className="space-y-3">
              {blocks.map((block: any, i: number) => (
                <div key={block.id} className="relative rounded-xl border border-border bg-card p-4 group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Step {i + 1}</span>
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {block.text_content || (block.file_name && <span className="text-muted-foreground italic">File: {block.file_name}</span>) || <span className="text-muted-foreground italic">Empty block</span>}
                  </div>
                  {block.use_instructions && (
                    <p className="text-xs text-muted-foreground mt-2 italic">💡 {block.use_instructions}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No content blocks.</p>
          )}
        </div>

        {/* Action box preview */}
        <div className="relative group rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Rating & engagement actions (live on published post)</span>
          </div>
          {changedSections.has("monetisation") && (
            <div className="mt-2"><ChangedBadge /></div>
          )}
          <EditIcon onClick={() => setDrawerSection("monetisation")} />
        </div>

        {/* Created By */}
        {creator && (
          <div className="flex items-center gap-3 py-3.5 mb-4 border-t border-b border-border">
            <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden">
              {(creator.display_name || creator.username || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{creator.display_name || creator.username}</p>
              <p className="text-xs text-muted-foreground">@{creator.username}</p>
            </div>
          </div>
        )}

        {/* Works With */}
        {editAiTools.length > 0 && (
          <div className="relative group mb-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Works with
              {changedSections.has("tools") && <span className="ml-2"><ChangedBadge /></span>}
            </h3>
            <div className="flex flex-wrap gap-2">
              {editAiTools.map((tool) => (
                <span key={tool} className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{tool}</span>
              ))}
            </div>
            <EditIcon onClick={() => setDrawerSection("tools")} />
          </div>
        )}
      </div>

      {/* Edit Drawers */}
      <EditDrawer open={drawerSection === "title"} title="Edit Title & Description" onClose={() => setDrawerSection(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-background border-border rounded-lg" maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="bg-background border-border rounded-lg min-h-[80px]" maxLength={500} />
          </div>
          <Button size="sm" className="w-full" onClick={() => { markChanged("title"); setDrawerSection(null); }}>Update</Button>
        </div>
      </EditDrawer>

      <EditDrawer open={drawerSection === "cover"} title="Edit Cover Image" onClose={() => setDrawerSection(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cover image URL</label>
            <Input value={editCoverUrl} onChange={(e) => setEditCoverUrl(e.target.value)} className="bg-background border-border rounded-lg" placeholder="https://..." />
          </div>
          <Button size="sm" className="w-full" onClick={() => { markChanged("cover"); setDrawerSection(null); }}>Update</Button>
        </div>
      </EditDrawer>

      <EditDrawer open={drawerSection === "badges"} title="Edit Type & Difficulty" onClose={() => setDrawerSection(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <Input value={editContentType} onChange={(e) => setEditContentType(e.target.value)} className="bg-background border-border rounded-lg" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Difficulty</label>
            <Input value={editDifficulty} onChange={(e) => setEditDifficulty(e.target.value)} className="bg-background border-border rounded-lg" />
          </div>
          <Button size="sm" className="w-full" onClick={() => { markChanged("badges"); setDrawerSection(null); }}>Update</Button>
        </div>
      </EditDrawer>

      <EditDrawer open={drawerSection === "tools"} title="Edit AI Tools" onClose={() => setDrawerSection(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">AI tools (comma-separated)</label>
            <Input
              value={editAiTools.join(", ")}
              onChange={(e) => setEditAiTools(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              className="bg-background border-border rounded-lg"
            />
          </div>
          <Button size="sm" className="w-full" onClick={() => { markChanged("tools"); setDrawerSection(null); }}>Update</Button>
        </div>
      </EditDrawer>

      <EditDrawer open={drawerSection === "monetisation"} title="Edit Monetisation" onClose={() => setDrawerSection(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <select
              value={editMonetisationType}
              onChange={(e) => setEditMonetisationType(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="donation">Donation</option>
            </select>
          </div>
          {editMonetisationType === "paid" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price (£)</label>
              <Input type="number" min="0" step="0.01" value={editPriceGbp} onChange={(e) => setEditPriceGbp(Number(e.target.value))} className="bg-background border-border rounded-lg" />
            </div>
          )}
          <Button size="sm" className="w-full" onClick={() => { markChanged("monetisation"); setDrawerSection(null); }}>Update</Button>
        </div>
      </EditDrawer>

      {/* Discard changes dialog */}
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard all changes?</AlertDialogTitle>
            <AlertDialogDescription>Any edits you made will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/content/${id}`)}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post Update Modal */}
      <Dialog open={postModalOpen} onOpenChange={setPostModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Post this update</DialogTitle>
            <DialogDescription>Review your changes before posting.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Changes summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Changes in this update:</p>
              {changedFieldsList.length > 0 ? (
                <ul className="space-y-1">
                  {changedFieldsList.map((f) => (
                    <li key={f} className="text-sm text-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">● Changelog note only</p>
              )}
            </div>

            {/* Changelog note preview */}
            <div className="rounded-lg border p-3" style={{ borderColor: "hsl(36, 77%, 41%)", backgroundColor: "hsl(36, 77%, 41%, 0.05)" }}>
              {changeNote.trim() ? (
                <p className="text-sm text-foreground">{changeNote}</p>
              ) : (
                <p className="text-sm text-destructive">Please add a change note before posting.</p>
              )}
            </div>

            {versionLabel.trim() && (
              <p className="text-xs text-muted-foreground">Version: {versionLabel}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setPostModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={!changeNote.trim() || submitting}
                onClick={handlePostUpdate}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm & Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
