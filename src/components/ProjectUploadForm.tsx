import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { ContentBlockBuilder, emptyBlock, type ContentBlock } from "@/components/ContentBlockBuilder";
import { WhatToExpectBuilder, emptyWteBlock, type WteBlock } from "@/components/WhatToExpectBuilder";
import { CollabInvitePicker, type CollabInvitee } from "@/components/CollabInvitePicker";
import { DependencyPicker, type Dependency } from "@/components/DependencyPicker";
import { ExistingBlueprintSearch, type ExistingBlueprintItem } from "@/components/ExistingBlueprintSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle2, ChevronUp, ChevronDown, Trash2, Plus,
  ImagePlus, GripVertical, X, Link2Off, ExternalLink,
} from "lucide-react";
import { ORDERED_CONTENT_TYPES, displayContentType } from "@/lib/content-types";

const CONTENT_TYPES = ORDERED_CONTENT_TYPES;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// ─── Types ──────────────────────────────────────────────────

interface BlueprintSlot {
  id: string;
  kind: "inline";
  stepLabel: string;
  title: string;
  contentType: string;
  description: string;
  wteBlocks: WteBlock[];
  blocks: ContentBlock[];
  difficulty: string;
  aiTools: string[];
  otherToolName: string;
  useCases: string[];
  tags: string[];
  tagInput: string;
  monetisationType: "free" | "paid";
  priceGbp: number | undefined;
  collapsed: boolean;
}

interface LinkedBlueprintSlot {
  id: string;
  kind: "linked";
  contentId: string;
  title: string;
  contentType: string;
  description: string | null;
  difficulty: string;
  aiTools: string[] | null;
  otherToolName: string | null;
  monetisationType: string;
  priceGbp: number | null;
  stepLabel: string;
  stepNote: string;
  collapsed: boolean;
}

type AnySlot = BlueprintSlot | LinkedBlueprintSlot;

interface InlineSplit {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  percentage: number;
}

let _slotUid = 0;
const slotUid = () => `slot_${Date.now()}_${++_slotUid}`;

const emptySlot = (): BlueprintSlot => ({
  id: slotUid(),
  kind: "inline",
  stepLabel: "",
  title: "",
  contentType: "",
  description: "",
  wteBlocks: [],
  blocks: [emptyBlock("text")],
  difficulty: "",
  aiTools: [],
  otherToolName: "",
  useCases: [],
  tags: [],
  tagInput: "",
  monetisationType: "free",
  priceGbp: undefined,
  collapsed: false,
});

function computeProjectDifficulty(slots: AnySlot[]): string {
  const diffs = slots.map((s) => s.difficulty).filter(Boolean);
  if (diffs.length === 0) return "—";
  if (diffs.some((d) => d === "Advanced")) return "Advanced";
  if (diffs.every((d) => d === "Beginner")) return "Beginner";
  return "Intermediate";
}

// ─── Upload helper ──────────────────────────────────────────

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

    await supabase.from("content_blocks").insert({
      content_id: contentId,
      position,
      block_type: block.type === "long_text" ? "long_text" : block.type,
      text_content: (block.type === "text" || block.type === "long_text") ? block.textContent : null,
      formatting: (block.type === "text" || block.type === "long_text") ? { type: block.formatting } : null,
      formatting_type: block.formatting || "paragraph",
      file_url: fileUrl,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      image_url: imageUrl,
      image_description: block.type === "image" ? block.imageDescription : null,
      is_preview: block.isPreview ?? false,
      use_instructions: block.useInstructions?.trim() || null,
      sub_blocks: block.formatting === "sub_list" && block.subBlocks?.length > 0 ? block.subBlocks : null,
    } as any);
  }
}

// ─── Inline Blueprint Slot Card ────────────────────────────────────

function BlueprintSlotCard({
  slot,
  index,
  total,
  onChange,
  onMove,
  onDelete,
  aiTools,
}: {
  slot: BlueprintSlot;
  index: number;
  total: number;
  onChange: (patch: Partial<BlueprintSlot>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  aiTools: string[];
}) {
  const sortedTools = [...aiTools].sort((a, b) => {
    if (a === "Any Tool") return -1;
    if (b === "Any Tool") return 1;
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  const isOtherSelected = slot.aiTools.includes("Other");

  if (slot.collapsed) {
    return (
      <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderLeftWidth: 2, borderLeftColor: "#E8571A" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-primary">{index + 1}</span>
            <span className="text-sm text-foreground truncate">{slot.title || slot.stepLabel || "Untitled blueprint"}</span>
            {slot.contentType && <Badge variant="outline" className="text-[10px] shrink-0">{displayContentType(slot.contentType)}</Badge>}
            {slot.difficulty && <Badge variant="outline" className="text-[10px] shrink-0">{slot.difficulty}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => onChange({ collapsed: false })} className="p-1 rounded hover:bg-muted text-muted-foreground text-xs px-2">Expand</button>
            <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderLeftWidth: 2, borderLeftColor: "#E8571A" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <span className="text-sm font-bold" style={{ color: "#E8571A" }}>Blueprint {index + 1}</span>
          <span className="text-[10px] text-muted-foreground">New</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onChange({ collapsed: true })} className="text-xs text-muted-foreground hover:text-foreground px-2">Collapse</button>
          <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* a. Step label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Step label (optional)</Label>
          <Input value={slot.stepLabel} onChange={(e) => onChange({ stepLabel: e.target.value })}
            placeholder="e.g. 'Set up the prompt', 'Connect to Zapier', 'Test your output'"
            className="bg-background border-border rounded-xl text-sm" />
        </div>

        {/* b. Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input value={slot.title} onChange={(e) => onChange({ title: e.target.value })}
            placeholder="E.g. Email Summariser Prompt"
            className="bg-background border-border rounded-xl text-sm" />
        </div>

        {/* c. Content Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Content Type</Label>
          <Select value={slot.contentType} onValueChange={(v) => onChange({ contentType: v })}>
            <SelectTrigger className="bg-background border-border rounded-xl text-sm"><SelectValue placeholder="Select a type" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{displayContentType(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* d. Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description (max 120 chars)</Label>
          <Input value={slot.description} onChange={(e) => { if (e.target.value.length <= 120) onChange({ description: e.target.value }); }}
            placeholder="One-line description..."
            className="bg-background border-border rounded-xl text-sm" maxLength={120} />
          <p className="text-[10px] text-muted-foreground">{slot.description.length}/120</p>
        </div>

        {/* e. What to Expect */}
        <WhatToExpectBuilder blocks={slot.wteBlocks} onChange={(b) => onChange({ wteBlocks: b })} maxBlocks={2}
          label="What to Expect for this step (optional)"
          helper="Preview of what this blueprint produces." />

        {/* f. Blueprint block builder */}
        <ContentBlockBuilder blocks={slot.blocks} onChange={(b) => onChange({ blocks: b })} />

        {/* g. Difficulty */}
        <div className="space-y-1.5">
          <Label className="text-xs">Difficulty</Label>
          <Select value={slot.difficulty} onValueChange={(v) => onChange({ difficulty: v })}>
            <SelectTrigger className="bg-background border-border rounded-xl text-sm"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* h. AI Tools */}
        <div className="space-y-1.5">
          <Label className="text-xs">AI Tools Required</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sortedTools.map((tool) => (
              <label key={tool} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={slot.aiTools.includes(tool)}
                  onCheckedChange={(c) => onChange({ aiTools: c ? [...slot.aiTools, tool] : slot.aiTools.filter((t) => t !== tool) })} />
                <span className="text-xs text-foreground">{tool}</span>
              </label>
            ))}
          </div>
          {isOtherSelected && (
            <Input value={slot.otherToolName} onChange={(e) => onChange({ otherToolName: e.target.value.slice(0, 60) })}
              placeholder="What tool? e.g. 'Notion AI', 'Perplexity'..."
              className="h-9 text-sm bg-background border-border mt-2" maxLength={60} />
          )}
        </div>

        {/* i. Use Case Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs">Use Case Tags</Label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map((uc) => {
              const selected = slot.useCases.includes(uc);
              return (
                <button key={uc} type="button" onClick={() => onChange({ useCases: selected ? slot.useCases.filter((v) => v !== uc) : [...slot.useCases, uc] })}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${selected ? "bg-primary/15 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"}`}>
                  {uc}
                </button>
              );
            })}
          </div>
        </div>

        {/* j. Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tags (optional)</Label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {slot.tags.map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center gap-1">
                #{tag}
                <button type="button" onClick={() => onChange({ tags: slot.tags.filter(t => t !== tag) })}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          {slot.tags.length < 5 && (
            <div className="flex gap-2">
              <Input value={slot.tagInput} onChange={(e) => onChange({ tagInput: e.target.value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && slot.tagInput.trim()) {
                    e.preventDefault();
                    const tag = slot.tagInput.trim().toLowerCase();
                    if (!slot.tags.includes(tag)) onChange({ tags: [...slot.tags, tag], tagInput: "" });
                    else onChange({ tagInput: "" });
                  }
                }}
                placeholder="Type a tag and Enter" className="bg-background border-border rounded-xl text-sm flex-1" />
            </div>
          )}
        </div>

        {/* k. Monetisation */}
        <div className="border border-border rounded-lg p-3 space-y-3">
          <Label className="text-xs font-medium">Monetisation</Label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-foreground">Free</p>
            <Switch checked={slot.monetisationType === "free"} onCheckedChange={(c) => onChange({ monetisationType: c ? "free" : "paid" })} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-foreground">Paid</p>
            <Switch checked={slot.monetisationType === "paid"} onCheckedChange={(c) => onChange({ monetisationType: c ? "paid" : "free" })} />
          </div>
          {slot.monetisationType === "paid" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-medium">£</span>
              <Input type="number" step="0.01" min="1" placeholder="4.99"
                value={slot.priceGbp ?? ""} onChange={(e) => onChange({ priceGbp: e.target.value ? Number(e.target.value) : undefined })}
                className="bg-background border-border rounded-xl w-28 text-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Linked Blueprint Slot Card ─────────────────────────────

function LinkedBlueprintSlotCard({
  slot,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  slot: LinkedBlueprintSlot;
  index: number;
  total: number;
  onChange: (patch: Partial<LinkedBlueprintSlot>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const toolPills = (slot.aiTools ?? []).slice(0, 3).map((t) =>
    t === "Other" && slot.otherToolName ? slot.otherToolName : t
  );

  if (slot.collapsed) {
    return (
      <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderLeftWidth: 2, borderLeftColor: "#2EC4B6" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold" style={{ color: "#2EC4B6" }}>{index + 1}</span>
            <span className="text-sm text-foreground truncate">{slot.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{displayContentType(slot.contentType)}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => onChange({ collapsed: false })} className="p-1 rounded hover:bg-muted text-muted-foreground text-xs px-2">Expand</button>
            <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Link2Off className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ borderLeftWidth: 2, borderLeftColor: "#2EC4B6" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <span className="text-sm font-bold" style={{ color: "#2EC4B6" }}>{index + 1}</span>
          <span className="text-[10px] text-muted-foreground">Existing Blueprint</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => onChange({ collapsed: true })} className="text-xs text-muted-foreground hover:text-foreground px-2">Collapse</button>
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove from project"><Link2Off className="h-4 w-4" /></button>
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Read-only summary */}
        <div className="flex gap-3">
          <div className="h-[60px] w-[60px] rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
            {displayContentType(slot.contentType).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[10px]">{displayContentType(slot.contentType)}</Badge>
              <Badge variant="outline" className="text-[10px]">{slot.difficulty}</Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">{slot.title}</p>
            {slot.description && <p className="text-[13px] text-muted-foreground truncate">{slot.description}</p>}
            {toolPills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {toolPills.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
                ))}
              </div>
            )}
            <a href={`/content/${slot.contentId}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1">
              View post <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-1.5">
          <Label className="text-xs">Step label (optional)</Label>
          <Input value={slot.stepLabel} onChange={(e) => onChange({ stepLabel: e.target.value })}
            placeholder="What does this blueprint do in the project?"
            className="bg-background border-border rounded-xl text-sm" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Step note (optional, max 120 chars)</Label>
          <Input value={slot.stepNote} onChange={(e) => { if (e.target.value.length <= 120) onChange({ stepNote: e.target.value }); }}
            placeholder="Context for readers"
            className="bg-background border-border rounded-xl text-sm" maxLength={120} />
        </div>

        {/* Read-only monetisation */}
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            {slot.monetisationType === "paid" ? (
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">£{Number(slot.priceGbp ?? 0).toFixed(2)}</Badge>
            ) : (
              <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">Free</Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Pricing set on original post — manage there.</p>
        </div>
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
  const [wteBlocks, setWteBlocks] = useState<WteBlock[]>([]);
  const [slots, setSlots] = useState<AnySlot[]>([emptySlot()]);
  const [packageEnabled, setPackageEnabled] = useState(false);
  const [packagePrice, setPackagePrice] = useState<number | undefined>(undefined);
  const [collabInvitees, setCollabInvitees] = useState<CollabInvitee[]>([]);
  const [inlineSplits, setInlineSplits] = useState<InlineSplit[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showExistingSearch, setShowExistingSearch] = useState(false);

  const hasPaidSlots = slots.some((s) => s.kind === "inline" ? s.monetisationType === "paid" : s.monetisationType === "paid");
  const showRevenueSplit = (hasPaidSlots || packageEnabled) && collabInvitees.length > 0;
  const totalSplitPct = inlineSplits.reduce((s, x) => s + (x.percentage || 0), 0);
  const keepPct = 100 - totalSplitPct;
  const splitError = totalSplitPct > 90;

  useEffect(() => {
    setInlineSplits((prev) => {
      const existing = new Map(prev.map((s) => [s.userId, s]));
      return collabInvitees.map((inv) => existing.get(inv.id) ?? {
        userId: inv.id, username: inv.username, displayName: inv.displayName, avatarUrl: inv.avatarUrl, percentage: 10,
      });
    });
  }, [collabInvitees]);

  const individualTotal = slots.reduce((sum, s) => {
    if (s.kind === "inline") return sum + (s.monetisationType === "paid" ? (s.priceGbp ?? 0) : 0);
    return sum + (s.monetisationType === "paid" ? Number(s.priceGbp ?? 0) : 0);
  }, 0);
  const saving = packagePrice ? individualTotal - packagePrice : 0;
  const projectDifficulty = computeProjectDifficulty(slots);

  // IDs of linked content to exclude from search
  const linkedContentIds = slots.filter((s) => s.kind === "linked").map((s) => (s as LinkedBlueprintSlot).contentId);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_SIZE) { toast({ title: "Image too large", description: "Max 5 MB.", variant: "destructive" }); return; }
    setCoverImage(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const updateSlot = (index: number, patch: Partial<AnySlot>) => {
    const next = [...slots];
    next[index] = { ...next[index], ...patch } as AnySlot;
    setSlots(next);
  };

  const moveSlot = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slots.length) return;
    const next = [...slots];
    [next[index], next[target]] = [next[target], next[index]];
    setSlots(next);
  };

  const deleteSlot = (index: number) => {
    if (slots.length <= 1) { toast({ title: "Minimum 1 blueprint", variant: "destructive" }); return; }
    setSlots(slots.filter((_, i) => i !== index));
  };

  const addExistingBlueprint = (item: ExistingBlueprintItem) => {
    const linked: LinkedBlueprintSlot = {
      id: slotUid(),
      kind: "linked",
      contentId: item.id,
      title: item.title,
      contentType: item.content_type,
      description: item.description,
      difficulty: item.difficulty,
      aiTools: item.ai_tools,
      otherToolName: item.other_tool_name,
      monetisationType: item.monetisation_type,
      priceGbp: item.price_gbp,
      stepLabel: "",
      stepNote: "",
      collapsed: false,
    };
    setSlots([...slots, linked]);
    setShowExistingSearch(false);
  };

  // ─── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Description required", variant: "destructive" }); return; }
    if (slots.length === 0) { toast({ title: "Add at least one blueprint", variant: "destructive" }); return; }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.kind === "inline") {
        if (!s.title.trim()) { toast({ title: `Blueprint ${i + 1}: title required`, variant: "destructive" }); return; }
        if (!s.contentType) { toast({ title: `Blueprint ${i + 1}: content type required`, variant: "destructive" }); return; }
        if (!s.difficulty) { toast({ title: `Blueprint ${i + 1}: difficulty required`, variant: "destructive" }); return; }
        if (s.blocks.length === 0) { toast({ title: `Blueprint ${i + 1}: add content blocks`, variant: "destructive" }); return; }
      }
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Sign in required", variant: "destructive" }); setSubmitting(false); return; }

      // Cover image
      let coverUrl: string | null = null;
      if (coverImage) {
        const tempId = crypto.randomUUID();
        const path = `projects/${tempId}/${coverImage.name}`;
        const { error } = await supabase.storage.from("content-files").upload(path, coverImage);
        if (error) throw new Error(`Cover upload failed: ${error.message}`);
        coverUrl = path;
      }

      // WTE blocks jsonb
      const wteJsonb = wteBlocks.length > 0 ? wteBlocks.map((b, i) => ({
        id: b.id, position: i + 1, block_type: b.type,
        text_content: b.textContent || null,
        formatting_type: b.formatting,
        sub_blocks: b.formatting === "sub_list" && b.subBlocks?.length > 0 ? b.subBlocks : null,
        use_instructions: b.useInstructions?.trim() || null,
        image_description: b.type === "image" ? b.imageDescription : null,
      })) : null;

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

      // Process each slot
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const position = i + 1;

        if (slot.kind === "linked") {
          // Link existing content item
          await supabase.from("project_components").insert({
            project_id: project.id,
            position,
            component_type: "linked",
            linked_content_id: slot.contentId,
            show_on_browse: false,
            component_label: slot.stepLabel || null,
            component_note: slot.stepNote || null,
          });
        } else {
          // Create new inline content item
          const slotWteJsonb = slot.wteBlocks.length > 0 ? slot.wteBlocks.map((b, j) => ({
            id: b.id, position: j + 1, block_type: b.type,
            text_content: b.textContent || null, formatting_type: b.formatting,
            sub_blocks: b.formatting === "sub_list" && b.subBlocks?.length > 0 ? b.subBlocks : null,
            use_instructions: b.useInstructions?.trim() || null,
            image_description: b.type === "image" ? b.imageDescription : null,
          })) : null;

          const { data: contentItem, error: ciError } = await supabase
            .from("content_items")
            .insert({
              creator_id: user.id,
              title: slot.title.trim(),
              content_type: slot.contentType,
              description: slot.description.trim() || null,
              difficulty: slot.difficulty,
              ai_tools: slot.aiTools,
              use_cases: slot.useCases,
              tags: slot.tags,
              file_url: null,
              use_instructions: null,
              what_to_expect: null,
              what_to_expect_blocks: slotWteJsonb,
              other_tool_name: slot.aiTools.includes("Other") && slot.otherToolName.trim() ? slot.otherToolName.trim() : null,
              status: "pending",
              monetisation_type: slot.monetisationType,
              price_gbp: slot.monetisationType === "paid" ? slot.priceGbp ?? null : null,
              donation_enabled: false,
            } as any)
            .select("id")
            .single();

          if (ciError || !contentItem) throw new Error(ciError?.message ?? `Blueprint ${position} insert failed`);

          await uploadBlocks(contentItem.id, slot.blocks);

          await supabase.from("project_components").insert({
            project_id: project.id,
            position,
            component_type: "inline",
            inline_content_id: contentItem.id,
            show_on_browse: false,
            component_label: slot.stepLabel || null,
            component_note: slot.description || null,
          });
        }
      }

      // Co-author invites & revenue splits
      for (const inv of collabInvitees) {
        const splitForInv = inlineSplits.find((s) => s.userId === inv.id);
        const { data: inviteData } = await supabase.from("collab_invites").insert({
          content_id: project.id,
          inviter_id: user.id,
          invitee_id: inv.id,
          status: "pending",
        } as any).select("id").single();

        if (showRevenueSplit && splitForInv && splitForInv.percentage > 0) {
          await supabase.from("revenue_splits").insert({
            project_id: project.id,
            recipient_id: splitForInv.userId,
            percentage: splitForInv.percentage,
            set_by: user.id,
          } as any);
        }

        await supabase.from("notifications").insert({
          recipient_id: inv.id,
          notification_type: "collab_invite",
          project_id: project.id,
          actor_id: user.id,
          metadata: { content_title: title, invite_id: inviteData?.id, split_percentage: splitForInv?.percentage ?? null },
        } as any);
      }

      // Dependencies
      for (const dep of dependencies) {
        await supabase.from("content_dependencies").insert({
          content_id: project.id,
          requires_content_id: dep.content_id,
          dependency_note: dep.note || null,
        } as any);
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
          Your project and all its blueprints have been submitted for review. We aim to respond within 48 hours.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => navigate("/browse")}>Browse</Button>
          <Button variant="outline" onClick={() => { setSuccess(false); setTitle(""); setDescription(""); setCoverImage(null); setCoverPreview(null); setSlots([emptySlot()]); setWteBlocks([]); }}>Create Another</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Title */}
      <div className="space-y-1.5">
        <Label>Project Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full Research Pipeline" className="bg-card border-border rounded-xl" />
      </div>

      {/* 2. Cover Image */}
      <div className="space-y-2">
        <Label>Cover image (optional)</Label>
        <p className="text-xs text-muted-foreground">Recommended: 1200×630px.</p>
        {coverPreview ? (
          <div className="relative">
            <img src={coverPreview} alt="Cover" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
            <button type="button" onClick={() => { setCoverImage(null); setCoverPreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">.jpg, .png, .webp — max 5MB</span>
            <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverChange} />
          </label>
        )}
      </div>

      {/* 3. Description */}
      <div className="space-y-1.5">
        <Label>Description (max 120 chars)</Label>
        <Input value={description} onChange={(e) => { if (e.target.value.length <= 120) setDescription(e.target.value); }}
          placeholder="What does this project achieve?"
          className="bg-card border-border rounded-xl" maxLength={120} />
        <p className="text-[10px] text-muted-foreground">{description.length}/120</p>
      </div>

      {/* 4. What to Expect */}
      <WhatToExpectBuilder blocks={wteBlocks} onChange={setWteBlocks} maxBlocks={5}
        label="What to Expect (optional)"
        helper="What does completing this entire project achieve? What is the final result?" />

      {/* 5. Your Blueprints */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Your Blueprints</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Add the blueprints that make up this project. Each blueprint is a step.</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: "#E8571A" }} /> New blueprint
            {" "}
            <span className="inline-block w-2 h-2 rounded-sm mr-1 ml-2" style={{ backgroundColor: "#2EC4B6" }} /> Existing blueprint
          </p>
        </div>

        <div className="space-y-4">
          {slots.map((slot, index) =>
            slot.kind === "linked" ? (
              <LinkedBlueprintSlotCard
                key={slot.id}
                slot={slot}
                index={index}
                total={slots.length}
                onChange={(patch) => updateSlot(index, patch)}
                onMove={(dir) => moveSlot(index, dir)}
                onRemove={() => deleteSlot(index)}
              />
            ) : (
              <BlueprintSlotCard
                key={slot.id}
                slot={slot}
                index={index}
                total={slots.length}
                onChange={(patch) => updateSlot(index, patch)}
                onMove={(dir) => moveSlot(index, dir)}
                onDelete={() => deleteSlot(index)}
                aiTools={AI_TOOLS ?? []}
              />
            )
          )}
        </div>

        {showExistingSearch && (
          <ExistingBlueprintSearch
            excludeIds={linkedContentIds}
            onSelect={addExistingBlueprint}
            onClose={() => setShowExistingSearch(false)}
          />
        )}

        {slots.length < 20 && !showExistingSearch && (
          <div className="flex gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setSlots([...slots, emptySlot()])}
              className="gap-1.5 flex-1 border-secondary text-secondary hover:bg-secondary/10">
              <Plus className="h-3.5 w-3.5" /> New Blueprint
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowExistingSearch(true)}
              className="gap-1.5 flex-1 border-secondary text-secondary hover:bg-secondary/10">
              <Plus className="h-3.5 w-3.5" /> Add Existing Blueprint
            </Button>
          </div>
        )}
        {slots.length >= 20 && <p className="text-xs text-muted-foreground">Maximum 20 blueprints per project.</p>}
      </div>

      {/* 6. Computed difficulty */}
      <p className="text-sm text-muted-foreground">
        Project difficulty: <span className="font-medium text-foreground">{projectDifficulty}</span>
      </p>

      {/* 7. Package pricing */}
      <div className="border border-border rounded-xl p-4 bg-card space-y-3">
        <div>
          <Label className="text-sm font-medium">Offer a full project package price?</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Set a single price that unlocks all paid blueprints.</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">Enable package price</p>
          <Switch checked={packageEnabled} onCheckedChange={setPackageEnabled} />
        </div>
        {packageEnabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-medium">£</span>
              <Input type="number" step="0.01" min="1" placeholder="9.99"
                value={packagePrice ?? ""} onChange={(e) => setPackagePrice(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-background border-border rounded-xl w-32 text-sm" />
            </div>
            {saving > 0 && (
              <p className="text-xs text-emerald-400">Saves users £{saving.toFixed(2)} vs buying individually</p>
            )}
          </div>
        )}
      </div>

      {/* 8. Co-authors */}
      <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />

      {/* Revenue Split */}
      {showRevenueSplit && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground">Split your earnings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Set how your earnings are split. Co-authors can propose a change after accepting.</p>
          </div>
          {inlineSplits.map((split) => (
            <div key={split.userId} className="flex items-center gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                {split.avatarUrl && <AvatarImage src={split.avatarUrl} />}
                <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
                  {(split.displayName || split.username).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground min-w-0 truncate">@{split.username}</span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <Input type="number" min={1} max={89} value={split.percentage}
                  onChange={(e) => setInlineSplits((prev) => prev.map((s) => s.userId === split.userId ? { ...s, percentage: Number(e.target.value) || 0 } : s))}
                  className="w-20 h-8 text-sm bg-background border-border" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          <div className={`text-xs ${splitError ? "text-destructive" : "text-muted-foreground"} pt-2 border-t border-border`}>
            You keep {keepPct}%{inlineSplits.map((s) => <span key={s.userId}> · {s.displayName} gets {s.percentage}%</span>)}
          </div>
          {splitError && <p className="text-xs text-destructive">You must keep at least 10% of your share.</p>}
        </div>
      )}

      {/* 9. Dependencies */}
      <DependencyPicker dependencies={dependencies} onChange={setDependencies} />

      {/* 10. Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={submitting || splitError}>
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting project…</> : "Submit Project for Review"}
      </Button>
    </form>
  );
}
