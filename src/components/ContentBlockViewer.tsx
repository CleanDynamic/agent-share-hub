import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerDownload } from "@/lib/download";
import { getBlockType } from "@/lib/content-types";
import { CommentsSection } from "@/components/CommentsSection";
import { MentionText } from "@/components/MentionText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Loader2, Eye, MessageCircle, ChevronRight, ClipboardList, Github, Cloud, ExternalLink } from "lucide-react";

// ─── Block icons ────────────────────────────────────────────

const BLOCK_ICONS: Record<string, string> = {
  prompt: '💬', agent_config: '🤖', workflow: '🔄',
  model_params: '⚙️', tool_setup: '🔧', code: '{ }',
  result: '📊', comparison: '↔', text: '¶',
  image: '🖼', resource: '🔗', section_heading: '§',
};

// ─── Types ──────────────────────────────────────────────────

interface BlockRow {
  id: string;
  position: number;
  block_type: string;
  text_content: string | null;
  formatting: any;
  formatting_type: string | null;
  sub_blocks: any;
  use_instructions: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  image_url: string | null;
  image_description: string | null;
  is_preview: boolean;
  external_file_url: string | null;
  github_url: string | null;
  subheading?: string | null;

  // Prompt
  prompt_role?: string | null;
  prompt_model?: string | null;
  prompt_variables?: any;
  prompt_example_output?: string | null;

  // Agent
  agent_model?: string | null;
  agent_temperature?: number | null;
  agent_max_tokens?: number | null;
  agent_tools?: any;
  agent_memory_type?: string | null;
  agent_capabilities?: any;

  // Workflow
  workflow_trigger?: string | null;
  workflow_output?: string | null;
  workflow_steps?: any;

  // Model params
  model_name?: string | null;
  model_temperature?: number | null;
  model_top_p?: number | null;
  model_max_tokens?: number | null;
  model_system_prompt?: string | null;
  model_stop_sequences?: any;
  model_reasoning?: string | null;

  // Tool setup
  tool_name?: string | null;
  tool_url?: string | null;
  tool_prerequisites?: any;
  tool_steps?: any;
  tool_errors?: any;
  tool_time_estimate?: string | null;

  // Code
  code_language?: string | null;
  code_dependencies?: any;
  code_env_vars?: any;
  code_run_instructions?: string | null;
  code_example_output?: string | null;

  // Result
  result_before?: string | null;
  result_after?: string | null;
  result_metrics?: any;
  result_verdict?: string | null;
  result_rating?: number | null;

  // Comparison
  comparison_label_a?: string | null;
  comparison_label_b?: string | null;
  comparison_type_a?: string | null;
  comparison_type_b?: string | null;
  comparison_content_a?: any;
  comparison_content_b?: any;
  comparison_axis?: string | null;
  comparison_verdict?: string | null;

  // Resource
  resource_title?: string | null;
  resource_type?: string | null;
  resource_annotation?: string | null;
  resource_is_paywalled?: boolean | null;

  // Group binding
  group_id?: string | null;
  group_title?: string | null;
}

interface VariationRow {
  id: string;
  block_id: string;
  variation_label: string;
  variation_type: string;
  text_content: string | null;
  formatting: any;
  file_url: string | null;
  file_name: string | null;
  image_url: string | null;
  image_description: string | null;
  position: number;
}

interface Props {
  contentId: string;
  contentTitle?: string;
  monetisationType: string;
  creatorId: string;
  useInstructions: string | null;
  onTriggerPaywall: () => void;
  isEligible?: boolean;
  contentType?: string;
  postType?: string;
}

// ─── Ad Modal ───────────────────────────────────────────────

function AdModal({ open, onComplete, label, countdownSeconds = 3 }: {
  open: boolean; onComplete: () => void; label: string; countdownSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(countdownSeconds);
  useEffect(() => {
    if (!open) { setSeconds(countdownSeconds); return; }
    if (seconds <= 0) { onComplete(); return; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, seconds, onComplete, countdownSeconds]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <div className="w-[320px] h-[100px] bg-muted/40 rounded-lg flex items-center justify-center border border-border">
          <span className="text-xs text-muted-foreground">Ad Space</span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Advertisement</p>
        <p className="text-sm text-foreground">
          {label} <span className="font-bold text-[#2EC4B6]">{seconds}</span>…
        </p>
        <a href="/login" className="text-xs text-muted-foreground hover:text-foreground underline">Sign in to skip ads</a>
      </div>
    </div>
  );
}

// ─── External host detection ────────────────────────────────

function detectHostName(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("drive.google.com")) return "Google Drive";
    if (hostname.includes("dropbox.com")) return "Dropbox";
    if (hostname.includes("mega.nz")) return "Mega";
    if (hostname.includes("onedrive.live.com")) return "OneDrive";
    if (hostname.includes("wetransfer.com")) return "WeTransfer";
    if (hostname.includes("github.com")) return "GitHub";
    return "External host";
  } catch {
    return "External host";
  }
}

// ─── GitHub block renderer ──────────────────────────────────

function RenderGitHubBlock({ textContent, subBlocks }: { textContent: string | null; subBlocks: any }) {
  if (!textContent) return null;
  const desc = Array.isArray(subBlocks) && subBlocks[0]?.description ? subBlocks[0].description : null;
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(36, 41, 47, 0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <a
        href={textContent}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "#2EC4B6", color: "#fff" }}
      >
        <Github className="h-4 w-4" />
        View on GitHub →
      </a>
      {desc && <p className="text-[13px] text-muted-foreground mt-2">{desc}</p>}
    </div>
  );
}

// ─── Large File block renderer ──────────────────────────────

function RenderLargeFileBlock({ textContent, subBlocks }: { textContent: string | null; subBlocks: any }) {
  if (!textContent) return null;
  const meta = Array.isArray(subBlocks) && subBlocks[0] ? subBlocks[0] : {};
  const platform = meta.platform || detectHostName(textContent);
  const customPlatform = meta.custom_platform;
  const description = meta.description;
  const sizeHint = meta.file_size_hint;
  const displayPlatform = platform === "Other" && customPlatform ? customPlatform : platform;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{displayPlatform}</span>
        {sizeHint && <span className="text-xs text-muted-foreground">{sizeHint}</span>}
      </div>
      {description && <p className="text-sm font-medium text-foreground mb-3">{description}</p>}
      <a
        href={textContent}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Download className="h-4 w-4" />
        Download from {displayPlatform} →
      </a>
    </div>
  );
}

// ─── Block content renderer ─────────────────────────────────

function RenderBlockContent({
  type, textContent, formatting, formattingType, subBlocks,
  fileUrl, fileName, fileSizeBytes, imageUrl, imageDescription, contentId, isBlogContent,
}: {
  type: string; textContent: string | null; formatting: any; formattingType: string | null;
  subBlocks: any; fileUrl: string | null; fileName: string | null; fileSizeBytes: number | null;
  imageUrl: string | null; imageDescription: string | null; contentId: string; isBlogContent?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (type === "image" && imageUrl) {
      supabase.storage.from("content-files").createSignedUrl(imageUrl, 300).then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    }
  }, [type, imageUrl]);

  // GitHub block
  if (type === "github") return <RenderGitHubBlock textContent={textContent} subBlocks={subBlocks} />;

  // Large File block
  if (type === "large_file") return <RenderLargeFileBlock textContent={textContent} subBlocks={subBlocks} />;

  if (type === "text" || type === "long_text") {
    const fmt = formattingType ?? formatting?.type ?? "paragraph";
    const items: string[] = formatting?.items ?? [];
    const text = textContent ?? "";
    const isLong = type === "long_text";

    if (isLong) {
      const paragraphs = text.split("\n\n").filter(Boolean);
      return (
        <div className="max-w-full" style={{ lineHeight: isBlogContent ? 1.85 : 1.8 }}>
          {paragraphs.map((p, i) => {
            if (p.startsWith("# ") || (formatting?.type === "heading" && i === 0))
              return <h3 key={i} className={`font-bold text-foreground mt-4 mb-2 ${isBlogContent ? "text-xl" : "text-lg"}`}>{p.replace(/^#\s*/, "")}</h3>;
            return <p key={i} className={`text-muted-foreground whitespace-pre-wrap ${isBlogContent ? "text-base mb-[1.4em]" : "text-sm mb-[1.2em]"}`}><MentionText text={p} /></p>;
          })}
        </div>
      );
    }

    if (fmt === "paragraph") return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"><MentionText text={text} /></p>;
    if (fmt === "bullets") return (
      <ul className="list-disc list-inside space-y-1">
        {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => <li key={i} className="text-sm text-muted-foreground"><MentionText text={line} /></li>)}
      </ul>
    );
    if (fmt === "numbers") return (
      <ol className="list-decimal list-inside space-y-1">
        {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => <li key={i} className="text-sm text-muted-foreground"><MentionText text={line} /></li>)}
      </ol>
    );
    if (fmt === "sub_list") {
      const parentLabel = text;
      const subs: string[] = Array.isArray(subBlocks) ? subBlocks : [];
      return (
        <div className="space-y-1">
          <p className="text-sm text-foreground font-medium"><MentionText text={parentLabel} /></p>
          {subs.length > 0 && (
            <div className="ml-6 space-y-0.5">
              {subs.map((s, si) => <p key={si} className="text-sm text-muted-foreground"><span className="text-muted-foreground/60 mr-1.5">↳</span>{s}</p>)}
            </div>
          )}
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap"><MentionText text={text} /></p>;
  }

  if (type === "file") {
    const handleFileDownload = async () => {
      if (!fileUrl) return;
      setDownloading(true);
      try {
        const { data } = await supabase.storage.from("content-files").createSignedUrl(fileUrl, 60);
        if (data?.signedUrl) {
          const a = document.createElement("a"); a.href = data.signedUrl; a.download = fileName ?? "download";
          document.body.appendChild(a); a.click(); a.remove();
        }
      } catch { /* ignore */ }
      setDownloading(false);
    };
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{fileName ?? "File"}</p>
          {fileSizeBytes != null && <p className="text-xs text-muted-foreground">{(fileSizeBytes / 1024).toFixed(1)} KB</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleFileDownload} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download
        </Button>
      </div>
    );
  }

  if (type === "prompt" || type === "agent_config") {
    const handleCopy = () => {
      navigator.clipboard.writeText(textContent ?? "").then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };
    return (
      <div style={{ position: 'relative', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14 }}>
        <button
          onClick={handleCopy}
          style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
        <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: 'rgba(255,255,255,0.80)', whiteSpace: 'pre-wrap', margin: 0, paddingRight: 110 }}>{textContent ?? ""}</pre>
      </div>
    );
  }

  if (type === "code") {
    const lang = (Array.isArray(subBlocks) && subBlocks[0]?.language) ? subBlocks[0].language : null;
    const handleCopy = () => {
      navigator.clipboard.writeText(textContent ?? "").then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };
    return (
      <div style={{ position: 'relative', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14 }}>
        {lang && (
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 8 }}>{lang}</span>
        )}
        <button
          onClick={handleCopy}
          style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
        <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: 'rgba(255,255,255,0.80)', whiteSpace: 'pre-wrap', margin: 0, paddingRight: 110 }}>{textContent ?? ""}</pre>
      </div>
    );
  }

  if (type === "comparison") {
    const sides = Array.isArray(subBlocks) ? subBlocks : [];
    const sideA = sides[0] ?? {};
    const sideB = sides[1] ?? {};
    const aText = sideA.content ?? sideA.text ?? (typeof sideA === 'string' ? sideA : null) ?? textContent ?? "";
    const bText = sideB.content ?? sideB.text ?? (typeof sideB === 'string' ? sideB : null) ?? "";
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>A</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', margin: 0 }}>{aText}</p>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>B</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap', margin: 0 }}>{bText}</p>
        </div>
      </div>
    );
  }

  if (type === "resource") {
    const url = textContent ?? "";
    const description = (Array.isArray(subBlocks) && subBlocks[0]?.description)
      ? subBlocks[0].description
      : imageDescription;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, textDecoration: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExternalLink style={{ width: 14, height: 14, color: '#2EC4B6', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#2EC4B6', wordBreak: 'break-all' }}>{url}</span>
        </div>
        {description && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', margin: 0 }}>{description}</p>}
      </a>
    );
  }

  if (type === "image") {
    return (
      <div>
        {signedUrl ? <img src={signedUrl} alt={imageDescription ?? ""} className="w-full rounded-lg object-contain" /> : <Skeleton className="w-full h-48 rounded-lg" />}
        {imageDescription && <p className="text-xs text-muted-foreground mt-2 italic">{imageDescription}</p>}
      </div>
    );
  }

  return null;
}

// ─── Prompt viewer ──────────────────────────────────────────

const PromptViewer = ({ block }: { block: BlockRow }) => {
  const [copied, setCopied] = React.useState(false);
  const [filled, setFilled] = React.useState<Record<string, string>>({});
  const variables = block.prompt_variables ?? [];

  const getFilledPrompt = () => {
    let p = block.text_content ?? '';
    Object.entries(filled).forEach(([k, v]) => {
      p = p.split(`{{${k}}}`).join(v);
    });
    return p;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFilledPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const highlightVars = (text: string) => {
    return text.replace(
      /\{\{(\w+)\}\}/g,
      '<mark style="background:rgba(46,196,182,0.20);color:#2EC4B6;border-radius:3px;padding:1px 4px">{{$1}}</mark>'
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {block.prompt_role && (
          <span style={{
            padding: '2px 10px', borderRadius: 9999, fontSize: 11,
            fontWeight: 700, textTransform: 'uppercase',
            background: 'rgba(232,87,26,0.15)',
            border: '1px solid rgba(232,87,26,0.30)',
            color: '#E8571A',
          }}>
            {block.prompt_role}
          </span>
        )}
        {block.prompt_model && (
          <span style={{
            padding: '2px 10px', borderRadius: 9999, fontSize: 11,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.60)',
          }}>
            {block.prompt_model}
          </span>
        )}
      </div>

      {variables.length > 0 && (
        <div style={{
          padding: '10px 12px', marginBottom: 12,
          background: 'rgba(46,196,182,0.05)',
          border: '1px solid rgba(46,196,182,0.15)',
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: '#2EC4B6', marginBottom: 8,
          }}>
            Fill in variables
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {variables.map((v: { name: string; description: string }) => (
              <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{
                  fontSize: 12, color: '#2EC4B6', flexShrink: 0,
                  fontFamily: 'Courier New, monospace',
                }}>
                  {`{{${v.name}}}`}
                </code>
                <input
                  value={filled[v.name] ?? ''}
                  onChange={e => setFilled(f => ({ ...f, [v.name]: e.target.value }))}
                  placeholder={v.description || `Enter ${v.name}`}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(46,196,182,0.25)',
                    borderRadius: 6, padding: '4px 8px', fontSize: 12,
                    color: '#fff', outline: 'none',
                  }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div
          dangerouslySetInnerHTML={{ __html: highlightVars(getFilledPrompt()) }}
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8, padding: '14px',
            fontSize: 13, color: 'rgba(255,255,255,0.85)',
            fontFamily: 'Courier New, monospace',
            lineHeight: 1.7, whiteSpace: 'pre-wrap',
            minHeight: 80,
          }} />
        <button onClick={handleCopy} style={{
          position: 'absolute', top: 10, right: 10,
          padding: '3px 10px', borderRadius: 6, fontSize: 11,
          background: copied ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.40)' : 'rgba(255,255,255,0.15)'}`,
          color: copied ? '#22C55E' : 'rgba(255,255,255,0.60)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {block.prompt_example_output && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.28)',
            marginBottom: 8,
          }}>
            Example output
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '10px 12px',
            fontSize: 13, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.65, whiteSpace: 'pre-wrap',
          }}>
            {block.prompt_example_output}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Workflow viewer ────────────────────────────────────────

const WorkflowViewer = ({ block }: { block: BlockRow }) => {
  const steps = block.workflow_steps ?? [];
  const STEP_COLORS: Record<string, string> = {
    manual: '#9CA3AF', ai: '#2EC4B6',
    automated: '#3B82F6', decision: '#F59E0B',
  };
  const STEP_EMOJIS: Record<string, string> = {
    manual: '👤', ai: '🤖', automated: '⚡', decision: '◆',
  };

  return (
    <div>
      {block.workflow_trigger && (
        <div style={{
          padding: '10px 14px', marginBottom: 16,
          background: 'rgba(232,87,26,0.08)',
          border: '1px solid rgba(232,87,26,0.20)',
          borderRadius: 8, fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: '#E8571A',
            display: 'block', marginBottom: 4,
          }}>
            Trigger
          </span>
          {block.workflow_trigger}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step: any, i: number) => {
          const color = STEP_COLORS[step.stepType] ?? '#9CA3AF';
          const emoji = STEP_EMOJIS[step.stepType] ?? '●';
          const isDecision = step.stepType === 'decision';
          return (
            <div key={step.id ?? i}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', flexShrink: 0,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${color}20`,
                    border: `2px solid ${color}50`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color,
                  }}>
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{
                      width: 2, flex: 1, minHeight: 20,
                      background: `${color}25`, margin: '4px 0',
                    }} />
                  )}
                </div>

                <div style={{
                  flex: 1, paddingBottom: 16,
                  borderLeft: `2px solid ${color}15`,
                  paddingLeft: 12, marginLeft: -12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{emoji}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: 'rgba(255,255,255,0.90)',
                    }}>
                      {step.title}
                    </span>
                    {step.tool && (
                      <span style={{
                        fontSize: 11, padding: '1px 8px',
                        borderRadius: 9999,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.40)',
                      }}>
                        {step.tool}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.6, margin: '6px 0 0 22px',
                    }}>
                      {step.description}
                    </p>
                  )}
                  {isDecision && (step.decisionYes || step.decisionNo) && (
                    <div style={{
                      display: 'flex', gap: 8, marginTop: 8, marginLeft: 22,
                    }}>
                      {step.decisionYes && (
                        <div style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          background: 'rgba(34,197,94,0.10)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          color: '#22C55E',
                        }}>
                          ✓ {step.decisionYes}
                        </div>
                      )}
                      {step.decisionNo && (
                        <div style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          background: 'rgba(239,68,68,0.10)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#EF4444',
                        }}>
                          ✗ {step.decisionNo}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {block.workflow_output && (
        <div style={{
          padding: '10px 14px', marginTop: 8,
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.20)',
          borderRadius: 8, fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: '#22C55E',
            display: 'block', marginBottom: 4,
          }}>
            Output
          </span>
          {block.workflow_output}
        </div>
      )}
    </div>
  );
};

// ─── Code viewer ────────────────────────────────────────────

const CodeViewer = ({ block }: { block: BlockRow }) => {
  const [copied, setCopied] = React.useState(false);
  const deps = block.code_dependencies ?? [];

  return (
    <div>
      {block.code_language && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            padding: '2px 10px', borderRadius: 9999, fontSize: 11,
            fontWeight: 700, textTransform: 'uppercase',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.30)',
            color: '#3B82F6',
          }}>
            {block.code_language}
          </span>
        </div>
      )}

      {deps.length > 0 && (
        <div style={{
          padding: '8px 10px', marginBottom: 10,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6, fontSize: 12,
          color: 'rgba(255,255,255,0.50)',
          fontFamily: 'Courier New, monospace',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
            fontFamily: 'Inter',
          }}>
            Install
          </span>{' '}
          {deps.join('  ')}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <pre style={{
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 8, padding: '14px',
          fontSize: 12, color: '#A5F3FC',
          fontFamily: 'Courier New, monospace',
          lineHeight: 1.6, overflowX: 'auto',
          whiteSpace: 'pre', margin: 0,
        }}>
          {block.text_content}
        </pre>
        <button onClick={() => {
          navigator.clipboard.writeText(block.text_content ?? '');
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }} style={{
          position: 'absolute', top: 10, right: 10,
          padding: '3px 10px', borderRadius: 6, fontSize: 11,
          background: copied ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.40)' : 'rgba(255,255,255,0.15)'}`,
          color: copied ? '#22C55E' : 'rgba(255,255,255,0.60)',
          cursor: 'pointer',
        }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {block.code_run_instructions && (
        <div style={{
          marginTop: 10, fontSize: 13,
          color: 'rgba(255,255,255,0.55)', lineHeight: 1.6,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: 'rgba(255,255,255,0.28)',
            display: 'block', marginBottom: 4,
          }}>Run</span>
          {block.code_run_instructions}
        </div>
      )}

      {block.code_example_output && (
        <pre style={{
          marginTop: 10,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6, padding: '8px 12px',
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          fontFamily: 'Courier New, monospace',
          lineHeight: 1.5, overflowX: 'auto',
          whiteSpace: 'pre',
        }}>
          {block.code_example_output}
        </pre>
      )}
    </div>
  );
};

// ─── Result viewer ──────────────────────────────────────────

const ResultViewer = ({ block }: { block: BlockRow }) => (
  <div>
    {block.result_before && (
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.10em', color: '#EF4444', marginBottom: 6,
        }}>Before</div>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 8, fontSize: 13,
          color: 'rgba(255,255,255,0.70)',
          lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          {block.result_before}
        </div>
      </div>
    )}
    {block.result_after && (
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.10em', color: '#22C55E', marginBottom: 6,
        }}>Output</div>
        <div style={{ position: 'relative' }}>
          <div style={{
            padding: '10px 12px',
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 8, fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.65, whiteSpace: 'pre-wrap',
          }}>
            {block.result_after}
          </div>
          <button onClick={() => navigator.clipboard.writeText(block.result_after ?? '')}
            style={{
              position: 'absolute', top: 8, right: 8,
              padding: '2px 8px', borderRadius: 6, fontSize: 10,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
            }}>Copy</button>
        </div>
      </div>
    )}
    {block.result_verdict && (
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, fontSize: 13, fontStyle: 'italic',
        color: 'rgba(255,255,255,0.55)', lineHeight: 1.6,
      }}>
        {block.result_verdict}
      </div>
    )}
    {(block.result_rating ?? 0) > 0 && (
      <div style={{ marginTop: 8, fontSize: 16 }}>
        {Array.from({ length: 5 }, (_, i) =>
          i < (block.result_rating ?? 0) ? '★' : '☆'
        ).join('')}
      </div>
    )}
  </div>
);

// ─── Comparison viewer ──────────────────────────────────────

const ComparisonViewer = ({ block }: { block: BlockRow }) => {
  const contentA = block.comparison_content_a ?? {};
  const contentB = block.comparison_content_b ?? {};

  const SideCard = ({ label, content }: {
    label: string; content: Record<string, any>;
  }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'rgba(255,255,255,0.50)',
        marginBottom: 8, textAlign: 'center',
      }}>
        {label}
      </div>
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, fontSize: 13,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 1.65, whiteSpace: 'pre-wrap',
        fontFamily: 'Courier New, monospace',
        minHeight: 80,
      }}>
        {content.text ?? ''}
      </div>
    </div>
  );

  return (
    <div>
      {block.comparison_axis && (
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.35)',
          textAlign: 'center', marginBottom: 12,
          fontStyle: 'italic',
        }}>
          Comparing: {block.comparison_axis}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SideCard
          label={block.comparison_label_a ?? 'Option A'}
          content={contentA}
        />
        <div style={{
          color: 'rgba(255,255,255,0.20)',
          fontSize: 20, paddingTop: 28, flexShrink: 0,
        }}>↔</div>
        <SideCard
          label={block.comparison_label_b ?? 'Option B'}
          content={contentB}
        />
      </div>
      {block.comparison_verdict && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 8, fontSize: 13, fontStyle: 'italic',
          color: 'rgba(255,255,255,0.65)',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.10em', color: '#F59E0B',
            display: 'block', marginBottom: 4, fontStyle: 'normal',
          }}>Verdict</span>
          {block.comparison_verdict}
        </div>
      )}
    </div>
  );
};

// ─── Resource viewer ────────────────────────────────────────

const ResourceViewer = ({ block }: { block: BlockRow }) => {
  const TYPE_ICONS: Record<string, string> = {
    paper: '📄', tool: '🔧', video: '🎬',
    course: '🎓', repo: '📦', article: '📰', other: '🔗',
  };

  return (
    <a href={block.text_content ?? '#'} target="_blank" rel="noopener"
      style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        padding: '14px 16px',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.20)',
        borderRadius: 10, cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.40)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.20)'}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
        }}>
          <span style={{ fontSize: 20 }}>
            {TYPE_ICONS[block.resource_type ?? 'other'] ?? '🔗'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: 'rgba(255,255,255,0.90)',
              whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {block.resource_title || block.text_content}
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.35)',
              whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {block.text_content}
            </div>
          </div>
          {block.resource_is_paywalled && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.30)',
              color: '#F59E0B',
            }}>
              £ Paid
            </span>
          )}
        </div>
        {block.resource_annotation && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.6, margin: '0 0 0 30px',
          }}>
            {block.resource_annotation}
          </p>
        )}
      </div>
    </a>
  );
};

// ─── Per-type viewer dispatch ───────────────────────────────

function renderTypedViewer(block: BlockRow): JSX.Element | null {
  switch (block.block_type) {
    case 'prompt':
      return <PromptViewer block={block} />;
    case 'workflow':
      return <WorkflowViewer block={block} />;
    case 'code':
      return <CodeViewer block={block} />;
    case 'result':
      return <ResultViewer block={block} />;
    case 'comparison':
      return <ComparisonViewer block={block} />;
    case 'resource':
      return <ResourceViewer block={block} />;
    default:
      return null;
  }
}

// ─── Main component ─────────────────────────────────────────

export function ContentBlockViewer({
  contentId, contentTitle = "", monetisationType, creatorId,
  useInstructions, onTriggerPaywall, isEligible = false, contentType, postType,
}: Props) {
  const { isLoggedIn, profile } = useAuth();
  const isBlog = contentType === "Blog";
  const [unblurred, setUnblurred] = useState<Record<string, boolean>>({});
  const [adModal, setAdModal] = useState<{ blockId: string; phase: 1 | 2 } | null>(null);

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["content_blocks", contentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_blocks").select("*").eq("content_id", contentId).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BlockRow[];
    },
  });

  const blockIds = blocks?.map((b) => b.id) ?? [];
  const { data: variations } = useQuery({
    queryKey: ["block_variations", contentId, blockIds.join(",")],
    queryFn: async () => {
      if (blockIds.length === 0) return [] as VariationRow[];
      const { data, error } = await supabase.from("block_variations").select("*").in("block_id", blockIds).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VariationRow[];
    },
    enabled: blockIds.length > 0,
  });

  const isFree = monetisationType === "free" || monetisationType === "donation";
  const { data: hasPurchased } = useQuery({
    queryKey: ["user_has_downloaded", contentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("downloads").select("id").eq("content_id", contentId).eq("user_id", user.id).limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const { data: hasSubscription } = useQuery({
    queryKey: ["viewer_subscription_check", creatorId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("subscriptions").select("id").eq("subscriber_id", user.id).eq("creator_id", creatorId).eq("status", "active").limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const paidAndUnlocked = !isFree && (hasPurchased === true || hasSubscription === true);

  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [blockCommentsOpen, setBlockCommentsOpen] = useState<Record<string, boolean>>({});
  const [blockInstrOpen, setBlockInstrOpen] = useState<Record<string, boolean>>({});

  const insertAdImpression = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ad_impressions").insert({ content_id: contentId, user_id: user?.id ?? null, shown_at: new Date().toISOString() });
  }, [contentId]);

  const guestAdKey = `neoscale_page_ad_shown_${contentId}`;
  const guestPageAdShown = () => sessionStorage.getItem(guestAdKey) === "true";
  const markGuestPageAd = () => sessionStorage.setItem(guestAdKey, "true");

  const handleViewClick = useCallback(
    (blockId: string) => {
      if (!isFree && !paidAndUnlocked) { onTriggerPaywall(); return; }
      if (!isFree && paidAndUnlocked) { setUnblurred((p) => ({ ...p, [blockId]: true })); return; }
      if (!isLoggedIn) {
        if (guestPageAdShown()) { setUnblurred((p) => ({ ...p, [blockId]: true })); return; }
        setAdModal({ blockId, phase: 1 }); insertAdImpression(); return;
      }
      setAdModal({ blockId, phase: 1 }); insertAdImpression();
    },
    [isFree, paidAndUnlocked, isLoggedIn, insertAdImpression, onTriggerPaywall, contentId]
  );

  const handleAdComplete = useCallback(() => {
    if (!adModal) return;
    if (!isLoggedIn) { markGuestPageAd(); setUnblurred((p) => ({ ...p, [adModal.blockId]: true })); setAdModal(null); return; }
    setUnblurred((p) => ({ ...p, [adModal.blockId]: true })); setAdModal(null);
  }, [adModal, isLoggedIn, contentId]);

  if (blocksLoading) {
    return (
      <div>
        <div className="space-y-3"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    if (!useInstructions) return null;
    return (
      <div>
        <div className="border border-[#1E1E2A] rounded-xl p-5 bg-[#111118]">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-[inherit] leading-relaxed">{useInstructions}</pre>
        </div>
      </div>
    );
  }

  // Group consecutive child blocks that share a group_id into a single
  // RenderItem. The group heading (section_heading with group_id) is skipped
  // because the group container renders the title itself.
  type RenderItem =
    | { kind: 'block'; block: BlockRow }
    | { kind: 'group'; title: string; groupId: string; blocks: BlockRow[] };

  const groupedItems: RenderItem[] = [];
  const seenGroups = new Set<string>();
  (blocks ?? []).forEach((block) => {
    if (block.group_id && block.block_type !== 'section_heading') {
      if (!seenGroups.has(block.group_id)) {
        seenGroups.add(block.group_id);
        const groupBlocks = (blocks ?? []).filter(
          (b) => b.group_id === block.group_id && b.block_type !== 'section_heading'
        );
        groupedItems.push({
          kind: 'group',
          title: block.group_title ?? '',
          groupId: block.group_id,
          blocks: groupBlocks,
        });
      }
    } else if (block.block_type === 'section_heading' && block.group_id) {
      // Skip — the group heading is rendered by the group container.
    } else {
      groupedItems.push({ kind: 'block', block });
    }
  });

  const renderBlockRow = (block: BlockRow, index: number): JSX.Element => {
    const blockVariations = (variations ?? []).filter((v) => v.block_id === block.id);
            const hasVars = blockVariations.length > 0;
            const currentTab = activeTab[block.id] ?? "A";
            const isPreview = !!block.is_preview;
            const isGitHub = block.block_type === "github";
            // GitHub blocks are NEVER blurred
            const isUnblurred = isBlog || isPreview || isGitHub || !!unblurred[block.id];

            const showingVariation = currentTab !== "A" ? blockVariations.find((v) => v.variation_label === currentTab) : null;
            const effectiveType = showingVariation ? showingVariation.variation_type : block.block_type;

            if (block.block_type === 'section_heading') {
              return (
                <div
                  key={block.id}
                  id={`block-${block.id}`}
                  style={{ margin: '28px 0 16px 0' }}
                >
                  {/* Hairline above */}
                  <div style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.07)',
                    marginBottom: 14,
                  }} />
                  <h2 style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.92)',
                    margin: 0,
                    lineHeight: 1.25,
                  }}>
                    {block.text_content}
                  </h2>
                </div>
              );
            }

            return (
              <div key={block.id} id={`block-${block.id}`} style={{ marginBottom: 24 }}>
                {/* Step marker separator */}
                {(() => {
                  const stepStyle = postType === 'build' ? 'numbered'
                    : postType === 'discussion' ? 'none'
                    : 'dot';
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      marginBottom: 14,
                    }}>
                      {/* Step marker */}
                      {stepStyle !== 'none' && (
                        <div style={{
                          width: stepStyle === 'numbered' ? 22 : 8,
                          height: stepStyle === 'numbered' ? 22 : 8,
                          borderRadius: '50%',
                          background: stepStyle === 'numbered'
                            ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.15)',
                          border: stepStyle === 'numbered'
                            ? '1px solid rgba(232,87,26,0.30)'
                            : '1px solid rgba(255,255,255,0.20)',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                          color: stepStyle === 'numbered' ? '#E8571A' : 'transparent',
                          flexShrink: 0,
                        }}>
                          {stepStyle === 'numbered' ? index + 1 : ''}
                        </div>
                      )}

                      {/* Block type label */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)',
                      }}>
                        <span>{BLOCK_ICONS[effectiveType] ?? '◆'}</span>
                        <span>{getBlockType(effectiveType).label}</span>
                      </div>

                      {/* Line */}
                      <div style={{
                        flex: 1, height: 1,
                        background: 'rgba(255,255,255,0.05)',
                      }} />
                    </div>
                  );
                })()}

                <div className={`border rounded-xl overflow-hidden ${isPreview ? "border-[#2EC4B6]/40 bg-[#111118]" : "border-[#1E1E2A] bg-[#111118]"}`}>
                  {/* Variation tabs */}
                  {hasVars && (
                    <div className="flex gap-1 px-4 pt-3 pb-1">
                      <button type="button" onClick={() => setActiveTab((p) => ({ ...p, [block.id]: "A" }))}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${currentTab === "A" ? "font-medium border-b-2" : "text-muted-foreground hover:text-foreground"}`}
                        style={currentTab === "A" ? { color: "#E8571A", borderColor: "#E8571A" } : {}}>A</button>
                      {blockVariations.map((v) => (
                        <button key={v.id} type="button" onClick={() => setActiveTab((p) => ({ ...p, [block.id]: v.variation_label }))}
                          className={`text-xs px-3 py-1 rounded-md transition-colors ${currentTab === v.variation_label ? "font-medium border-b-2" : "text-muted-foreground hover:text-foreground"}`}
                          style={currentTab === v.variation_label ? { color: "#E8571A", borderColor: "#E8571A" } : {}}>{v.variation_label}</button>
                      ))}
                    </div>
                  )}

                  {/* Block content with blur */}
                  <div className="p-5 relative min-h-[80px]">
                    <div className={isUnblurred ? "" : "blur-[6px] pointer-events-none select-none"} style={{ transition: "filter 0.3s ease" }}>
                      {block.subheading && !showingVariation && (
                        <h3 style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: 17, fontWeight: 600,
                          color: 'rgba(255,255,255,0.92)',
                          margin: '0 0 12px 0',
                          paddingBottom: 8,
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          lineHeight: 1.3,
                        }}>
                          {block.subheading}
                        </h3>
                      )}
                      {showingVariation ? (
                        <RenderBlockContent type={showingVariation.variation_type} textContent={showingVariation.text_content} formatting={showingVariation.formatting}
                          formattingType={null} subBlocks={null} fileUrl={showingVariation.file_url} fileName={showingVariation.file_name} fileSizeBytes={null}
                          imageUrl={showingVariation.image_url} imageDescription={showingVariation.image_description} contentId={contentId} isBlogContent={isBlog} />
                      ) : (
                        renderTypedViewer(block) ?? (
                          <RenderBlockContent type={block.block_type} textContent={block.text_content} formatting={block.formatting}
                            formattingType={block.formatting_type} subBlocks={block.sub_blocks} fileUrl={block.file_url} fileName={block.file_name}
                            fileSizeBytes={block.file_size_bytes} imageUrl={block.image_url} imageDescription={block.image_description} contentId={contentId} isBlogContent={isBlog} />
                        )
                      )}
                    </div>

                    {/* External file download button */}
                    {isUnblurred && block.external_file_url && (
                      <div className="mt-3 px-1">
                        <a href={block.external_file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-accent/60"
                          style={{ borderColor: "#2EC4B6", color: "#2EC4B6" }}>
                          <Download className="h-3.5 w-3.5" />Download from {detectHostName(block.external_file_url)} →
                        </a>
                      </div>
                    )}

                    {/* Legacy GitHub pill (for old blocks that still have github_url) */}
                    {isUnblurred && block.github_url && block.block_type !== "github" && (
                      <div className="mt-2 px-1">
                        <a href={block.github_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline" style={{ color: "#2EC4B6" }}>
                          🐙 View on GitHub →
                        </a>
                      </div>
                    )}

                    {/* View button overlay — not shown for preview blocks, blogs, or GitHub blocks */}
                    {!isUnblurred && !isPreview && !isBlog && !isGitHub && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button onClick={() => handleViewClick(block.id)} className="gap-2 rounded-full px-5 h-8 text-[13px] font-medium text-white bg-secondary hover:bg-secondary/90">
                          <Eye className="h-3.5 w-3.5" />Reveal
                        </Button>
                      </div>
                    )}

                    {/* Block-level comments toggle */}
                    {isUnblurred && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {block.use_instructions && (
                          <div>
                            <button onClick={() => setBlockInstrOpen((p) => ({ ...p, [block.id]: !p[block.id] }))}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <ClipboardList className="h-3 w-3" />
                              <ChevronRight className={`h-3 w-3 transition-transform ${blockInstrOpen[block.id] ? "rotate-90" : ""}`} />
                              📋 How to use this step
                            </button>
                            {blockInstrOpen[block.id] && (
                              <p className="text-sm text-muted-foreground italic mt-2 ml-5 whitespace-pre-wrap">{block.use_instructions}</p>
                            )}
                          </div>
                        )}
                        <button onClick={() => setBlockCommentsOpen((p) => ({ ...p, [block.id]: !p[block.id] }))}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <MessageCircle className="h-3 w-3" />
                          {blockCommentsOpen[block.id] ? "Hide comments" : "Comment on this block"}
                        </button>
                        {blockCommentsOpen[block.id] && (
                          <div className="mt-3">
                            <CommentsSection contentId={contentId} contentTitle={contentTitle} blockId={block.id} commentCount={0} isEligible={isEligible} compact />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
  };

  return (
    <div>
      <AdModal open={!!adModal} onComplete={handleAdComplete} label="Your content unblurs in" countdownSeconds={3} />

      <div>
        <div className="space-y-4">
          {groupedItems.map((item, idx) => {
            if (item.kind === 'group') {
              return (
                <div
                  key={item.groupId}
                  id={`block-${item.groupId}`}
                  style={{
                    margin: '24px 0',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {/* Group heading */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'rgba(255,255,255,0.25)',
                      marginBottom: 3,
                    }}>
                      ▤ Group
                    </div>
                    <h3 style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 16, fontWeight: 700,
                      color: 'rgba(255,255,255,0.88)',
                      margin: 0, lineHeight: 1.3,
                    }}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Group child blocks */}
                  <div style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}>
                    {item.blocks.map((block, bi) => (
                      <div key={block.id}>
                        {/* Step marker inside group */}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          gap: 8, marginBottom: 10,
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                            color: 'rgba(255,255,255,0.35)', flexShrink: 0,
                          }}>
                            {bi + 1}
                          </div>
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.10em',
                            color: 'rgba(255,255,255,0.22)',
                          }}>
                            {BLOCK_ICONS[block.block_type] ?? '◆'}{' '}
                            {block.block_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {renderTypedViewer(block) ?? (
                          <RenderBlockContent
                            type={block.block_type}
                            textContent={block.text_content}
                            formatting={block.formatting}
                            formattingType={block.formatting_type}
                            subBlocks={block.sub_blocks}
                            fileUrl={block.file_url}
                            fileName={block.file_name}
                            fileSizeBytes={block.file_size_bytes}
                            imageUrl={block.image_url}
                            imageDescription={block.image_description}
                            contentId={contentId}
                            isBlogContent={isBlog}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return renderBlockRow(item.block, idx);
          })}
        </div>
      </div>
    </div>
  );
}
