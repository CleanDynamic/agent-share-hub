import React, { useState, useCallback } from "react";
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
  | "section_heading"
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

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  stepType: 'manual' | 'ai' | 'automated' | 'decision';
  tool?: string;
  decisionYes?: string;
  decisionNo?: string;
  subBlockType?: string;
  subBlockContent?: string;
}

export interface AgentCapability {
  id: string;
  title: string;
  description: string;
  subPrompt: string;
}

export interface ToolStep {
  id: string;
  title: string;
  instruction: string;
  codeSnippet?: string;
  screenshot?: string;
}

export interface ToolError {
  id: string;
  symptom: string;
  cause: string;
  fix: string;
}

export interface ResultMetric {
  id: string;
  label: string;
  value: string;
}

export interface EnvVar {
  id: string;
  name: string;
  description: string;
  example: string;
}

export interface ContentBlock {
  id: string;
  subheading?: string;
  type: BlockType;

  // ── Core text (used by text, long_text, prompt,
  //    agent_config, code, model_params) ──────────
  textContent: string;
  formatting: FormattingType;
  subBlocks: string[];
  useInstructions: string;

  // ── File / image (existing) ────────────────────
  file: File | null;
  fileName?: string;
  fileSize?: number;
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
  externalFileUrl?: string;
  githubDescription?: string;
  largeFilePlatform?: string;
  largeFileCustomPlatform?: string;
  largeFileDescription?: string;
  largeFileSizeHint?: string;

  // ── Variations (existing) ──────────────────────
  variations: BlockVariation[];
  isPreview: boolean;

  // ── PROMPT ────────────────────────────────────
  promptRole: 'system' | 'user' | 'assistant' | 'full';
  promptModel: string;
  promptVariables: Array<{ name: string; description: string }>;
  promptExampleOutput: string;

  // ── AGENT CONFIG ──────────────────────────────
  agentModel: string;
  agentTemperature: number;
  agentMaxTokens: number;
  agentTools: string[];
  agentMemoryType: string;
  agentCapabilities: AgentCapability[];

  // ── WORKFLOW ──────────────────────────────────
  workflowTrigger: string;
  workflowOutput: string;
  workflowSteps: WorkflowStep[];

  // ── MODEL PARAMS ──────────────────────────────
  modelName: string;
  modelTemperature: number;
  modelTopP: number;
  modelMaxTokens: number;
  modelSystemPrompt: string;
  modelStopSequences: string[];
  modelReasoning: string;

  // ── TOOL SETUP ────────────────────────────────
  toolName: string;
  toolUrl: string;
  toolPrerequisites: string[];
  toolSteps: ToolStep[];
  toolErrors: ToolError[];
  toolTimeEstimate: string;

  // ── CODE ──────────────────────────────────────
  codeLanguage: string;
  codeDependencies: string[];
  codeEnvVars: EnvVar[];
  codeRunInstructions: string;
  codeExampleOutput: string;

  // ── RESULT ────────────────────────────────────
  resultBefore: string;
  resultAfter: string;
  resultMetrics: ResultMetric[];
  resultVerdict: string;
  resultRating: number;

  // ── COMPARISON (enhanced) ─────────────────────
  comparisonLabelA: string;
  comparisonLabelB: string;
  comparisonTypeA: string;
  comparisonTypeB: string;
  comparisonContentA: Record<string, any>;
  comparisonContentB: Record<string, any>;
  comparisonAxis: string;
  comparisonVerdict: string;

  // ── RESOURCE (enhanced) ───────────────────────
  resourceTitle: string;
  resourceType: 'paper'|'tool'|'video'|'course'|'repo'|'article'|'other';
  resourceAnnotation: string;
  resourceIsPaywalled: boolean;
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
  subheading: '',
  type,
  textContent: '',
  formatting: 'paragraph',
  subBlocks: ['', ''],
  useInstructions: '',
  file: null,
  imageFile: null,
  imageDescription: '',
  variations: [],
  isPreview: false,
  externalFileUrl: '',
  githubDescription: '',
  largeFilePlatform: '',
  largeFileCustomPlatform: '',
  largeFileDescription: '',
  largeFileSizeHint: '',
  fileName: undefined,
  fileSize: undefined,
  imagePreview: undefined,

  // Prompt
  promptRole: 'user',
  promptModel: '',
  promptVariables: [],
  promptExampleOutput: '',

  // Agent
  agentModel: '',
  agentTemperature: 0.7,
  agentMaxTokens: 4000,
  agentTools: [],
  agentMemoryType: 'conversation',
  agentCapabilities: [],

  // Workflow
  workflowTrigger: '',
  workflowOutput: '',
  workflowSteps: [],

  // Model params
  modelName: '',
  modelTemperature: 0.7,
  modelTopP: 1.0,
  modelMaxTokens: 4000,
  modelSystemPrompt: '',
  modelStopSequences: [],
  modelReasoning: '',

  // Tool setup
  toolName: '',
  toolUrl: '',
  toolPrerequisites: [],
  toolSteps: [],
  toolErrors: [],
  toolTimeEstimate: '',

  // Code
  codeLanguage: 'python',
  codeDependencies: [],
  codeEnvVars: [],
  codeRunInstructions: '',
  codeExampleOutput: '',

  // Result
  resultBefore: '',
  resultAfter: '',
  resultMetrics: [],
  resultVerdict: '',
  resultRating: 0,

  // Comparison
  comparisonLabelA: 'Option A',
  comparisonLabelB: 'Option B',
  comparisonTypeA: 'text',
  comparisonTypeB: 'text',
  comparisonContentA: {},
  comparisonContentB: {},
  comparisonAxis: '',
  comparisonVerdict: '',

  // Resource
  resourceTitle: '',
  resourceType: 'article',
  resourceAnnotation: '',
  resourceIsPaywalled: false,
  resourceDescription: '',
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

const NEW_BLOCK_TYPES = [
  { value: 'section_heading', label: 'Section Heading', emoji: '§', desc: 'A named section — creates a TOC entry' },
  { value: 'prompt',       label: 'Prompt',       emoji: '💬', desc: 'A copyable prompt' },
  { value: 'agent_config', label: 'Agent Config',  emoji: '🤖', desc: 'System prompt + settings' },
  { value: 'workflow',     label: 'Workflow',      emoji: '🔄', desc: 'Step-by-step process' },
  { value: 'model_params', label: 'Model Params',  emoji: '⚙️', desc: 'Temperature, context etc' },
  { value: 'tool_setup',   label: 'Tool Setup',    emoji: '🔧', desc: 'Configure a tool' },
  { value: 'code',         label: 'Code',          emoji: '{ }', desc: 'Script or snippet' },
  { value: 'result',       label: 'Result',        emoji: '📊', desc: 'Output or screenshot' },
  { value: 'comparison',   label: 'Comparison',    emoji: '↔', desc: 'Side-by-side' },
  { value: 'text',         label: 'Text',          emoji: '¶', desc: 'Written explanation' },
  { value: 'image',        label: 'Image',         emoji: '🖼', desc: 'Screenshot or diagram' },
  { value: 'resource',     label: 'Resource',      emoji: '🔗', desc: 'Link or reference' },
];

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

// ─── Chip input for multi-select tags ────────────────────────

const ChipInput = ({ values, onChange, placeholder }: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) => {
  const [input, setInput] = React.useState('');
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {values.map(v => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 9999, fontSize: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
          }}>
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.40)', fontSize: 14, lineHeight: 1 }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Type and press Enter'}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '6px 10px', fontSize: 13,
            color: '#fff', outline: 'none',
          }} />
        <button type="button" onClick={add} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
        }}>Add</button>
      </div>
    </div>
  );
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
    marginBottom: 6, marginTop: 14,
  }}>{children}</div>
);

const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    {children}
  </div>
);

// ─── Prompt block editor ─────────────────────────────────────

const PromptBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const detected = [...(block.textContent.matchAll(/\{\{(\w+)\}\}/g))]
    .map(m => m[1])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div>
      <FieldLabel>Role</FieldLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {(['system','user','assistant','full'] as const).map(r => (
          <button key={r} type="button"
            onClick={() => update(index, { promptRole: r })}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11,
              fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer',
              background: block.promptRole === r
                ? 'rgba(232,87,26,0.20)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${block.promptRole === r
                ? 'rgba(232,87,26,0.50)' : 'rgba(255,255,255,0.08)'}`,
              color: block.promptRole === r
                ? '#E8571A' : 'rgba(255,255,255,0.45)',
            }}>
            {r === 'full' ? 'Full Conversation' : r}
          </button>
        ))}
      </div>

      <FieldLabel>Model target (optional)</FieldLabel>
      <input value={block.promptModel}
        onChange={e => update(index, { promptModel: e.target.value })}
        placeholder="e.g. Claude Sonnet, GPT-4o, Any"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }} />

      <FieldLabel>Prompt</FieldLabel>
      <div style={{ position: 'relative' }}>
        <textarea value={block.textContent}
          onChange={e => update(index, { textContent: e.target.value })}
          placeholder="Write your prompt. Use {{variable}} for placeholders."
          rows={7}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.30)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '10px', fontSize: 13,
            color: 'rgba(255,255,255,0.90)', outline: 'none',
            resize: 'vertical', fontFamily: 'Courier New, monospace',
            lineHeight: 1.6, boxSizing: 'border-box',
          }} />
        <button type="button"
          onClick={() => navigator.clipboard.writeText(block.textContent)}
          style={{
            position: 'absolute', top: 8, right: 8,
            fontSize: 10, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
          }}>
          Copy
        </button>
      </div>

      {detected.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <FieldLabel>Variables detected in prompt</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {detected.map(v => (
              <span key={v} style={{
                padding: '2px 10px', borderRadius: 9999, fontSize: 12,
                background: 'rgba(46,196,182,0.15)',
                border: '1px solid rgba(46,196,182,0.30)',
                color: '#2EC4B6', fontFamily: 'Courier New, monospace',
              }}>
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <FieldLabel>Example output (optional)</FieldLabel>
      <textarea value={block.promptExampleOutput}
        onChange={e => update(index, { promptExampleOutput: e.target.value })}
        placeholder="Paste an example of what this prompt produces..."
        rows={4}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '8px 10px', fontSize: 13,
          color: 'rgba(255,255,255,0.60)', outline: 'none',
          resize: 'vertical', fontFamily: 'Inter, sans-serif',
          lineHeight: 1.6, boxSizing: 'border-box',
        }} />
    </div>
  );
};

// ─── Agent config block editor ───────────────────────────────

const AgentBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const AGENT_TOOLS = ['Web Search','Code Interpreter','Image Generation',
    'File Reading','Calculator','Email','Calendar','Browser'];

  return (
    <div>
      <FieldLabel>System prompt</FieldLabel>
      <div style={{ position: 'relative' }}>
        <textarea value={block.textContent}
          onChange={e => update(index, { textContent: e.target.value })}
          placeholder="Paste the full system prompt..."
          rows={8}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.30)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '10px', fontSize: 13,
            color: 'rgba(255,255,255,0.90)', outline: 'none',
            resize: 'vertical', fontFamily: 'Courier New, monospace',
            lineHeight: 1.6, boxSizing: 'border-box',
          }} />
        <button type="button"
          onClick={() => navigator.clipboard.writeText(block.textContent)}
          style={{
            position: 'absolute', top: 8, right: 8, fontSize: 10,
            padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
          }}>Copy</button>
      </div>

      <FieldRow>
        <div style={{ flex: 2 }}>
          <FieldLabel>Model</FieldLabel>
          <input value={block.agentModel}
            onChange={e => update(index, { agentModel: e.target.value })}
            placeholder="e.g. claude-sonnet-4-6"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '7px 10px', fontSize: 13,
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Temperature</FieldLabel>
          <input type="number" min={0} max={2} step={0.1}
            value={block.agentTemperature}
            onChange={e => update(index, { agentTemperature: parseFloat(e.target.value) })}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '7px 10px', fontSize: 13,
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Max tokens</FieldLabel>
          <input type="number" step={100}
            value={block.agentMaxTokens}
            onChange={e => update(index, { agentMaxTokens: parseInt(e.target.value) })}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '7px 10px', fontSize: 13,
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
      </FieldRow>

      <FieldLabel>Tools enabled</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {AGENT_TOOLS.map(t => {
          const active = block.agentTools.includes(t);
          return (
            <button key={t} type="button"
              onClick={() => update(index, {
                agentTools: active
                  ? block.agentTools.filter(x => x !== t)
                  : [...block.agentTools, t]
              })}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                cursor: 'pointer',
                background: active ? 'rgba(46,196,182,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(46,196,182,0.40)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#2EC4B6' : 'rgba(255,255,255,0.45)',
              }}>
              {t}
            </button>
          );
        })}
      </div>

      <FieldLabel>Memory type</FieldLabel>
      <div style={{ display: 'flex', gap: 6 }}>
        {['None','Conversation','External DB','Summary'].map(m => {
          const active = block.agentMemoryType === m;
          return (
            <button key={m} type="button"
              onClick={() => update(index, { agentMemoryType: m })}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12,
                cursor: 'pointer',
                background: active ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(139,92,246,0.40)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#8B5CF6' : 'rgba(255,255,255,0.45)',
              }}>
              {m}
            </button>
          );
        })}
      </div>

      <FieldLabel>Capabilities</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {block.agentCapabilities.map((cap, ci) => (
          <div key={cap.id} style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <input value={cap.title}
                onChange={e => update(index, {
                  agentCapabilities: block.agentCapabilities.map((c,i) =>
                    i === ci ? { ...c, title: e.target.value } : c)
                })}
                placeholder="Capability name"
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.10)',
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  outline: 'none', padding: '2px 0',
                }} />
              <button type="button"
                onClick={() => update(index, {
                  agentCapabilities: block.agentCapabilities.filter((_,i) => i !== ci)
                })}
                style={{ background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.30)', cursor: 'pointer', fontSize: 16 }}>
                ×
              </button>
            </div>
            <textarea value={cap.subPrompt}
              onChange={e => update(index, {
                agentCapabilities: block.agentCapabilities.map((c,i) =>
                  i === ci ? { ...c, subPrompt: e.target.value } : c)
              })}
              placeholder="Sub-prompt or instructions for this capability..."
              rows={3}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.20)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: 'rgba(255,255,255,0.70)', outline: 'none',
                resize: 'vertical', fontFamily: 'Courier New, monospace',
                boxSizing: 'border-box',
              }} />
          </div>
        ))}
        <button type="button"
          onClick={() => update(index, {
            agentCapabilities: [...block.agentCapabilities, {
              id: uid(), title: '', description: '', subPrompt: '',
            }]
          })}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
          }}>
          + Add Capability
        </button>
      </div>
    </div>
  );
};

// ─── Workflow block editor ───────────────────────────────────

const STEP_TYPE_CONFIG = {
  manual:    { color: '#9CA3AF', label: 'Manual',    emoji: '👤' },
  ai:        { color: '#2EC4B6', label: 'AI',        emoji: '🤖' },
  automated: { color: '#3B82F6', label: 'Auto',      emoji: '⚡' },
  decision:  { color: '#F59E0B', label: 'Decision',  emoji: '◆' },
};

const WorkflowBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const addStep = () => update(index, {
    workflowSteps: [...block.workflowSteps, {
      id: uid(), title: '', description: '',
      stepType: 'ai', tool: '',
      decisionYes: '', decisionNo: '',
      subBlockType: '', subBlockContent: '',
    }]
  });

  const updateStep = (si: number, patch: Partial<WorkflowStep>) =>
    update(index, {
      workflowSteps: block.workflowSteps.map((s,i) =>
        i === si ? { ...s, ...patch } : s)
    });

  const removeStep = (si: number) =>
    update(index, {
      workflowSteps: block.workflowSteps.filter((_,i) => i !== si)
    });

  return (
    <div>
      <FieldLabel>Trigger — what starts this workflow?</FieldLabel>
      <input value={block.workflowTrigger}
        onChange={e => update(index, { workflowTrigger: e.target.value })}
        placeholder="e.g. New email arrives in Gmail, User submits form..."
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '8px 10px', fontSize: 13,
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }} />

      <FieldLabel>Steps</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.workflowSteps.map((step, si) => {
          const cfg = STEP_TYPE_CONFIG[step.stepType];
          return (
            <div key={step.id} style={{
              padding: '12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${cfg.color}30`,
              borderLeft: `3px solid ${cfg.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center',
                gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: `${cfg.color}20`, border: `1px solid ${cfg.color}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: cfg.color, flexShrink: 0,
                }}>
                  {si + 1}
                </span>
                <input value={step.title}
                  onChange={e => updateStep(si, { title: e.target.value })}
                  placeholder="Step title"
                  style={{
                    flex: 1, background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.10)',
                    fontSize: 13, fontWeight: 600, color: '#fff',
                    outline: 'none', padding: '2px 0',
                  }} />
                <button type="button"
                  onClick={() => removeStep(si)}
                  style={{ background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
                    fontSize: 16 }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(Object.keys(STEP_TYPE_CONFIG) as Array<WorkflowStep['stepType']>)
                  .map(t => {
                    const c = STEP_TYPE_CONFIG[t];
                    const active = step.stepType === t;
                    return (
                      <button key={t} type="button"
                        onClick={() => updateStep(si, { stepType: t })}
                        style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11,
                          cursor: 'pointer',
                          background: active ? `${c.color}20` : 'transparent',
                          border: `1px solid ${active ? c.color + '50' : 'rgba(255,255,255,0.08)'}`,
                          color: active ? c.color : 'rgba(255,255,255,0.35)',
                        }}>
                        {c.emoji} {c.label}
                      </button>
                    );
                  })}
              </div>

              <textarea value={step.description}
                onChange={e => updateStep(si, { description: e.target.value })}
                placeholder="Describe what happens in this step..."
                rows={2}
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6, padding: '6px 8px', fontSize: 12,
                  color: 'rgba(255,255,255,0.70)', outline: 'none',
                  resize: 'vertical', fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                }} />

              <input value={step.tool ?? ''}
                onChange={e => updateStep(si, { tool: e.target.value })}
                placeholder="Tool used (e.g. Make, Claude, Gmail)..."
                style={{
                  width: '100%', background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12, color: 'rgba(255,255,255,0.45)',
                  outline: 'none', padding: '4px 0', marginTop: 6,
                  boxSizing: 'border-box',
                }} />

              {step.stepType === 'decision' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={step.decisionYes ?? ''}
                    onChange={e => updateStep(si, { decisionYes: e.target.value })}
                    placeholder="✓ Yes path"
                    style={{
                      flex: 1, background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.20)',
                      borderRadius: 6, padding: '5px 8px', fontSize: 12,
                      color: '#22C55E', outline: 'none',
                    }} />
                  <input value={step.decisionNo ?? ''}
                    onChange={e => updateStep(si, { decisionNo: e.target.value })}
                    placeholder="✗ No path"
                    style={{
                      flex: 1, background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.20)',
                      borderRadius: 6, padding: '5px 8px', fontSize: 12,
                      color: '#EF4444', outline: 'none',
                    }} />
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={addStep} style={{
          padding: '8px', borderRadius: 8, fontSize: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
        }}>
          + Add step
        </button>
      </div>

      <FieldLabel>Output — what does this workflow produce?</FieldLabel>
      <input value={block.workflowOutput}
        onChange={e => update(index, { workflowOutput: e.target.value })}
        placeholder="e.g. Drafted reply email sent to Gmail drafts..."
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '8px 10px', fontSize: 13,
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }} />
    </div>
  );
};

// ─── Code block editor ───────────────────────────────────────

const CodeBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const LANGS = ['python','javascript','typescript','bash','sql',
    'json','yaml','rust','go','other'];
  return (
    <div>
      <FieldLabel>Language</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LANGS.map(l => (
          <button key={l} type="button"
            onClick={() => update(index, { codeLanguage: l })}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 12,
              cursor: 'pointer', textTransform: 'uppercase', fontWeight: 600,
              background: block.codeLanguage === l
                ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${block.codeLanguage === l
                ? 'rgba(59,130,246,0.50)' : 'rgba(255,255,255,0.08)'}`,
              color: block.codeLanguage === l
                ? '#3B82F6' : 'rgba(255,255,255,0.45)',
            }}>
            {l}
          </button>
        ))}
      </div>

      <FieldLabel>Code</FieldLabel>
      <div style={{ position: 'relative' }}>
        <textarea value={block.textContent}
          onChange={e => update(index, { textContent: e.target.value })}
          placeholder="Paste your code here..."
          rows={10}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.40)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '10px', fontSize: 12,
            color: '#A5F3FC', outline: 'none', resize: 'vertical',
            fontFamily: 'Courier New, monospace', lineHeight: 1.5,
            boxSizing: 'border-box',
          }} />
        <button type="button"
          onClick={() => navigator.clipboard.writeText(block.textContent)}
          style={{
            position: 'absolute', top: 8, right: 8, fontSize: 10,
            padding: '2px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
          }}>Copy</button>
      </div>

      <FieldLabel>Dependencies (pip install / npm install)</FieldLabel>
      <ChipInput values={block.codeDependencies}
        onChange={v => update(index, { codeDependencies: v })}
        placeholder="e.g. requests, anthropic, pandas" />

      <FieldLabel>Run instructions</FieldLabel>
      <textarea value={block.codeRunInstructions}
        onChange={e => update(index, { codeRunInstructions: e.target.value })}
        placeholder="How to run this code..."
        rows={2}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: 'rgba(255,255,255,0.70)', outline: 'none',
          resize: 'vertical', fontFamily: 'Inter',
          boxSizing: 'border-box',
        }} />

      <FieldLabel>Example output (optional)</FieldLabel>
      <textarea value={block.codeExampleOutput}
        onChange={e => update(index, { codeExampleOutput: e.target.value })}
        placeholder="Paste example terminal output..."
        rows={3}
        style={{
          width: '100%', background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '7px 10px', fontSize: 12,
          color: 'rgba(255,255,255,0.55)', outline: 'none',
          resize: 'vertical', fontFamily: 'Courier New, monospace',
          boxSizing: 'border-box',
        }} />
    </div>
  );
};

// ─── Result block editor ─────────────────────────────────────

const ResultBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => (
  <div>
    <FieldLabel>Before</FieldLabel>
    <textarea value={block.resultBefore}
      onChange={e => update(index, { resultBefore: e.target.value })}
      placeholder="What was the state before? What prompt / input did you use?"
      rows={3}
      style={{
        width: '100%', background: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 8, padding: '8px 10px', fontSize: 13,
        color: 'rgba(255,255,255,0.80)', outline: 'none',
        resize: 'vertical', fontFamily: 'Inter',
        boxSizing: 'border-box',
      }} />

    <FieldLabel>After — the actual output</FieldLabel>
    <div style={{ position: 'relative' }}>
      <textarea value={block.resultAfter}
        onChange={e => update(index, { resultAfter: e.target.value })}
        placeholder="Paste the actual AI output here..."
        rows={6}
        style={{
          width: '100%', background: 'rgba(34,197,94,0.04)',
          border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 8, padding: '8px 10px', fontSize: 13,
          color: 'rgba(255,255,255,0.85)', outline: 'none',
          resize: 'vertical', fontFamily: 'Inter',
          boxSizing: 'border-box',
        }} />
      <button type="button"
        onClick={() => navigator.clipboard.writeText(block.resultAfter)}
        style={{
          position: 'absolute', top: 8, right: 8, fontSize: 10,
          padding: '2px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
        }}>Copy</button>
    </div>

    <FieldLabel>Verdict — what does this result tell us?</FieldLabel>
    <textarea value={block.resultVerdict}
      onChange={e => update(index, { resultVerdict: e.target.value })}
      placeholder="This worked because... / This failed because..."
      rows={2}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, padding: '7px 10px', fontSize: 13,
        color: 'rgba(255,255,255,0.70)', outline: 'none',
        resize: 'vertical', fontFamily: 'Inter',
        boxSizing: 'border-box',
      }} />

    <FieldLabel>Your rating of this result</FieldLabel>
    <div style={{ display: 'flex', gap: 8 }}>
      {[1,2,3,4,5].map(r => (
        <button key={r} type="button"
          onClick={() => update(index, { resultRating: r })}
          style={{
            width: 32, height: 32, borderRadius: 6, fontSize: 16,
            cursor: 'pointer', border: 'none',
            background: block.resultRating >= r
              ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.04)',
          }}>
          {block.resultRating >= r ? '★' : '☆'}
        </button>
      ))}
    </div>
  </div>
);

// ─── Comparison block editor ─────────────────────────────────

const ComparisonBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const COMPARABLE_TYPES = [
    { v: 'text', l: 'Text', e: '¶' },
    { v: 'prompt', l: 'Prompt', e: '💬' },
    { v: 'code', l: 'Code', e: '{ }' },
    { v: 'result', l: 'Result', e: '📊' },
    { v: 'config', l: 'Config', e: '⚙️' },
  ];

  const SideEditor = ({
    label, type, content, onLabelChange, onTypeChange, onContentChange
  }: {
    label: string; type: string; content: Record<string,any>;
    onLabelChange: (v: string) => void;
    onTypeChange: (v: string) => void;
    onContentChange: (v: Record<string,any>) => void;
  }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input value={label} onChange={e => onLabelChange(e.target.value)}
        placeholder="Label (e.g. GPT-4o)"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 6, padding: '6px 8px', fontSize: 13,
          fontWeight: 600, color: '#fff', outline: 'none',
          marginBottom: 8, boxSizing: 'border-box',
        }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {COMPARABLE_TYPES.map(t => (
          <button key={t.v} type="button"
            onClick={() => onTypeChange(t.v)}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              cursor: 'pointer',
              background: type === t.v
                ? 'rgba(232,87,26,0.20)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${type === t.v
                ? 'rgba(232,87,26,0.40)' : 'rgba(255,255,255,0.08)'}`,
              color: type === t.v
                ? '#E8571A' : 'rgba(255,255,255,0.40)',
            }}>
            {t.e} {t.l}
          </button>
        ))}
      </div>
      <textarea
        value={content.text ?? ''}
        onChange={e => onContentChange({ ...content, text: e.target.value })}
        placeholder={`${COMPARABLE_TYPES.find(t => t.v === type)?.l ?? 'Content'} goes here...`}
        rows={6}
        style={{
          width: '100%',
          background: type === 'code' ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '8px 10px', fontSize: 12,
          color: type === 'code' ? '#A5F3FC' : 'rgba(255,255,255,0.80)',
          outline: 'none', resize: 'vertical',
          fontFamily: type === 'code' || type === 'prompt'
            ? 'Courier New, monospace' : 'Inter',
          boxSizing: 'border-box',
        }} />
    </div>
  );

  return (
    <div>
      <FieldLabel>What are you comparing?</FieldLabel>
      <input value={block.comparisonAxis}
        onChange={e => update(index, { comparisonAxis: e.target.value })}
        placeholder="e.g. Output quality, Speed, Cost, Tone..."
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: '#fff', outline: 'none',
          boxSizing: 'border-box', marginBottom: 14,
        }} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SideEditor
          label={block.comparisonLabelA}
          type={block.comparisonTypeA}
          content={block.comparisonContentA}
          onLabelChange={v => update(index, { comparisonLabelA: v })}
          onTypeChange={v => update(index, { comparisonTypeA: v })}
          onContentChange={v => update(index, { comparisonContentA: v })}
        />
        <div style={{
          color: 'rgba(255,255,255,0.20)', fontSize: 20,
          paddingTop: 36, flexShrink: 0,
        }}>↔</div>
        <SideEditor
          label={block.comparisonLabelB}
          type={block.comparisonTypeB}
          content={block.comparisonContentB}
          onLabelChange={v => update(index, { comparisonLabelB: v })}
          onTypeChange={v => update(index, { comparisonTypeB: v })}
          onContentChange={v => update(index, { comparisonContentB: v })}
        />
      </div>

      <FieldLabel>Verdict</FieldLabel>
      <textarea value={block.comparisonVerdict}
        onChange={e => update(index, { comparisonVerdict: e.target.value })}
        placeholder="Which won and why?"
        rows={2}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: 'rgba(255,255,255,0.70)', outline: 'none',
          resize: 'vertical', fontFamily: 'Inter',
          boxSizing: 'border-box',
        }} />
    </div>
  );
};

// ─── Resource block editor ───────────────────────────────────

const ResourceBlockEditor = ({ block, update, index }: {
  block: ContentBlock; update: (i: number, p: Partial<ContentBlock>) => void; index: number;
}) => {
  const TYPES = ['article','paper','tool','video','course','repo','other'];
  return (
    <div>
      <FieldLabel>URL</FieldLabel>
      <input value={block.textContent}
        onChange={e => update(index, { textContent: e.target.value })}
        placeholder="https://..."
        type="url"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '8px 10px', fontSize: 13,
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }} />

      <FieldLabel>Title</FieldLabel>
      <input value={block.resourceTitle}
        onChange={e => update(index, { resourceTitle: e.target.value })}
        placeholder="Resource title"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }} />

      <FieldLabel>Type</FieldLabel>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button key={t} type="button"
            onClick={() => update(index, { resourceType: t as any })}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 12,
              cursor: 'pointer', textTransform: 'capitalize',
              background: block.resourceType === t
                ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${block.resourceType === t
                ? 'rgba(139,92,246,0.40)' : 'rgba(255,255,255,0.08)'}`,
              color: block.resourceType === t
                ? '#8B5CF6' : 'rgba(255,255,255,0.45)',
            }}>
            {t}
          </button>
        ))}
      </div>

      <FieldLabel>Why this matters</FieldLabel>
      <textarea value={block.resourceAnnotation}
        onChange={e => update(index, { resourceAnnotation: e.target.value })}
        placeholder="Why is this resource useful? What will the reader get from it?"
        rows={3}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '7px 10px', fontSize: 13,
          color: 'rgba(255,255,255,0.70)', outline: 'none',
          resize: 'vertical', fontFamily: 'Inter',
          boxSizing: 'border-box',
        }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <input type="checkbox" id="paywalled"
          checked={block.resourceIsPaywalled}
          onChange={e => update(index, { resourceIsPaywalled: e.target.checked })}
          style={{ width: 14, height: 14 }} />
        <label htmlFor="paywalled"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>
          Paywalled / requires account
        </label>
      </div>
    </div>
  );
};

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
  section_heading: "Section Heading",
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

// ─── Block type picker (2-column grid) ──────────────────────

const BlockTypePicker = ({ onAdd }: { onAdd: (type: BlockType) => void }) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.50)',
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add block
      </button>

      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          marginTop: 8,
          padding: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
        }}>
          {NEW_BLOCK_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => { onAdd(bt.value as BlockType); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)';
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{bt.emoji}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                  {bt.label}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 1 }}>
                  {bt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Section Heading editor ─────────────────────────────────

const SectionHeadingEditor = ({
  block, update, index
}: {
  block: ContentBlock;
  update: (i: number, p: Partial<ContentBlock>) => void;
  index: number;
}) => (
  <div style={{ padding: '4px 0 8px 0' }}>
    <input
      value={block.textContent}
      onChange={e => update(index, { textContent: e.target.value })}
      placeholder="Section heading..."
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid rgba(232,87,26,0.35)',
        fontSize: 18,
        fontWeight: 700,
        fontFamily: "'Playfair Display', Georgia, serif",
        color: 'rgba(255,255,255,0.90)',
        outline: 'none',
        padding: '4px 0',
        boxSizing: 'border-box',
      }}
      onFocus={e => {
        e.currentTarget.style.borderBottomColor = 'rgba(232,87,26,0.70)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderBottomColor = 'rgba(232,87,26,0.35)';
      }}
    />
    <div style={{
      fontSize: 11, color: 'rgba(255,255,255,0.25)',
      marginTop: 6,
    }}>
      This heading will appear in the table of contents
    </div>
  </div>
);

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
  const supportsPreview = (type: BlockType) => type !== "github" && type !== "section_heading";
  const supportsVariations = (type: BlockType) => type !== "github" && type !== "large_file" && type !== "section_heading";

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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.30)',
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span>{NEW_BLOCK_TYPES.find(b => b.value === block.type)?.emoji}</span>
                  <span>{NEW_BLOCK_TYPES.find(b => b.value === block.type)?.label ?? block.type}</span>
                </div>
                {showingMain ? (
                  <>
                    {block.type === 'section_heading' && (
                      <SectionHeadingEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'prompt' && (
                      <PromptBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'agent_config' && (
                      <AgentBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'workflow' && (
                      <WorkflowBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'code' && (
                      <CodeBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'result' && (
                      <ResultBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'comparison' && (
                      <ComparisonBlockEditor block={block} update={update} index={index} />
                    )}
                    {block.type === 'resource' && (
                      <ResourceBlockEditor block={block} update={update} index={index} />
                    )}
                    {(block.type === 'text' || block.type === 'long_text') && (
                      <TextEditor value={block.textContent} formatting={block.formatting} subBlocks={block.subBlocks}
                        onTextChange={(v) => update(index, { textContent: v })} onFormatChange={(f) => update(index, { formatting: f })} onSubBlocksChange={(s) => update(index, { subBlocks: s })} />
                    )}
                    {block.type === 'image' && (
                      <ImagePicker imageFile={block.imageFile} imagePreview={block.imagePreview} imageDescription={block.imageDescription}
                        onImageChange={(f, preview) => update(index, { imageFile: f, imagePreview: preview })} onDescriptionChange={(v) => update(index, { imageDescription: v })} />
                    )}
                    {(block.type === 'model_params' || block.type === 'tool_setup') && (
                      <MonospaceEditor
                        value={block.textContent}
                        onChange={(v) => update(index, { textContent: v })}
                        placeholder={block.type === 'model_params'
                          ? 'Model params...' : 'Tool setup steps...'}
                      />
                    )}
                    {block.type === "file" && (
                      <>
                        <FilePicker file={block.file} fileName={block.fileName} fileSize={block.fileSize} onFileChange={(f) => update(index, { file: f, fileName: f?.name, fileSize: f?.size })} />
                        <ExternalFileSection externalFileUrl={block.externalFileUrl ?? ""} onChange={(url) => update(index, { externalFileUrl: url })} />
                      </>
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

      {/* Add block picker */}
      {contentType === "Blog" ? (
        <div className="flex gap-1.5 pt-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          {[
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
          ))}
        </div>
      ) : (
        <BlockTypePicker onAdd={addBlock} />
      )}
    </div>
  );
}
