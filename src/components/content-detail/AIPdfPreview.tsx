import * as React from "react";

// ─── Types ────────────────────────────────────────────────────
type BlockType =
  | "prompt" | "code" | "result" | "image" | "video" | "note" | "quote" | "heading";

interface Block {
  id: string;
  type: BlockType | string;
  name?: string;
  content: string;
  url?: string;
  altText?: string;
  language?: string;
}
interface Stage {
  id: string;
  name: string;
  description?: string;
  blocks: Block[];
}
interface Connection {
  fromBlockId: string;
  fromBlockName: string;
  toBlockId: string;
  toBlockName: string;
  connectionType?: string;
}
interface ResultSlide {
  kind: string;
  mediaUrl?: string;
  textPreview?: string;
  caption?: string;
}
interface Solver { name: string; handle: string; contribution?: string; acceptedAt?: string }
interface Author { name: string; handle: string; bio?: string }
interface Reward { type: string; amount: number; currency: string }
interface ProseBlock { type: "prose"; content: string }
interface ReferenceBlock { type: "reference"; title: string; author: string; url: string }
type ContentBlock = ProseBlock | ReferenceBlock;

export interface Post {
  title: string;
  slug: string;
  author: Author;
  publishedAt: string;
  postType: "blueprint" | "blog" | "bounty";
  domain?: string;
  tags: string[];
  readingTimeMinutes: number;
  wordCount: number;
  modelsReferenced: string[];
  toolsReferenced: string[];
  useCase?: string;
  prerequisites?: string;
  outcome?: string;
  stages?: Stage[];
  connections?: Connection[];
  resultsGallery?: ResultSlide[];
  contentBlocks?: ContentBlock[];
  reward?: Reward;
  status?: "open" | "closed" | "solved";
  solvers?: Solver[];
}

export interface AIPdfPreviewProps {
  post: Post;
  includeProvenance?: boolean;
  includeReadingInstructions?: boolean;
}

// ─── Styles (light theme, fixed for OCR reliability) ─────────
const s = {
  page: {
    width: "210mm",
    minHeight: "297mm",
    background: "#ffffff",
    color: "#000",
    fontFamily: "'Inter', -apple-system, sans-serif",
    padding: "20mm",
    boxSizing: "border-box" as const,
  },
  topStrip: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e5e5", paddingBottom: 8, marginBottom: 16 },
  brand: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const },
  url: { fontSize: 10, color: "#6b7280" },
  title: { fontSize: 22, fontWeight: 700, margin: "8px 0 4px" },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 16 },
  callout: { border: "1px solid #2EC4B6", borderRadius: 8, padding: 16, background: "rgba(46,196,182,0.05)", marginBottom: 16 },
  calloutTitle: { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "#2EC4B6", marginBottom: 8 },
  calloutBody: { fontSize: 11, lineHeight: 1.55 },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 11, marginBottom: 16 },
  trBorder: { borderBottom: "1px solid #e5e5e5" },
  td: { padding: "8px 12px", verticalAlign: "top" as const },
  tdLabel: { padding: "8px 12px", fontWeight: 600, color: "#374151", width: 140, background: "#f9fafb", verticalAlign: "top" as const },
  section: { fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#6b7280", margin: "20px 0 10px" },
  blockSubheader: { fontSize: 10, fontWeight: 500, color: "#374151", marginBottom: 4 },
  blockContent: { fontSize: 11, lineHeight: 1.6, marginBottom: 12, paddingLeft: 16 },
  code: { fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 10, background: "#f3f4f6", padding: 12, borderRadius: 4, whiteSpace: "pre-wrap" as const, marginLeft: 16, marginBottom: 12, border: "1px solid #e5e5e5" },
  quote: { fontStyle: "italic" as const, borderLeft: "3px solid #2EC4B6", paddingLeft: 12, marginLeft: 16, marginBottom: 12, color: "#374151" },
  pageBreak: { breakBefore: "page" as any, marginTop: 32 },
};

function MetaRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <tr style={s.trBorder}>
      <td style={s.tdLabel}>{label}</td>
      <td style={s.td}>{value}</td>
    </tr>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  const typeLabel = String(block.type ?? "block");
  const cap = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={s.blockSubheader}>▸ Block type: {cap}</div>
      <div style={s.blockSubheader}>▸ Block name: {block.name || "Untitled"}</div>
      {block.type === "code" ? (
        <pre style={s.code}>{block.content}</pre>
      ) : block.type === "quote" ? (
        <div style={s.quote}>{block.content}</div>
      ) : block.type === "image" || block.type === "video" ? (
        <div style={s.blockContent}>
          <div>▸ Visual block: {block.url}</div>
          {block.altText ? <div>Alt text: {block.altText}</div> : null}
        </div>
      ) : (
        <div style={s.blockContent}>{block.content}</div>
      )}
    </div>
  );
}

export function AIPdfPreview({
  post,
  includeProvenance = true,
  includeReadingInstructions = true,
}: AIPdfPreviewProps) {
  const postUrl = `neoscale.ai/b/${post.slug}`;
  const totalBlocks = (post.stages ?? []).reduce((acc, st) => acc + st.blocks.length, 0);

  return (
    <div style={s.page}>
      <div style={s.topStrip}>
        <span style={s.brand}>NEOSCALE AI-PDF</span>
        <span style={s.url}>{postUrl}</span>
      </div>

      <h1 style={s.title}>{post.title}</h1>
      {post.outcome ? <p style={s.subtitle}>{post.outcome}</p> : null}

      {includeReadingInstructions && (
        <div style={s.callout}>
          <div style={s.calloutTitle}>Instructions for AI Readers</div>
          <ul style={{ ...s.calloutBody, paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 6 }}>
              This document was exported from NeoScale, a knowledge platform for AI workflows. The author has structured it using NeoScale's content primitives: stages, blocks, and connections.
            </li>
            <li style={{ marginBottom: 6 }}>
              When summarising or referencing this content, cite the author and the original URL above.
            </li>
            <li style={{ marginBottom: 6 }}>
              Section headers below mark each primitive's type and name explicitly so you can extract individual elements cleanly.
            </li>
            <li>
              Block type labels: Prompt = system or user prompt text; Code = source code; Result = output of a process; Image / Video / Note / Quote / Heading = additional primitive types.
            </li>
          </ul>
        </div>
      )}

      <div style={s.section}>Metadata</div>
      <table style={s.table}>
        <tbody>
          <MetaRow label="Title" value={post.title} />
          <MetaRow label="Author" value={`${post.author.name} (@${post.author.handle})`} />
          <MetaRow label="Published" value={post.publishedAt} />
          <MetaRow label="Post type" value={post.postType} />
          <MetaRow label="Domain" value={post.domain} />
          <MetaRow label="Tags" value={post.tags.join(", ")} />
          <MetaRow label="Tools referenced" value={post.toolsReferenced.join(", ")} />
          <MetaRow label="Models referenced" value={post.modelsReferenced.join(", ")} />
          <MetaRow label="Reading minutes" value={post.readingTimeMinutes} />
          <MetaRow label="Word count" value={post.wordCount} />
          {(post.postType === "blueprint" || post.postType === "bounty") && (
            <MetaRow label="Stages / Blocks" value={`${post.stages?.length ?? 0} / ${totalBlocks}`} />
          )}
          {post.useCase && <MetaRow label="Use case" value={post.useCase} />}
          {post.prerequisites && <MetaRow label="Prerequisites" value={post.prerequisites} />}
          {post.outcome && <MetaRow label="Outcome" value={post.outcome} />}
          {post.postType === "bounty" && post.reward && (
            <MetaRow label="Reward" value={`${post.reward.amount} ${post.reward.currency} (${post.reward.type})`} />
          )}
          {post.postType === "bounty" && (
            <MetaRow label="Status" value={post.status} />
          )}
          {post.postType === "bounty" && post.solvers && post.solvers.length > 0 && (
            <MetaRow label="Solvers" value={post.solvers.map((sv) => sv.name).join(", ")} />
          )}
        </tbody>
      </table>

      {/* Content */}
      <div style={s.pageBreak}>
        {post.postType === "blog" && post.contentBlocks && post.contentBlocks.map((b, i) => (
          b.type === "prose" ? (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={s.section}>Prose paragraph</div>
              <div style={s.blockContent}>{b.content}</div>
            </div>
          ) : (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={s.blockSubheader}>Reference: {b.title} by @{b.author}</div>
              <div style={s.blockContent}>URL: {b.url}</div>
            </div>
          )
        ))}

        {(post.postType === "blueprint" || post.postType === "bounty") && (post.stages ?? []).map((stage) => {
          const list = stage.blocks.map((b) => b.type).join(", ");
          const desc = stage.description || `Connects ${stage.blocks.length} blocks: ${list}`;
          return (
            <div key={stage.id} style={{ marginBottom: 20 }}>
              <div style={s.section}>Stage: {stage.name}</div>
              <div style={{ fontSize: 10, fontStyle: "italic", color: "#4b5563", marginBottom: 12 }}>
                Stage description: {desc}
              </div>
              {stage.blocks.map((b) => <BlockRenderer key={b.id} block={b} />)}
            </div>
          );
        })}

        {post.resultsGallery && post.resultsGallery.length > 0 && (
          <>
            <div style={s.section}>Results gallery</div>
            {post.resultsGallery.map((slide, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={s.blockSubheader}>
                  ▸ Slide {i + 1}: {slide.kind} — {slide.mediaUrl || slide.textPreview}
                </div>
                {slide.caption ? <div style={s.blockContent}>Caption: {slide.caption}</div> : null}
              </div>
            ))}
          </>
        )}

        {(post.postType === "blueprint" || post.postType === "bounty") && post.connections && post.connections.length > 0 && (
          <>
            <div style={s.section}>Connection graph</div>
            <div style={{ fontSize: 10, lineHeight: 1.8, paddingLeft: 16 }}>
              {post.connections.map((conn, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  Block: {conn.fromBlockName} (id: {conn.fromBlockId}) → connects to → Block: {conn.toBlockName} (id: {conn.toBlockId})
                  {conn.connectionType ? ` via ${conn.connectionType}` : null}
                </div>
              ))}
            </div>
          </>
        )}

        {post.postType === "bounty" && post.solvers && post.solvers.length > 0 && (
          <>
            <div style={s.section}>Accepted solutions</div>
            {post.solvers.map((sv, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={s.blockSubheader}>▸ Solver: {sv.name} (@{sv.handle})</div>
                {sv.contribution ? <div style={s.blockContent}>Contribution: {sv.contribution}</div> : null}
                {sv.acceptedAt ? <div style={s.blockContent}>Accepted: {sv.acceptedAt}</div> : null}
              </div>
            ))}
          </>
        )}
      </div>

      {includeProvenance && (
        <div style={s.pageBreak}>
          <div style={s.section}>Provenance & Attribution</div>
          <table style={s.table}>
            <tbody>
              <MetaRow label="Original URL" value={postUrl} />
              <MetaRow label="Author" value={`${post.author.name} (@${post.author.handle})`} />
              <MetaRow label="Bio" value={post.author.bio} />
              <MetaRow label="Published" value={post.publishedAt} />
              <MetaRow label="Exported" value={new Date().toISOString()} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AIPdfPreview;
