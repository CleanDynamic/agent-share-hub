import { useState, useCallback } from "react";
import {
  Type, Paperclip, ImageIcon, ChevronUp, ChevronDown, Trash2, Plus,
  List, ListOrdered, AlignLeft, ListTree, FileText, Heading, ChevronRight, X,
  Github, Cloud,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MentionInput } from "@/components/MentionInput";

// ─── Types ───────────────────────────────────────────────────

export type FormattingType = "paragraph" | "bullets" | "numbers" | "sub_list";
export type BlockType =
  | "prompt"
  | "agent_config"
  | "workflow"
  | "model_params"
  | "tool_setup"
  | "code"
  | "result"
  | "comparison"
  | "text"
  | "image"
  | "resource"
  // legacy types kept for backward compatibility
  | "long_text"
  | "file"
  | "github"
  | "large_file";

export interface BlockVariation {
  id: string;
  label: string;
  type: BlockType;
  textContent: string;
  formatting: FormattingType;
  file: File | null;
  fileUrl?: string;
  fileName?: string;
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  textContent: string;
  formatting: FormattingType;
  subBlocks: string[];
  useInstructions: string;
  file: File | null;
  fileName?: string;
  fileSize?: number;
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
  variations: BlockVariation[];
  isPreview: boolean;
  externalFileUrl?: string;
  // GitHub block fields
  githubDescription?: string;
  // Large File block fields
  largeFilePlatform?: string;
  largeFileCustomPlatform?: string;
  largeFileDescription?: string;
  largeFileSizeHint?: string;
  // Comparison block fields
  comparisonA?: string;
  comparisonB?: string;
  // Resource block fields
  resourceDescription?: string;
}

interface Props {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  contentType?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

let _uid = 0;
const uid = () => `blk_${Date.now()}_${++_uid}`;

const ACCEPTED_FILE_TYPES = ".txt,.md,.json,.pdf";
const ACCEPTED_IMAGE_TYPES = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const TEXT_MAX = 500;
const DESC_MAX = 300;
const USE_INSTR_MAX = 500;

const nextLabel = (variations: BlockVariation[]) => {
  const used = new Set(variations.map((v) => v.label));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(66 + i);
    if (!used.has(l)) return l;
  }
  return "Z";
};

const emptyVariation = (label: string, type: BlockType): BlockVariation => ({
  id: uid(),
  label,
  type,
  textContent: "",
  formatting: "paragraph",
  file: null,
  imageFile: null,
  imageDescription: "",
});

export const emptyBlock = (type: BlockType): ContentBlock => ({
  id: uid(),
  type,
  textContent: "",
  formatting: "paragraph",
  subBlocks: ["", ""],
  useInstructions: "",
  file: null,
  imageFile: null,
  imageDescription: "",
  variations: [],
  isPreview: false,
  externalFileUrl: "",
  githubDescription: "",
  largeFilePlatform: "",
  largeFileCustomPlatform: "",
  largeFileDescription: "",
  largeFileSizeHint: "",
  comparisonA: "",
  comparisonB: "",
  resourceDescription: "",
});

// ─── Formatting helpers ─────────────────────────────────────

function stripPrefixes(text: string): string {
  return text.split("\n").map((line) => line.replace(/^(?:•\s?|\d+\.\s?)/, "")).join("\n");
}

function addBulletPrefixes(text: string): string {
  if (!text) return "";
  return text.split("\n").map((line) => `• ${line.replace(/^•\s?/, "")}`).join("\n");
}

function addNumberPrefixes(text: string): string {
  if (!text) return "";
  return text.split("\n").map((line, i) => `${i + 1}. ${line.replace(/^\d+\.\s?/, "")}`).join("\n");
}

function toDisplay(text: string, fmt: FormattingType): string {
  if (fmt === "bullets") return addBulletPrefixes(text);
  if (fmt === "numbers") return addNumberPrefixes(text);
  return text;
}

// ─── Formatting toggle bar ──────────────────────────────────

const FORMATS: { value: FormattingType; icon: typeof AlignLeft; label: string }[] = [
  { value: "paragraph", icon: AlignLeft, label: "Paragraph" },
  { value: "bullets", icon: List, label: "Bullets" },
  { value: "numbers", icon: ListOrdered, label: "Numbered" },
  { value: "sub_list", icon: ListTree, label: "Sub-list" },
];

const FormatBar = ({
  active, onChange, showHeading = false,
}: {
  active: FormattingType; onChange: (f: FormattingType) => void; showHeading?: boolean;
}) => (
  <div className="flex gap-1 mb-1.5">
    {FORMATS.map((f) => {
      const Icon = f.icon;
      const isActive = active === f.value;
      return (
        <button key={f.value} type="button" onClick={() => onChange(f.value)} title={f.label}
          className={`h-7 px-2 rounded-md text-xs flex items-center gap-1 transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted"}`}>
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{f.label}</span>
        </button>
      );
    })}
    {showHeading && (
      <button type="button" onClick={() => onChange("paragraph")} title="Use # at the start of a line for headings"
        className="h-7 px-2 rounded-md text-xs flex items-center gap-1 text-muted-foreground hover:bg-muted">
        <Heading className="h-3 w-3" />
        <span className="hidden sm:inline">Heading (# prefix)</span>
      </button>
    )}
  </div>
);

// ─── Sub-list editor ─────────────────────────────────────────

const SubListEditor = ({
  parentText, subBlocks, onParentChange, onSubBlocksChange,
}: {
  parentText: string; subBlocks: string[]; onParentChange: (v: string) => void; onSubBlocksChange: (v: string[]) => void;
}) => {
  const updateSub = (i: number, val: string) => { const next = [...subBlocks]; next[i] = val; onSubBlocksChange(next); };
  const addSub = () => onSubBlocksChange([...subBlocks, ""]);
  const removeSub = (i: number) => { if (subBlocks.length <= 1) return; onSubBlocksChange(subBlocks.filter((_, idx) => idx !== i)); };

  return (
    <div className="space-y-2">
      <Input value={parentText} onChange={(e) => onParentChange(e.target.value)} placeholder="Parent item label..." className="bg-background border-border rounded-xl text-sm font-medium" maxLength={TEXT_MAX} />
      <div className="space-y-1.5 ml-6">
        {subBlocks.map((sub, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-4 flex-shrink-0">↳</span>
            <Input value={sub} onChange={(e) => updateSub(i, e.target.value)} placeholder={`Sub-item ${i + 1}...`} className="bg-background border-border rounded-lg text-sm flex-1" maxLength={200} />
            <button type="button" onClick={() => removeSub(i)} disabled={subBlocks.length <= 1} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button type="button" onClick={addSub} className="text-xs text-primary hover:underline ml-6">+ Add sub-item</button>
      </div>
    </div>
  );
};

// ─── Text editor ─────────────────────────────────────────────

const TextEditor = ({
  value, formatting, subBlocks, onTextChange, onFormatChange, onSubBlocksChange,
}: {
  value: string; formatting: FormattingType; subBlocks: string[];
  onTextChange: (v: string) => void; onFormatChange: (f: FormattingType) => void; onSubBlocksChange: (v: string[]) => void;
}) => {
  const displayValue = toDisplay(value, formatting);
  const len = value.length;
  const atLimit = len >= TEXT_MAX;

  const handleDisplayChange = (raw: string) => {
    const stripped = stripPrefixes(raw);
    if (stripped.length <= TEXT_MAX) onTextChange(stripped);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (formatting === "bullets" || formatting === "numbers")) {
      e.preventDefault();
      const ta = e.currentTarget;
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const after = ta.value.slice(pos);
      const newRaw = before + "\n" + after;
      const stripped = stripPrefixes(newRaw);
      if (stripped.length <= TEXT_MAX) {
        onTextChange(stripped);
        setTimeout(() => {
          const newDisplay = toDisplay(stripped, formatting);
          const newLines = before.split("\n").length;
          let cursorPos = 0;
          const lines = newDisplay.split("\n");
          for (let i = 0; i < newLines && i < lines.length; i++) cursorPos += lines[i].length + 1;
          ta.setSelectionRange(cursorPos, cursorPos);
        }, 0);
      }
    }
  };

  const placeholder = formatting === "bullets" ? "• First item\n• Second item..." : formatting === "numbers" ? "1. First step\n2. Second step..." : "Enter your content…";

  return (
    <div>
      <FormatBar active={formatting} onChange={onFormatChange} />
      {formatting === "sub_list" ? (
        <SubListEditor parentText={value} subBlocks={subBlocks} onParentChange={onTextChange} onSubBlocksChange={onSubBlocksChange} />
      ) : (
        <>
          <textarea value={displayValue} onChange={(e) => handleDisplayChange(e.target.value)} onKeyDown={handleKeyDown} rows={4} placeholder={placeholder} maxLength={TEXT_MAX + 200}
            className="flex min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed" />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${len >= 450 ? "text-destructive" : "text-muted-foreground"}`}>{len} / {TEXT_MAX}</span>
          </div>
          {atLimit && <p className="text-xs text-amber-600 mt-1">Limit reached. Add another text block to continue, or upload a file for longer content.</p>}
        </>
      )}
    </div>
  );
};

// ─── File picker ─────────────────────────────────────────────

const FilePicker = ({ file, fileName, fileSize, onFileChange }: {
  file: File | null; fileName?: string; fileSize?: number; onFileChange: (f: File | null) => void;
}) => {
  const displayName = file?.name ?? fileName;
  const displaySize = file?.size ?? fileSize;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_FILE_SIZE) { alert("File must be under 10 MB."); return; }
    onFileChange(f);
  };
  return (
    <div>
      {displayName ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{displayName}</p>
            {displaySize != null && <p className="text-xs text-muted-foreground">{(displaySize / 1024).toFixed(1)} KB</p>}
          </div>
          <label className="text-xs text-primary hover:underline cursor-pointer">Replace<input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleChange} className="hidden" /></label>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
          <Paperclip className="h-5 w-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">.txt, .md, .json, .pdf — max 10 MB</span>
          <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleChange} className="hidden" />
        </label>
      )}
    </div>
  );
};

// ─── Image picker ────────────────────────────────────────────

const ImagePicker = ({ imageFile, imagePreview, imageDescription, onImageChange, onDescriptionChange }: {
  imageFile: File | null; imagePreview?: string; imageDescription: string;
  onImageChange: (f: File | null, preview?: string) => void; onDescriptionChange: (v: string) => void;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_IMAGE_SIZE) { alert("Image must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => onImageChange(f, reader.result as string);
    reader.readAsDataURL(f);
  };
  return (
    <div className="space-y-3">
      {imagePreview ? (
        <div className="space-y-2">
          <img src={imagePreview} alt="Preview" className="max-h-[120px] rounded-lg object-contain" />
          <label className="text-xs text-primary hover:underline cursor-pointer">Replace image<input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleChange} className="hidden" /></label>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
          <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">.jpg, .png, .webp — max 5 MB</span>
          <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleChange} className="hidden" />
        </label>
      )}
      <Input value={imageDescription} onChange={(e) => { if (e.target.value.length <= DESC_MAX) onDescriptionChange(e.target.value); }} placeholder="Describe what this image shows" className="bg-background border-border rounded-xl text-sm" maxLength={DESC_MAX} />
      <span className="text-xs text-muted-foreground">{imageDescription.length} / {DESC_MAX}</span>
    </div>
  );
};

// ─── GitHub block editor ─────────────────────────────────────

const GitHubBlockEditor = ({ textContent, githubDescription, onUrlChange, onDescChange }: {
  textContent: string; githubDescription: string;
  onUrlChange: (v: string) => void; onDescChange: (v: string) => void;
}) => {
  const isValid = !textContent || textContent.startsWith("https://github.com/");
  const showDesc = textContent && isValid;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[13px] text-muted-foreground">Repository URL</Label>
        <Input
          value={textContent}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://github.com/username/repository"
          className="bg-background border-border rounded-lg text-sm mt-1"
        />
        {textContent && !isValid && (
          <p className="text-xs text-destructive mt-1">Must start with https://github.com/</p>
        )}
      </div>
      {showDesc && (
        <div>
          <Label className="text-[13px] text-muted-foreground">What's in this repo?</Label>
          <Input
            value={githubDescription}
            onChange={(e) => { if (e.target.value.length <= 100) onDescChange(e.target.value); }}
            placeholder="e.g. The full Zapier automation JSON files"
            className="bg-background border-border rounded-lg text-sm mt-1"
            maxLength={100}
          />
        </div>
      )}
    </div>
  );
};

// ─── Large File block editor ─────────────────────────────────

const HOSTING_PLATFORMS = ["Google Drive", "Dropbox", "Mega", "OneDrive", "WeTransfer", "Other"];

const PLATFORM_PLACEHOLDERS: Record<string, string> = {
  "Google Drive": "https://drive.google.com/file/d/...",
  "Dropbox": "https://www.dropbox.com/s/...",
  "Mega": "https://mega.nz/file/...",
  "OneDrive": "https://1drv.ms/...",
  "WeTransfer": "https://wetransfer.com/downloads/...",
  "Other": "https://...",
};

const LargeFileBlockEditor = ({
  textContent, platform, customPlatform, description, sizeHint,
  onUrlChange, onPlatformChange, onCustomPlatformChange, onDescChange, onSizeHintChange,
}: {
  textContent: string; platform: string; customPlatform: string; description: string; sizeHint: string;
  onUrlChange: (v: string) => void; onPlatformChange: (v: string) => void;
  onCustomPlatformChange: (v: string) => void; onDescChange: (v: string) => void; onSizeHintChange: (v: string) => void;
}) => {
  const isValidUrl = !textContent || textContent.startsWith("https://");

  return (
    <div className="space-y-4">
      {/* Platform selection */}
      <div>
        <Label className="text-[13px] text-muted-foreground">Where is the file hosted?</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {HOSTING_PLATFORMS.map((p) => (
            <button
              key={p} type="button"
              onClick={() => onPlatformChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                platform === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {platform === "Other" && (
          <Input
            value={customPlatform}
            onChange={(e) => { if (e.target.value.length <= 30) onCustomPlatformChange(e.target.value); }}
            placeholder="Platform name..."
            className="bg-background border-border rounded-lg text-sm mt-2"
            maxLength={30}
          />
        )}
      </div>

      {/* File URL */}
      <div>
        <Label className="text-[13px] text-muted-foreground">Direct link to the file</Label>
        <Input
          value={textContent}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={PLATFORM_PLACEHOLDERS[platform] || "https://..."}
          className="bg-background border-border rounded-lg text-sm mt-1"
        />
        {textContent && !isValidUrl && (
          <p className="text-xs text-destructive mt-1">Must start with https://</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label className="text-[13px] text-muted-foreground">What is this file?</Label>
        <Input
          value={description}
          onChange={(e) => { if (e.target.value.length <= 120) onDescChange(e.target.value); }}
          placeholder="e.g. The complete n8n workflow JSON — 2.3MB"
          className="bg-background border-border rounded-lg text-sm mt-1"
          maxLength={120}
        />
      </div>

      {/* Size hint */}
      <div>
        <Label className="text-[13px] text-muted-foreground">Approximate file size</Label>
        <Input
          value={sizeHint}
          onChange={(e) => { if (e.target.value.length <= 20) onSizeHintChange(e.target.value); }}
          placeholder="e.g. 4.2MB, ~50MB"
          className="bg-background border-border rounded-lg text-sm mt-1 max-w-[200px]"
          maxLength={20}
        />
      </div>
    </div>
  );
};

// ─── Block type options ──────────────────────────────────────

const BLOCK_TYPE_OPTIONS = [
  { value: "prompt",       label: "Prompt",      icon: "💬" },
  { value: "agent_config", label: "Agent Config", icon: "🤖" },
  { value: "workflow",     label: "Workflow",     icon: "🔄" },
  { value: "model_params", label: "Model Params", icon: "⚙️" },
  { value: "tool_setup",   label: "Tool Setup",   icon: "🔧" },
  { value: "code",         label: "Code",         icon: "{ }" },
  { value: "result",       label: "Result",       icon: "📊" },
  { value: "comparison",   label: "Comparison",   icon: "↔" },
  { value: "text",         label: "Text",         icon: "¶" },
  { value: "image",        label: "Image",        icon: "🖼" },
  { value: "resource",     label: "Resource",     icon: "🔗" },
] as const;

// ─── Monospace editor (prompt / agent_config / code / model_params) ──

const MonospaceEditor = ({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) => {
  const handleCopy = () => { navigator.clipboard.writeText(value); };
  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder ?? "Enter content…"}
        style={{ fontFamily: "'Courier New', monospace", fontSize: 12 }}
        className="flex min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 leading-relaxed resize-y"
      />
      <button
        type="button"
        onClick={handleCopy}
        style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 10, padding: "2px 8px", borderRadius: 6,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.60)", cursor: "pointer",
        }}
      >
        Copy
      </button>
    </div>
  );
};

// ─── Comparison editor ────────────────────────────────────────

const ComparisonEditor = ({
  valueA, valueB, onChangeA, onChangeB,
}: {
  valueA: string; valueB: string; onChangeA: (v: string) => void; onChangeB: (v: string) => void;
}) => (
  <div className="flex gap-3">
    <div className="flex-1">
      <Label className="text-[11px] text-muted-foreground mb-1 block">A</Label>
      <textarea
        value={valueA}
        onChange={(e) => onChangeA(e.target.value)}
        rows={5}
        placeholder="Version A…"
        className="flex min-h-[100px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed resize-y"
      />
    </div>
    <div className="flex-1">
      <Label className="text-[11px] text-muted-foreground mb-1 block">B</Label>
      <textarea
        value={valueB}
        onChange={(e) => onChangeB(e.target.value)}
        rows={5}
        placeholder="Version B…"
        className="flex min-h-[100px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring leading-relaxed resize-y"
      />
    </div>
  </div>
);

// ─── Resource editor ──────────────────────────────────────────

const ResourceEditor = ({
  url, description, onUrlChange, onDescChange,
}: {
  url: string; description: string; onUrlChange: (v: string) => void; onDescChange: (v: string) => void;
}) => (
  <div className="space-y-3">
    <div>
      <Label className="text-[13px] text-muted-foreground">URL</Label>
      <Input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="https://…"
        className="bg-background border-border rounded-lg text-sm mt-1"
      />
    </div>
    <div>
      <Label className="text-[13px] text-muted-foreground">Description (optional)</Label>
      <Input
        value={description}
        onChange={(e) => { if (e.target.value.length <= 200) onDescChange(e.target.value); }}
        placeholder="What is this resource?"
        className="bg-background border-border rounded-lg text-sm mt-1"
        maxLength={200}
      />
    </div>
  </div>
);

// ─── Block type icon ─────────────────────────────────────────

const BlockTypeIcon = ({ type }: { type: BlockType }) => {
  const opt = BLOCK_TYPE_OPTIONS.find((o) => o.value === type);
  if (opt) return <span style={{ fontSize: 13 }}>{opt.icon}</span>;
  if (type === "long_text") return <FileText className="h-4 w-4" />;
  if (type === "file") return <Paperclip className="h-4 w-4" />;
  if (type === "github") return <Github className="h-4 w-4" />;
  if (type === "large_file") return <Cloud className="h-4 w-4" />;
  return <Type className="h-4 w-4" />;
};

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  prompt: "Prompt",
  agent_config: "Agent Config",
  workflow: "Workflow",
  model_params: "Model Params",
  tool_setup: "Tool Setup",
  code: "Code",
  result: "Result",
  comparison: "Comparison",
  text: "Text",
  image: "Image",
  resource: "Resource",
  // legacy
  long_text: "Article",
  file: "File",
  github: "GitHub",
  large_file: "Large File",
};

// ─── Per-block use instructions toggle ──────────────────────

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
        Instructions
      </button>
      {open && (
        <div className="mt-2">
          <Textarea value={value} onChange={(e) => { if (e.target.value.length <= USE_INSTR_MAX) onChange(e.target.value); }} rows={3} placeholder="Optional: tell users how to use this step. e.g. 'Copy everything below and paste into ChatGPT'" maxLength={USE_INSTR_MAX} className="bg-muted/50 border-border rounded-lg text-sm" />
          <span className={`text-xs mt-1 block ${value.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>{value.length} / {USE_INSTR_MAX}</span>
        </div>
      )}
    </div>
  );
};

// ─── Variation renderer ─────────────────────────────────────

const VariationEditor = ({ variation, onUpdate }: { variation: BlockVariation; onUpdate: (v: Partial<BlockVariation>) => void }) => {
  if (variation.type === "text") {
    return <TextEditor value={variation.textContent} formatting={variation.formatting} subBlocks={[]} onTextChange={(v) => onUpdate({ textContent: v })} onFormatChange={(f) => onUpdate({ formatting: f })} onSubBlocksChange={() => {}} />;
  }
  if (variation.type === "file") {
    return <FilePicker file={variation.file} fileName={variation.fileName} onFileChange={(f) => onUpdate({ file: f, fileName: f?.name })} />;
  }
  return <ImagePicker imageFile={variation.imageFile} imagePreview={variation.imagePreview} imageDescription={variation.imageDescription} onImageChange={(f, preview) => onUpdate({ imageFile: f, imagePreview: preview })} onDescriptionChange={(v) => onUpdate({ imageDescription: v })} />;
};

// ─── External file URL section ──────────────────────────────

const ExternalFileSection = ({ externalFileUrl, onChange }: { externalFileUrl: string; onChange: (url: string) => void }) => {
  const [open, setOpen] = useState(!!externalFileUrl);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? "▲ Hide external link" : "File too large? Link to an external host instead ↓"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <Label className="text-xs">File download URL</Label>
          <Input value={externalFileUrl} onChange={(e) => onChange(e.target.value)} placeholder="https://drive.google.com/... or https://dropbox.com/..." className="bg-background border-border rounded-xl text-sm" />
          <p className="text-[10px] text-muted-foreground">Google Drive, Dropbox, Mega, OneDrive, WeTransfer etc. Link must be directly accessible.</p>
        </div>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────

export function ContentBlockBuilder({ blocks, onChange, contentType }: Props) {
  const [activeVariationTab, setActiveVariationTab] = useState<Record<string, string>>({});

  const update = useCallback(
    (index: number, patch: Partial<ContentBlock>) => {
      const next = [...blocks];
      next[index] = { ...next[index], ...patch };
      onChange(next);
    },
    [blocks, onChange]
  );

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const deleteBlock = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  const addBlock = (type: BlockType) => onChange([...blocks, emptyBlock(type)]);

  const addVariation = (blockIndex: number) => {
    const block = blocks[blockIndex];
    const label = nextLabel(block.variations);
    const next = [...blocks];
    next[blockIndex] = { ...block, variations: [...block.variations, emptyVariation(label, block.type)] };
    onChange(next);
    setActiveVariationTab((prev) => ({ ...prev, [block.id]: label }));
  };

  const updateVariation = (blockIndex: number, varId: string, patch: Partial<BlockVariation>) => {
    const next = [...blocks];
    const block = { ...next[blockIndex] };
    block.variations = block.variations.map((v) => (v.id === varId ? { ...v, ...patch } : v));
    next[blockIndex] = block;
    onChange(next);
  };

  const deleteVariation = (blockIndex: number, varId: string) => {
    const next = [...blocks];
    const block = { ...next[blockIndex] };
    block.variations = block.variations.filter((v) => v.id !== varId);
    next[blockIndex] = block;
    onChange(next);
    const activeTab = activeVariationTab[block.id];
    if (activeTab) {
      const removed = blocks[blockIndex].variations.find((v) => v.id === varId);
      if (removed && removed.label === activeTab) setActiveVariationTab((prev) => ({ ...prev, [block.id]: "A" }));
    }
  };

  // Determine if block type supports preview toggle & variations
  const supportsPreview = (type: BlockType) => type !== "github";
  const supportsVariations = (type: BlockType) => type !== "github" && type !== "large_file";

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{contentType === "Blog" ? "Your Blog Post" : "Your Blueprint"}</Label>
      {contentType === "Blog" && (
        <p className="text-xs text-muted-foreground -mt-0.5">Write your blog post using text, image, and file blocks.</p>
      )}

      {/* Block list */}
      <div className="space-y-2">
        {blocks.map((block, index) => {
          const hasVariations = block.variations.length > 0;
          const activeTab = activeVariationTab[block.id] ?? "A";
          const showingMain = activeTab === "A";

          return (
            <div key={block.id} className={`border rounded-xl bg-card overflow-hidden ${block.isPreview ? "border-[#2EC4B6]/50" : "border-border"}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BlockTypeIcon type={block.type} />
                  <span>{BLOCK_TYPE_LABELS[block.type]}</span>
                  <span className="text-xs text-muted-foreground">Block {index + 1}</span>
                  {block.isPreview && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2EC4B6]/15 text-[#2EC4B6] font-medium">Preview</span>}
                </div>
                <div className="flex items-center gap-2">
                  {contentType !== "Blog" && supportsPreview(block.type) && (() => {
                    const previewCount = blocks.filter((b) => b.isPreview).length;
                    const canToggle = block.isPreview || previewCount < 2;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Preview</span>
                            <Switch checked={block.isPreview} disabled={!canToggle} onCheckedChange={(checked) => update(index, { isPreview: checked })} className="scale-75" />
                          </div>
                        </TooltipTrigger>
                        {!canToggle && <TooltipContent>Maximum 2 preview blocks</TooltipContent>}
                      </Tooltip>
                    );
                  })()}
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => deleteBlock(index)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Variation tabs */}
              {hasVariations && (
                <div className="flex gap-1 px-4 pt-3">
                  <button type="button" onClick={() => setActiveVariationTab((p) => ({ ...p, [block.id]: "A" }))}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${showingMain ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>A</button>
                  {block.variations.map((v) => (
                    <div key={v.id} className="flex items-center gap-0.5">
                      <button type="button" onClick={() => setActiveVariationTab((p) => ({ ...p, [block.id]: v.label }))}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${activeTab === v.label ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}>{v.label}</button>
                      <button type="button" onClick={() => deleteVariation(index, v.id)} className="text-muted-foreground hover:text-destructive p-0.5" title={`Delete variation ${v.label}`}><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Content area */}
              <div className="p-3">
                {/* Block type subheading */}
                {BLOCK_TYPE_OPTIONS.find((o) => o.value === block.type) && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(255,255,255,0.30)",
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    {BLOCK_TYPE_OPTIONS.find((o) => o.value === block.type)?.icon}
                    {" "}
                    {BLOCK_TYPE_OPTIONS.find((o) => o.value === block.type)?.label}
                  </div>
                )}
                {showingMain ? (
                  <>
                    {(block.type === "prompt" || block.type === "agent_config" || block.type === "code" || block.type === "model_params") && (
                      <MonospaceEditor
                        value={block.textContent}
                        onChange={(v) => update(index, { textContent: v })}
                        placeholder={
                          block.type === "prompt" ? "Enter your prompt…" :
                          block.type === "agent_config" ? "Paste agent configuration JSON / YAML…" :
                          block.type === "code" ? "Paste code snippet…" :
                          "Enter model parameter settings…"
                        }
                      />
                    )}
                    {(block.type === "workflow" || block.type === "tool_setup" || block.type === "result") && (
                      <TextEditor value={block.textContent} formatting={block.formatting} subBlocks={block.subBlocks}
                        onTextChange={(v) => update(index, { textContent: v })} onFormatChange={(f) => update(index, { formatting: f })} onSubBlocksChange={(s) => update(index, { subBlocks: s })} />
                    )}
                    {block.type === "comparison" && (
                      <ComparisonEditor
                        valueA={block.comparisonA ?? ""}
                        valueB={block.comparisonB ?? ""}
                        onChangeA={(v) => update(index, { comparisonA: v })}
                        onChangeB={(v) => update(index, { comparisonB: v })}
                      />
                    )}
                    {block.type === "resource" && (
                      <ResourceEditor
                        url={block.textContent}
                        description={block.resourceDescription ?? ""}
                        onUrlChange={(v) => update(index, { textContent: v })}
                        onDescChange={(v) => update(index, { resourceDescription: v })}
                      />
                    )}
                    {block.type === "text" && (
                      <TextEditor value={block.textContent} formatting={block.formatting} subBlocks={block.subBlocks}
                        onTextChange={(v) => update(index, { textContent: v })} onFormatChange={(f) => update(index, { formatting: f })} onSubBlocksChange={(s) => update(index, { subBlocks: s })} />
                    )}
                    {block.type === "long_text" && (
                      <div>
                        <FormatBar active={block.formatting} onChange={(f) => update(index, { formatting: f })} showHeading />
                        <MentionInput value={block.textContent} onChange={(v) => update(index, { textContent: v })} rows={10} placeholder="Write your article content… Use # at the start of a line for headings." />
                        <p className="text-xs text-muted-foreground mt-1">No character limit. Use # prefix for headings.</p>
                      </div>
                    )}
                    {block.type === "file" && (
                      <>
                        <FilePicker file={block.file} fileName={block.fileName} fileSize={block.fileSize} onFileChange={(f) => update(index, { file: f, fileName: f?.name, fileSize: f?.size })} />
                        <ExternalFileSection externalFileUrl={block.externalFileUrl ?? ""} onChange={(url) => update(index, { externalFileUrl: url })} />
                      </>
                    )}
                    {block.type === "image" && (
                      <ImagePicker imageFile={block.imageFile} imagePreview={block.imagePreview} imageDescription={block.imageDescription}
                        onImageChange={(f, preview) => update(index, { imageFile: f, imagePreview: preview })} onDescriptionChange={(v) => update(index, { imageDescription: v })} />
                    )}
                    {block.type === "github" && (
                      <GitHubBlockEditor
                        textContent={block.textContent}
                        githubDescription={block.githubDescription ?? ""}
                        onUrlChange={(v) => update(index, { textContent: v })}
                        onDescChange={(v) => update(index, { githubDescription: v })}
                      />
                    )}
                    {block.type === "large_file" && (
                      <LargeFileBlockEditor
                        textContent={block.textContent}
                        platform={block.largeFilePlatform ?? ""}
                        customPlatform={block.largeFileCustomPlatform ?? ""}
                        description={block.largeFileDescription ?? ""}
                        sizeHint={block.largeFileSizeHint ?? ""}
                        onUrlChange={(v) => update(index, { textContent: v })}
                        onPlatformChange={(v) => update(index, { largeFilePlatform: v })}
                        onCustomPlatformChange={(v) => update(index, { largeFileCustomPlatform: v })}
                        onDescChange={(v) => update(index, { largeFileDescription: v })}
                        onSizeHintChange={(v) => update(index, { largeFileSizeHint: v })}
                      />
                    )}
                  </>
                ) : (
                  (() => {
                    const variation = block.variations.find((v) => v.label === activeTab);
                    if (!variation) return null;
                    return (
                      <div className="ml-3 pl-3 border-l-2 border-primary/20">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Variation {variation.label}</p>
                        <div className="flex gap-1 mb-3">
                          {(["text", "file", "image"] as BlockType[]).map((t) => (
                            <button key={t} type="button" onClick={() => updateVariation(index, variation.id, { type: t })}
                              className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${variation.type === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{t}</button>
                          ))}
                        </div>
                        <VariationEditor variation={variation} onUpdate={(patch) => updateVariation(index, variation.id, patch)} />
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Per-block use instructions — hidden for Blog */}
              {contentType !== "Blog" && (
              <div className="px-3 pb-2">
                <UseInstructionsToggle value={block.useInstructions} onChange={(v) => update(index, { useInstructions: v })} />
              </div>
              )}

              {/* Add variation link */}
              {supportsVariations(block.type) && (
                <div className="px-3 pb-2">
                  <button type="button" onClick={() => addVariation(index)} className="text-xs text-muted-foreground hover:text-primary transition-colors">+ Variation</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add block buttons — single scrollable row */}
      <div className="flex gap-1.5 pt-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {(contentType === "Blog" ? (
          [
            { type: "text" as BlockType, label: "+ Text" },
            { type: "long_text" as BlockType, label: "+ Long Text" },
            { type: "image" as BlockType, label: "+ Image" },
            { type: "file" as BlockType, label: "+ File" },
          ].map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="flex-shrink-0 h-8 px-2.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))
        ) : (
          BLOCK_TYPE_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => addBlock(value as BlockType)}
              className="flex-shrink-0 h-8 px-2.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-colors whitespace-nowrap"
            >
              {icon} + {label}
            </button>
          ))
        ))}
      </div>
    </div>
  );
}
