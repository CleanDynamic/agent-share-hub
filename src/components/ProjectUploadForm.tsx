import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { ContentBlockBuilder, emptyBlock, type ContentBlock } from "@/components/ContentBlockBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle2, ChevronUp, ChevronDown, Trash2, Plus,
  ImageIcon, Search, X, ChevronRight, Info,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────

import { ORDERED_CONTENT_TYPES } from "@/lib/content-types";
const CONTENT_TYPES = ORDERED_CONTENT_TYPES;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp";

// ─── Types ──────────────────────────────────────────────────

interface InlineComponent {
  kind: "inline";
  label: string;
  note: string;
  contentType: string;
  difficulty: string;
  aiTools: string[];
  blocks: ContentBlock[];
  monetisationType: "free" | "paid";
  priceGbp: number | undefined;
  showOnBrowse: boolean;
  collapsed: boolean;
}

interface LinkedComponent {
  kind: "linked";
  label: string;
  note: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  monetisationType: string;
}

type ProjectComponent = InlineComponent | LinkedComponent;

// ─── Helpers ────────────────────────────────────────────────

async function uploadBlocks(contentId: string, blocks: ContentBlock[]) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const position = i + 1;
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSizeBytes: number | null = null;
    let imageUrl: string | null = null;

    if (block.type === "file" && block.file) {
      const path = `${contentId}/${position}/${block.file.name}`;
      const { error } = await supabase.storage.from("content-files").upload(path, block.file);
      if (error) throw new Error(`File upload failed: ${error.message}`);
      fileUrl = path;
      fileName = block.file.name;
      fileSizeBytes = block.file.size;
    }
    if (block.type === "image" && block.imageFile) {
      const path = `${contentId}/${position}/${block.imageFile.name}`;
      const { error } = await supabase.storage.from("content-files").upload(path, block.imageFile);
      if (error) throw new Error(`Image upload failed: ${error.message}`);
      imageUrl = path;
    }

    const { data: insertedBlock, error: blockError } = await supabase.from("content_blocks").insert({
      content_id: contentId,
      position,
      block_type: block.type,
      text_content: block.type === "text" ? block.textContent : null,
      formatting: block.type === "text" ? { type: block.formatting } : null,
      file_url: fileUrl,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      image_url: imageUrl,
      image_description: block.type === "image" ? block.imageDescription : null,
    }).select("id").single();

    if (blockError || !insertedBlock) throw new Error(blockError?.message ?? "Block insert failed");

    for (let vi = 0; vi < block.variations.length; vi++) {
      const v = block.variations[vi];
      let vFileUrl: string | null = null;
      let vFileName: string | null = null;
      let vImageUrl: string | null = null;

      if (v.type === "file" && v.file) {
        const path = `${contentId}/variations/${position}-${v.label}/${v.file.name}`;
        const { error } = await supabase.storage.from("content-files").upload(path, v.file);
        if (error) throw new Error(`Variation file upload failed: ${error.message}`);
        vFileUrl = path;
        vFileName = v.file.name;
      }
      if (v.type === "image" && v.imageFile) {
        const path = `${contentId}/variations/${position}-${v.label}/${v.imageFile.name}`;
        const { error } = await supabase.storage.from("content-files").upload(path, v.imageFile);
        if (error) throw new Error(`Variation image upload failed: ${error.message}`);
        vImageUrl = path;
      }

      await supabase.from("block_variations").insert({
        block_id: insertedBlock.id,
        variation_label: v.label,
        variation_type: v.type,
        text_content: v.type === "text" ? v.textContent : null,
        formatting: v.type === "text" ? { type: v.formatting } : null,
        file_url: vFileUrl,
        file_name: vFileName,
        image_url: vImageUrl,
        image_description: v.type === "image" ? v.imageDescription : null,
        position: vi + 1,
      });
    }
  }
}

// ─── Existing post selector ────────────────────────────────

function ExistingPostSelector({
  onSelect,
  onClose,
}: {
  onSelect: (post: { id: string; title: string; content_type: string; monetisation_type: string }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["my_approved_posts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, monetisation_type")
        .eq("creator_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (posts ?? []).filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="border border-border rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Select an existing post</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your posts by title..."
          className="pl-9 bg-background border-border rounded-xl text-sm"
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground">No approved posts found.</p>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <span className="text-sm text-foreground flex-1 truncate">{p.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{p.content_type}</Badge>
            <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{p.monetisation_type}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Inline component form ─────────────────────────────────

function InlineComponentForm({
  comp,
  onChange,
  aiTools,
}: {
  comp: InlineComponent;
  onChange: (patch: Partial<InlineComponent>) => void;
  aiTools: string[];
}) {
  if (comp.collapsed) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-foreground truncate">{comp.label || "Untitled component"}</span>
          {comp.contentType && (
            <Badge variant="outline" className="text-[10px] shrink-0">{comp.contentType}</Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ collapsed: false })}
        >
          Expand
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">New content component</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ collapsed: true })}
          className="text-xs"
        >
          Collapse
        </Button>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs">Component label</Label>
        <Input
          value={comp.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Step 1: The Research Prompt"
          className="bg-background border-border rounded-xl text-sm"
        />
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-xs">Creator's note</Label>
        <Input
          value={comp.note}
          onChange={(e) => {
            if (e.target.value.length <= 200) onChange({ note: e.target.value });
          }}
          placeholder="Explain this component's role in the project"
          maxLength={200}
          className="bg-background border-border rounded-xl text-sm"
        />
        <p className="text-[10px] text-muted-foreground">{comp.note.length}/200</p>
      </div>

      {/* Content type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Content type</Label>
        <Select value={comp.contentType} onValueChange={(v) => onChange({ contentType: v })}>
          <SelectTrigger className="bg-background border-border rounded-xl text-sm">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {CONTENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Difficulty */}
      <div className="space-y-1.5">
        <Label className="text-xs">Difficulty</Label>
        <Select value={comp.difficulty} onValueChange={(v) => onChange({ difficulty: v })}>
          <SelectTrigger className="bg-background border-border rounded-xl text-sm">
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AI Tools */}
      <div className="space-y-1.5">
        <Label className="text-xs">AI Tools</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {aiTools.map((tool) => {
            const checked = comp.aiTools.includes(tool);
            return (
              <label key={tool} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) =>
                    onChange({
                      aiTools: c
                        ? [...comp.aiTools, tool]
                        : comp.aiTools.filter((t) => t !== tool),
                    })
                  }
                />
                <span className="text-xs text-foreground">{tool}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Block builder */}
      <ContentBlockBuilder blocks={comp.blocks} onChange={(b) => onChange({ blocks: b })} />

      {/* Monetisation */}
      <div className="border border-border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground">Free</p>
          </div>
          <Switch
            checked={comp.monetisationType === "free"}
            onCheckedChange={(c) => onChange({ monetisationType: c ? "free" : "paid" })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground">Paid</p>
          </div>
          <Switch
            checked={comp.monetisationType === "paid"}
            onCheckedChange={(c) => onChange({ monetisationType: c ? "paid" : "free" })}
          />
        </div>
        {comp.monetisationType === "paid" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground font-medium">£</span>
            <Input
              type="number"
              step="0.01"
              min="1"
              placeholder="4.99"
              value={comp.priceGbp ?? ""}
              onChange={(e) => onChange({ priceGbp: e.target.value ? Number(e.target.value) : undefined })}
              className="bg-background border-border rounded-xl w-28 text-sm"
            />
          </div>
        )}
      </div>

      {/* Show on browse */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-foreground">Show on Browse page as standalone</p>
          <p className="text-[10px] text-muted-foreground">
            If on, this also appears independently in Browse. If off, it only appears inside this project.
          </p>
        </div>
        <Switch
          checked={comp.showOnBrowse}
          onCheckedChange={(c) => onChange({ showOnBrowse: c })}
        />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────

export function ProjectUploadForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: AI_TOOLS } = useApprovedToolNames();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [components, setComponents] = useState<ProjectComponent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [addMode, setAddMode] = useState<null | "choose" | "existing">(null);
  const [packageEnabled, setPackageEnabled] = useState(false);
  const [packagePrice, setPackagePrice] = useState<number | undefined>(undefined);

  // Cover image handler
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_SIZE) {
      toast({ title: "Image too large", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    setCoverImage(f);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  // Component management
  const addInlineComponent = () => {
    setComponents([
      ...components,
      {
        kind: "inline",
        label: "",
        note: "",
        contentType: "",
        difficulty: "",
        aiTools: [],
        blocks: [emptyBlock("text")],
        monetisationType: "free",
        priceGbp: undefined,
        showOnBrowse: false,
        collapsed: false,
      },
    ]);
    setAddMode(null);
  };

  const addLinkedComponent = (post: {
    id: string;
    title: string;
    content_type: string;
    monetisation_type: string;
  }) => {
    setComponents([
      ...components,
      {
        kind: "linked",
        label: "",
        note: "",
        contentId: post.id,
        contentTitle: post.title,
        contentType: post.content_type,
        monetisationType: post.monetisation_type,
      },
    ]);
    setAddMode(null);
  };

  const updateComponent = (index: number, patch: Partial<ProjectComponent>) => {
    const next = [...components];
    next[index] = { ...next[index], ...patch } as ProjectComponent;
    setComponents(next);
  };

  const moveComponent = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= components.length) return;
    const next = [...components];
    [next[index], next[target]] = [next[target], next[index]];
    setComponents(next);
  };

  const deleteComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Title required", description: "Enter a project title.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Description required", description: "Enter a project description.", variant: "destructive" });
      return;
    }
    if (components.length === 0) {
      toast({ title: "No components", description: "Add at least one component.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // Upload cover image
      let coverUrl: string | null = null;
      if (coverImage) {
        const tempId = crypto.randomUUID();
        const path = `projects/${tempId}/${coverImage.name}`;
        const { error } = await supabase.storage.from("content-files").upload(path, coverImage);
        if (error) throw new Error(`Cover upload failed: ${error.message}`);
        coverUrl = path;
      }

      // Insert project
      const { data: project, error: projError } = await supabase
        .from("projects")
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim(),
          cover_image_url: coverUrl,
          status: "pending",
          package_price_enabled: packageEnabled,
          package_price_gbp: packageEnabled && packagePrice ? packagePrice : null,
        } as any)
        .select("id")
        .single();

      if (projError || !project) throw new Error(projError?.message ?? "Project insert failed");

      // Process each component
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const position = i + 1;

        if (comp.kind === "inline") {
          // Validate inline component
          if (!comp.contentType) throw new Error(`Component ${position}: select a content type`);
          if (!comp.difficulty) throw new Error(`Component ${position}: select difficulty`);
          if (comp.blocks.length === 0) throw new Error(`Component ${position}: add content blocks`);

          // Insert content_items
          const { data: contentItem, error: ciError } = await supabase
            .from("content_items")
            .insert({
              creator_id: user.id,
              title: comp.label || `${title} — Part ${position}`,
              content_type: comp.contentType,
              description: comp.note || null,
              difficulty: comp.difficulty,
              ai_tools: comp.aiTools,
              use_cases: [],
              file_url: null,
              use_instructions: null,
              what_to_expect: null,
              status: "pending",
              monetisation_type: comp.monetisationType,
              price_gbp: comp.monetisationType === "paid" ? comp.priceGbp ?? null : null,
              donation_enabled: false,
            })
            .select("id")
            .single();

          if (ciError || !contentItem) throw new Error(ciError?.message ?? "Content insert failed");

          // Upload blocks
          await uploadBlocks(contentItem.id, comp.blocks);

          // Insert project_component
          await supabase.from("project_components").insert({
            project_id: project.id,
            position,
            component_type: "inline",
            inline_content_id: contentItem.id,
            show_on_browse: comp.showOnBrowse,
            component_label: comp.label || null,
            component_note: comp.note || null,
          });
        } else {
          // Linked
          await supabase.from("project_components").insert({
            project_id: project.id,
            position,
            component_type: "linked",
            linked_content_id: comp.contentId,
            show_on_browse: false,
            component_label: comp.label || null,
            component_note: comp.note || null,
          });
        }
      }

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="py-20 px-6 flex flex-col items-center justify-center text-center gap-4">
        <CheckCircle2 className="h-12 w-12 text-secondary" />
        <h2 className="text-xl font-bold text-foreground">Project Submitted</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your project has been submitted for review. We will review it and all its components within 48 hours.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => navigate("/browse")}>Browse Content</Button>
          <Button variant="outline" onClick={() => { setSuccess(false); setTitle(""); setDescription(""); setCoverImage(null); setCoverPreview(null); setComponents([]); }}>
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-1.5">
        <Label>Project title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Full Research Pipeline"
          className="bg-card border-border rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Project description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What does this project do overall? Write as if explaining to someone who has never used AI."
          className="bg-card border-border rounded-xl"
        />
      </div>

      {/* Cover image */}
      <div className="space-y-1.5">
        <Label>Cover image (optional)</Label>
        {coverPreview ? (
          <div className="space-y-2">
            <img src={coverPreview} alt="Cover" className="max-h-[160px] rounded-xl object-contain" />
            <label className="text-xs text-primary hover:underline cursor-pointer">
              Replace
              <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleCoverChange} className="hidden" />
            </label>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
            <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">.jpg, .png, .webp — max 5 MB</span>
            <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleCoverChange} className="hidden" />
          </label>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#2EC4B6]/10 border border-[#2EC4B6]/20">
        <Info className="h-4 w-4 text-[#2EC4B6] mt-0.5 shrink-0" />
        <p className="text-xs text-[#2EC4B6]">
          Projects are always free to view. You can set individual components as free or paid.
        </p>
      </div>

      {/* Timeline builder */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Project components</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add the pieces of your project in order. Each component can be new content or something you have already posted.
          </p>
        </div>

        {/* Component list */}
        <div className="relative pl-8 space-y-4">
          {components.length > 0 && (
            <div
              className="absolute left-[15px] top-4 bottom-4 w-[2px]"
              style={{ backgroundColor: "#2EC4B6" }}
            />
          )}

          {components.map((comp, index) => (
            <div key={index} className="relative">
              {/* Position circle */}
              <div
                className="absolute -left-8 top-4 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
                style={{ backgroundColor: "#E8571A" }}
              >
                {index + 1}
              </div>

              <div className="border border-border rounded-xl bg-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                  <span className="text-xs text-muted-foreground font-medium">
                    Component {index + 1} — {comp.kind === "inline" ? "New content" : "Linked post"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveComponent(index, -1)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveComponent(index, 1)}
                      disabled={index === components.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComponent(index)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {comp.kind === "inline" ? (
                    <InlineComponentForm
                      comp={comp}
                      onChange={(patch) => updateComponent(index, patch)}
                      aiTools={AI_TOOLS ?? []}
                    />
                  ) : (
                    <div className="space-y-3">
                      {/* Linked summary */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium truncate flex-1">{comp.contentTitle}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{comp.contentType}</Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{comp.monetisationType}</Badge>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Component label</Label>
                        <Input
                          value={comp.label}
                          onChange={(e) => updateComponent(index, { label: e.target.value })}
                          placeholder="e.g. Step 1: The Research Prompt"
                          className="bg-background border-border rounded-xl text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Creator's note</Label>
                        <Input
                          value={comp.note}
                          onChange={(e) => {
                            if (e.target.value.length <= 200) updateComponent(index, { note: e.target.value });
                          }}
                          placeholder="Explain this component's role"
                          maxLength={200}
                          className="bg-background border-border rounded-xl text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add component */}
        {addMode === "existing" ? (
          <ExistingPostSelector
            onSelect={addLinkedComponent}
            onClose={() => setAddMode(null)}
          />
        ) : addMode === "choose" ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addInlineComponent} className="gap-1.5 flex-1">
              <Plus className="h-3.5 w-3.5" />
              Create new content
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddMode("existing")} className="gap-1.5 flex-1">
              <Search className="h-3.5 w-3.5" />
              Use an existing post
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAddMode("choose")} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add component
          </Button>
        )}
      </div>

      {/* Full project pricing */}
      <div className="space-y-3 border border-border rounded-xl p-4 bg-card">
        <div>
          <Label className="text-sm font-medium">Full project pricing (optional)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Offer a single price that unlocks all paid components in this project at once.
            Leave off to keep individual component pricing only.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">Enable full project purchase</p>
          <Switch checked={packageEnabled} onCheckedChange={setPackageEnabled} />
        </div>
        {packageEnabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-medium">£</span>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="9.99"
                value={packagePrice ?? ""}
                onChange={(e) => setPackagePrice(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-background border-border rounded-xl w-32 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Set this lower than the sum of all individual component prices to incentivise the bundle purchase.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Buyers who purchase the full project unlock all current and future paid components in this project automatically.
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting project…
          </>
        ) : (
          "Submit Project for Review"
        )}
      </Button>
    </form>
  );
}
