import { useState, useCallback } from "react";
import {
  Type, Paperclip, ImageIcon, ChevronUp, ChevronDown, Trash2, Plus,
  List, ListOrdered, AlignLeft, ListTree, FileText, Heading,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionInput } from "@/components/MentionInput";

// ─── Types ───────────────────────────────────────────────────

export type FormattingType = "paragraph" | "bullets" | "numbers" | "sub_list";
export type BlockType = "text" | "long_text" | "file" | "image";

export interface BlockVariation {
  id: string;
  label: string; // "B", "C", "D" …
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
  file: File | null;
  fileName?: string;
  fileSize?: number;
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
  variations: BlockVariation[];
  isPreview: boolean;
}

interface Props {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
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

const nextLabel = (variations: BlockVariation[]) => {
  const used = new Set(variations.map((v) => v.label));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(66 + i); // B, C, D …
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
  file: null,
  imageFile: null,
  imageDescription: "",
  variations: [],
  isPreview: false,
});

// ─── Formatting toggle bar ──────────────────────────────────

const FORMATS: { value: FormattingType; icon: typeof AlignLeft; label: string }[] = [
  { value: "paragraph", icon: AlignLeft, label: "Paragraph" },
  { value: "bullets", icon: List, label: "Bullets" },
  { value: "numbers", icon: ListOrdered, label: "Numbered" },
  { value: "sub_list", icon: ListTree, label: "Sub-list" },
];

const FormatBar = ({
  active,
  onChange,
  showHeading = false,
}: {
  active: FormattingType;
  onChange: (f: FormattingType) => void;
  showHeading?: boolean;
}) => (
  <div className="flex gap-1 mb-2">
    {FORMATS.map((f) => {
      const Icon = f.icon;
      const isActive = active === f.value;
      return (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          title={f.label}
          className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
            isActive
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{f.label}</span>
        </button>
      );
    })}
    {showHeading && (
      <button
        type="button"
        onClick={() => onChange("paragraph")}
        title="Use # at the start of a line for headings"
        className="p-1.5 rounded-md text-xs flex items-center gap-1 text-muted-foreground hover:bg-muted"
      >
        <Heading className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Heading (# prefix)</span>
      </button>
    )}
  </div>
);

// ─── Text editor ─────────────────────────────────────────────

const TextEditor = ({
  value,
  formatting,
  onTextChange,
  onFormatChange,
}: {
  value: string;
  formatting: FormattingType;
  onTextChange: (v: string) => void;
  onFormatChange: (f: FormattingType) => void;
}) => {
  const len = value.length;
  const atLimit = len >= TEXT_MAX;
  return (
    <div>
      <FormatBar active={formatting} onChange={onFormatChange} />
      <MentionInput
        value={value}
        onChange={(v) => {
          if (v.length <= TEXT_MAX) onTextChange(v);
        }}
        rows={4}
        placeholder="Enter your content…"
        maxLength={TEXT_MAX}
      />
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs ${len >= 450 ? "text-destructive" : "text-muted-foreground"}`}>
          {len} / {TEXT_MAX}
        </span>
      </div>
      {atLimit && (
        <p className="text-xs text-amber-600 mt-1">
          Limit reached. Add another text block to continue, or upload a file for longer content.
        </p>
      )}
    </div>
  );
};

// ─── File picker ─────────────────────────────────────────────

const FilePicker = ({
  file,
  fileName,
  fileSize,
  onFileChange,
}: {
  file: File | null;
  fileName?: string;
  fileSize?: number;
  onFileChange: (f: File | null) => void;
}) => {
  const displayName = file?.name ?? fileName;
  const displaySize = file?.size ?? fileSize;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      alert("File must be under 10 MB.");
      return;
    }
    onFileChange(f);
  };

  return (
    <div>
      {displayName ? (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{displayName}</p>
            {displaySize != null && (
              <p className="text-xs text-muted-foreground">{(displaySize / 1024).toFixed(1)} KB</p>
            )}
          </div>
          <label className="text-xs text-primary hover:underline cursor-pointer">
            Replace
            <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleChange} className="hidden" />
          </label>
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

const ImagePicker = ({
  imageFile,
  imagePreview,
  imageDescription,
  onImageChange,
  onDescriptionChange,
}: {
  imageFile: File | null;
  imagePreview?: string;
  imageDescription: string;
  onImageChange: (f: File | null, preview?: string) => void;
  onDescriptionChange: (v: string) => void;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_SIZE) {
      alert("Image must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onImageChange(f, reader.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-3">
      {imagePreview ? (
        <div className="space-y-2">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-h-[120px] rounded-lg object-contain"
          />
          <label className="text-xs text-primary hover:underline cursor-pointer">
            Replace image
            <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleChange} className="hidden" />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
          <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">.jpg, .png, .webp — max 5 MB</span>
          <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleChange} className="hidden" />
        </label>
      )}
      <Input
        value={imageDescription}
        onChange={(e) => {
          if (e.target.value.length <= DESC_MAX) onDescriptionChange(e.target.value);
        }}
        placeholder="Describe what this image shows"
        className="bg-background border-border rounded-xl text-sm"
        maxLength={DESC_MAX}
      />
      <span className="text-xs text-muted-foreground">{imageDescription.length} / {DESC_MAX}</span>
    </div>
  );
};

// ─── Block type icon ─────────────────────────────────────────

const BlockTypeIcon = ({ type }: { type: BlockType }) => {
  if (type === "text") return <Type className="h-4 w-4" />;
  if (type === "long_text") return <FileText className="h-4 w-4" />;
  if (type === "file") return <Paperclip className="h-4 w-4" />;
  return <ImageIcon className="h-4 w-4" />;
};

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Text",
  long_text: "Article",
  file: "File",
  image: "Image",
};

// ─── Variation renderer ─────────────────────────────────────

const VariationEditor = ({
  variation,
  onUpdate,
}: {
  variation: BlockVariation;
  onUpdate: (v: Partial<BlockVariation>) => void;
}) => {
  if (variation.type === "text") {
    return (
      <TextEditor
        value={variation.textContent}
        formatting={variation.formatting}
        onTextChange={(v) => onUpdate({ textContent: v })}
        onFormatChange={(f) => onUpdate({ formatting: f })}
      />
    );
  }
  if (variation.type === "file") {
    return (
      <FilePicker
        file={variation.file}
        fileName={variation.fileName}
        onFileChange={(f) => onUpdate({ file: f, fileName: f?.name })}
      />
    );
  }
  return (
    <ImagePicker
      imageFile={variation.imageFile}
      imagePreview={variation.imagePreview}
      imageDescription={variation.imageDescription}
      onImageChange={(f, preview) => onUpdate({ imageFile: f, imagePreview: preview })}
      onDescriptionChange={(v) => onUpdate({ imageDescription: v })}
    />
  );
};

// ─── Main component ──────────────────────────────────────────

export function ContentBlockBuilder({ blocks, onChange }: Props) {
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

  const deleteBlock = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const addBlock = (type: BlockType) => {
    onChange([...blocks, emptyBlock(type)]);
  };

  const addVariation = (blockIndex: number) => {
    const block = blocks[blockIndex];
    const label = nextLabel(block.variations);
    const next = [...blocks];
    next[blockIndex] = {
      ...block,
      variations: [...block.variations, emptyVariation(label, block.type)],
    };
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
    // Reset tab if needed
    const activeTab = activeVariationTab[block.id];
    if (activeTab) {
      const removed = blocks[blockIndex].variations.find((v) => v.id === varId);
      if (removed && removed.label === activeTab) {
        setActiveVariationTab((prev) => ({ ...prev, [block.id]: "A" }));
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Your Content</Label>
      <p className="text-xs text-muted-foreground -mt-1">
        Build your content using text, file, and image blocks. Drag to reorder.
      </p>

      {/* Block list */}
      <div className="space-y-3">
        {blocks.map((block, index) => {
          const hasVariations = block.variations.length > 0;
          const activeTab = activeVariationTab[block.id] ?? "A";
          const showingMain = activeTab === "A";

          return (
            <div key={block.id} className={`border rounded-xl bg-card overflow-hidden ${block.isPreview ? "border-[#2EC4B6]/50" : "border-border"}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BlockTypeIcon type={block.type} />
                  <span>{BLOCK_TYPE_LABELS[block.type]}</span>
                  <span className="text-xs text-muted-foreground">Block {index + 1}</span>
                  {block.isPreview && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2EC4B6]/15 text-[#2EC4B6] font-medium">Preview</span>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Preview toggle */}
                  {(() => {
                    const previewCount = blocks.filter((b) => b.isPreview).length;
                    const canToggle = block.isPreview || previewCount < 2;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Free preview</span>
                            <Switch
                              checked={block.isPreview}
                              disabled={!canToggle}
                              onCheckedChange={(checked) => update(index, { isPreview: checked })}
                              className="scale-75"
                            />
                          </div>
                        </TooltipTrigger>
                        {!canToggle && <TooltipContent>Maximum 2 preview blocks</TooltipContent>}
                      </Tooltip>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => moveBlock(index, -1)}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === blocks.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBlock(index)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Variation tabs */}
              {hasVariations && (
                <div className="flex gap-1 px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveVariationTab((p) => ({ ...p, [block.id]: "A" }))}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      showingMain
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    A
                  </button>
                  {block.variations.map((v) => (
                    <div key={v.id} className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveVariationTab((p) => ({ ...p, [block.id]: v.label }))}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${
                          activeTab === v.label
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {v.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVariation(index, v.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title={`Delete variation ${v.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Content area */}
              <div className="p-4">
                {showingMain ? (
                  <>
                    {block.type === "text" && (
                      <TextEditor
                        value={block.textContent}
                        formatting={block.formatting}
                        onTextChange={(v) => update(index, { textContent: v })}
                        onFormatChange={(f) => update(index, { formatting: f })}
                      />
                    )}
                    {block.type === "long_text" && (
                      <div>
                        <FormatBar active={block.formatting} onChange={(f) => update(index, { formatting: f })} showHeading />
                        <Textarea
                          value={block.textContent}
                          onChange={(e) => update(index, { textContent: e.target.value })}
                          rows={10}
                          placeholder="Write your article content… Use # at the start of a line for headings."
                          className="bg-background border-border rounded-xl text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">No character limit. Use # prefix for headings.</p>
                      </div>
                    )}
                    {block.type === "file" && (
                      <FilePicker
                        file={block.file}
                        fileName={block.fileName}
                        fileSize={block.fileSize}
                        onFileChange={(f) =>
                          update(index, { file: f, fileName: f?.name, fileSize: f?.size })
                        }
                      />
                    )}
                    {block.type === "image" && (
                      <ImagePicker
                        imageFile={block.imageFile}
                        imagePreview={block.imagePreview}
                        imageDescription={block.imageDescription}
                        onImageChange={(f, preview) => update(index, { imageFile: f, imagePreview: preview })}
                        onDescriptionChange={(v) => update(index, { imageDescription: v })}
                      />
                    )}
                  </>
                ) : (
                  (() => {
                    const variation = block.variations.find((v) => v.label === activeTab);
                    if (!variation) return null;
                    return (
                      <div className="ml-3 pl-3 border-l-2 border-primary/20">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Variation {variation.label}
                        </p>
                        {/* Type selector for variation */}
                        <div className="flex gap-1 mb-3">
                          {(["text", "file", "image"] as BlockType[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateVariation(index, variation.id, { type: t })}
                              className={`text-xs px-2.5 py-1 rounded-md capitalize transition-colors ${
                                variation.type === t
                                  ? "bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <VariationEditor
                          variation={variation}
                          onUpdate={(patch) => updateVariation(index, variation.id, patch)}
                        />
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Add variation link */}
              <div className="px-4 pb-3">
                <button
                  type="button"
                  onClick={() => addVariation(index)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  · · · + Add variation
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add block buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock("text")} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Text
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock("long_text")} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Long Text
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock("file")} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> File
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock("image")} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Image
        </Button>
      </div>
    </div>
  );
}
