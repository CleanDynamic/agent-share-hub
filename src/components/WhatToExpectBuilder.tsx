import { useState } from "react";
import {
  Type, ImageIcon, ChevronUp, ChevronDown, Trash2, Plus, ChevronRight, X,
  List, ListOrdered, AlignLeft, ListTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────

export type WteFormattingType = "paragraph" | "bullets" | "numbers" | "sub_list";

export interface WteBlock {
  id: string;
  type: "text" | "image";
  textContent: string;
  formatting: WteFormattingType;
  subBlocks: string[];
  useInstructions: string;
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
}

interface Props {
  blocks: WteBlock[];
  onChange: (blocks: WteBlock[]) => void;
}

let _uid = 0;
const uid = () => `wte_${Date.now()}_${++_uid}`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp";
const DESC_MAX = 300;
const USE_INSTR_MAX = 500;
const MAX_BLOCKS = 3;

export const emptyWteBlock = (type: "text" | "image"): WteBlock => ({
  id: uid(),
  type,
  textContent: "",
  formatting: "paragraph",
  subBlocks: ["", ""],
  useInstructions: "",
  imageFile: null,
  imageDescription: "",
});

// ─── Formatting helpers ─────────────────────────────────────

function stripPrefixes(text: string): string {
  return text.split("\n").map((l) => l.replace(/^(?:•\s?|\d+\.\s?)/, "")).join("\n");
}

function toDisplay(text: string, fmt: WteFormattingType): string {
  if (fmt === "bullets") return text.split("\n").map((l) => `• ${l.replace(/^•\s?/, "")}`).join("\n");
  if (fmt === "numbers") return text.split("\n").map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s?/, "")}`).join("\n");
  return text;
}

// ─── Format bar ─────────────────────────────────────────────

const FORMATS: { value: WteFormattingType; icon: typeof AlignLeft; label: string }[] = [
  { value: "paragraph", icon: AlignLeft, label: "Paragraph" },
  { value: "bullets", icon: List, label: "Bullets" },
  { value: "numbers", icon: ListOrdered, label: "Numbered" },
  { value: "sub_list", icon: ListTree, label: "Sub-list" },
];

const FormatBar = ({ active, onChange }: { active: WteFormattingType; onChange: (f: WteFormattingType) => void }) => (
  <div className="flex gap-1 mb-2">
    {FORMATS.map((f) => {
      const Icon = f.icon;
      const isActive = active === f.value;
      return (
        <button key={f.value} type="button" onClick={() => onChange(f.value)} title={f.label}
          className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted"}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{f.label}</span>
        </button>
      );
    })}
  </div>
);

// ─── Sub-list editor ─────────────────────────────────────────

const SubListEditor = ({ parentText, subBlocks, onParentChange, onSubBlocksChange }: {
  parentText: string; subBlocks: string[]; onParentChange: (v: string) => void; onSubBlocksChange: (v: string[]) => void;
}) => (
  <div className="space-y-2">
    <Input value={parentText} onChange={(e) => onParentChange(e.target.value)} placeholder="Parent item label..." className="bg-background border-border rounded-xl text-sm font-medium" />
    <div className="space-y-1.5 ml-6">
      {subBlocks.map((sub, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4 flex-shrink-0">↳</span>
          <Input value={sub} onChange={(e) => { const n = [...subBlocks]; n[i] = e.target.value; onSubBlocksChange(n); }} placeholder={`Sub-item ${i + 1}...`} className="bg-background border-border rounded-lg text-sm flex-1" maxLength={200} />
          <button type="button" onClick={() => { if (subBlocks.length > 1) onSubBlocksChange(subBlocks.filter((_, idx) => idx !== i)); }} disabled={subBlocks.length <= 1} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onSubBlocksChange([...subBlocks, ""])} className="text-xs text-primary hover:underline ml-6">+ Add sub-item</button>
    </div>
  </div>
);

// ─── Use instructions toggle ────────────────────────────────

const UseInstructionsToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(!!value);
  const handleToggle = () => {
    if (open && value) { if (!confirm("Clear instructions?")) return; onChange(""); }
    setOpen(!open);
  };
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button type="button" onClick={handleToggle} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        Use instructions for this step
      </button>
      {open && (
        <div className="mt-2">
          <Textarea value={value} onChange={(e) => { if (e.target.value.length <= USE_INSTR_MAX) onChange(e.target.value); }} rows={3} placeholder="Optional: tell users how to use this step." maxLength={USE_INSTR_MAX} className="bg-muted/50 border-border rounded-lg text-sm" />
          <span className={`text-xs mt-1 block ${value.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>{value.length} / {USE_INSTR_MAX}</span>
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────

export function WhatToExpectBuilder({ blocks, onChange }: Props) {
  const update = (index: number, patch: Partial<WteBlock>) => {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const deleteBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  const addBlock = (type: "text" | "image") => {
    if (blocks.length >= MAX_BLOCKS) return;
    onChange([...blocks, emptyWteBlock(type)]);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">What to Expect (optional)</Label>
      <p className="text-xs text-muted-foreground -mt-1">Show users what good output looks like before they download.</p>

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={block.id} className="border rounded-xl bg-card overflow-hidden border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {block.type === "text" ? <Type className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                <span>Expected output {index + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => deleteBlock(index)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {block.type === "text" && (
                <>
                  {block.formatting === "sub_list" ? (
                    <>
                      <FormatBar active={block.formatting} onChange={(f) => update(index, { formatting: f })} />
                      <SubListEditor parentText={block.textContent} subBlocks={block.subBlocks} onParentChange={(v) => update(index, { textContent: v })} onSubBlocksChange={(s) => update(index, { subBlocks: s })} />
                    </>
                  ) : (
                    <>
                      <FormatBar active={block.formatting} onChange={(f) => update(index, { formatting: f })} />
                      <textarea
                        value={toDisplay(block.textContent, block.formatting)}
                        onChange={(e) => update(index, { textContent: stripPrefixes(e.target.value) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (block.formatting === "bullets" || block.formatting === "numbers")) {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const pos = ta.selectionStart;
                            const raw = stripPrefixes(ta.value.slice(0, pos) + "\n" + ta.value.slice(pos));
                            update(index, { textContent: raw });
                          }
                        }}
                        rows={4}
                        placeholder={block.formatting === "bullets" ? "• First item\n• Second item..." : block.formatting === "numbers" ? "1. First step\n2. Second step..." : "Describe expected output…"}
                        className="flex min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 leading-relaxed"
                      />
                    </>
                  )}
                </>
              )}

              {block.type === "image" && (
                <div className="space-y-3">
                  {block.imagePreview ? (
                    <div className="space-y-2">
                      <img src={block.imagePreview} alt="Preview" className="max-h-[120px] rounded-lg object-contain" />
                      <label className="text-xs text-primary hover:underline cursor-pointer">
                        Replace image
                        <input type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > MAX_IMAGE_SIZE) { alert("Image must be under 5 MB."); return; }
                          const reader = new FileReader();
                          reader.onload = () => update(index, { imageFile: f, imagePreview: reader.result as string });
                          reader.readAsDataURL(f);
                        }} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
                      <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">.jpg, .png, .webp — max 5 MB</span>
                      <input type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > MAX_IMAGE_SIZE) { alert("Image must be under 5 MB."); return; }
                        const reader = new FileReader();
                        reader.onload = () => update(index, { imageFile: f, imagePreview: reader.result as string });
                        reader.readAsDataURL(f);
                      }} />
                    </label>
                  )}
                  <Input value={block.imageDescription} onChange={(e) => { if (e.target.value.length <= DESC_MAX) update(index, { imageDescription: e.target.value }); }} placeholder="Describe what this image shows" className="bg-background border-border rounded-xl text-sm" maxLength={DESC_MAX} />
                </div>
              )}
            </div>

            {/* Per-block use instructions */}
            <div className="px-4 pb-3">
              <UseInstructionsToggle value={block.useInstructions} onChange={(v) => update(index, { useInstructions: v })} />
            </div>
          </div>
        ))}
      </div>

      {/* Add block buttons */}
      {blocks.length < MAX_BLOCKS && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("text")} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock("image")} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Image
          </Button>
        </div>
      )}
      {blocks.length >= MAX_BLOCKS && (
        <p className="text-xs text-muted-foreground">Maximum 3 blocks for What to Expect.</p>
      )}
    </div>
  );
}
