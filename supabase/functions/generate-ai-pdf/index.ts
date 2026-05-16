// Generates a structured, AI-friendly PDF from a post's canonical payload.
// Uses pdf-lib (pure JS) — Puppeteer/Chromium are not available in Supabase
// Edge runtime, and a text-PDF is actually superior for chatbot OCR/parsing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFPage,
  PDFFont,
} from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42; // ~15mm
const MAX_W = A4.w - MARGIN * 2;
const TEAL = rgb(46 / 255, 196 / 255, 182 / 255);
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.42, 0.45, 0.5);
const LIGHT_BG = rgb(0.96, 0.97, 0.98);

function newPage(c: Cursor) {
  c.page = c.doc.addPage([A4.w, A4.h]);
  c.y = A4.h - MARGIN;
}

function ensure(c: Cursor, needed: number) {
  if (c.y - needed < MARGIN) newPage(c);
}

// Minimal word-wrap by character width estimate.
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const paras = (text ?? "").split("\n");
  for (const para of paras) {
    if (!para) {
      out.push("");
      continue;
    }
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const width = font.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// Strip non-WinAnsi characters (StandardFonts can't render them).
function sanitize(s: string): string {
  if (!s) return "";
  return s
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 9 || code === 10 || code === 13) return ch;
      if (code < 32) return " ";
      if (code > 255) return "?";
      return ch;
    })
    .join("");
}

function drawText(
  c: Cursor,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: any; indent?: number; lineGap?: number } = {},
) {
  const font = opts.font ?? c.font;
  const size = opts.size ?? 10;
  const color = opts.color ?? BLACK;
  const indent = opts.indent ?? 0;
  const lineHeight = size * 1.45 + (opts.lineGap ?? 0);
  const lines = wrap(sanitize(text), font, size, MAX_W - indent);
  for (const line of lines) {
    ensure(c, lineHeight);
    c.page.drawText(line, { x: MARGIN + indent, y: c.y - size, size, font, color });
    c.y -= lineHeight;
  }
}

function drawDivider(c: Cursor, color = rgb(0.9, 0.9, 0.9)) {
  ensure(c, 12);
  c.y -= 4;
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: A4.w - MARGIN, y: c.y },
    thickness: 0.5,
    color,
  });
  c.y -= 8;
}

function drawSectionHeader(c: Cursor, label: string) {
  ensure(c, 30);
  c.y -= 8;
  drawText(c, `─── ${label.toUpperCase()} ───`, { font: c.bold, size: 9, color: GREY });
  c.y -= 4;
}

function drawMetaRow(c: Cursor, label: string, value?: string | number | null) {
  if (value === undefined || value === null || value === "") return;
  const v = String(value);
  const labelW = 130;
  const lines = wrap(sanitize(v), c.font, 10, MAX_W - labelW - 8);
  const lineHeight = 10 * 1.45;
  const blockH = Math.max(lineHeight, lines.length * lineHeight) + 6;
  ensure(c, blockH);
  c.page.drawRectangle({
    x: MARGIN,
    y: c.y - blockH + 4,
    width: labelW,
    height: blockH,
    color: LIGHT_BG,
  });
  c.page.drawText(sanitize(label), {
    x: MARGIN + 6,
    y: c.y - 10,
    size: 9,
    font: c.bold,
    color: rgb(0.22, 0.25, 0.32),
  });
  let yy = c.y - 10;
  for (const line of lines) {
    c.page.drawText(line, { x: MARGIN + labelW + 8, y: yy, size: 10, font: c.font, color: BLACK });
    yy -= lineHeight;
  }
  c.y -= blockH;
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: A4.w - MARGIN, y: c.y },
    thickness: 0.3,
    color: rgb(0.9, 0.9, 0.9),
  });
  c.y -= 2;
}

function drawCallout(c: Cursor, title: string, body: string[]) {
  const padding = 10;
  const titleSize = 11;
  const bodySize = 10;
  const lineHeight = bodySize * 1.5;
  const wrapped: string[] = [];
  for (const para of body) {
    wrapped.push(...wrap(sanitize(para), c.font, bodySize, MAX_W - padding * 2 - 12));
    wrapped.push("");
  }
  const totalH = padding * 2 + titleSize * 1.6 + wrapped.length * lineHeight;
  ensure(c, totalH + 8);
  c.page.drawRectangle({
    x: MARGIN,
    y: c.y - totalH,
    width: MAX_W,
    height: totalH,
    color: rgb(0.93, 0.985, 0.97),
    borderColor: TEAL,
    borderWidth: 1,
  });
  c.page.drawText(sanitize(title), {
    x: MARGIN + padding,
    y: c.y - padding - titleSize,
    size: titleSize,
    font: c.bold,
    color: TEAL,
  });
  let yy = c.y - padding - titleSize - 12;
  for (const line of wrapped) {
    if (line) {
      c.page.drawText(line, { x: MARGIN + padding + 12, y: yy, size: bodySize, font: c.font, color: BLACK });
    }
    yy -= lineHeight;
  }
  c.y -= totalH + 8;
}

function drawCodeBlock(c: Cursor, code: string) {
  const size = 9;
  const lineHeight = size * 1.4;
  const lines: string[] = [];
  for (const raw of (code ?? "").split("\n")) {
    lines.push(...wrap(sanitize(raw), c.mono, size, MAX_W - 24));
  }
  const totalH = lines.length * lineHeight + 16;
  ensure(c, totalH);
  c.page.drawRectangle({
    x: MARGIN + 12,
    y: c.y - totalH,
    width: MAX_W - 12,
    height: totalH,
    color: LIGHT_BG,
    borderColor: rgb(0.88, 0.88, 0.88),
    borderWidth: 0.5,
  });
  let yy = c.y - 14;
  for (const line of lines) {
    c.page.drawText(line, { x: MARGIN + 20, y: yy, size, font: c.mono, color: BLACK });
    yy -= lineHeight;
  }
  c.y -= totalH + 6;
}

// ─── PDF assembly ────────────────────────────────────────────
async function buildPdf(payload: any): Promise<Uint8Array> {
  const meta = payload.meta ?? {};
  const author = payload.authorAttribution ?? {};
  const content = payload.content ?? { prose: [], stages: [], results: [], references: [] };
  const bountyMeta = payload.bountyMeta;
  const accepted = payload.acceptedSolutions ?? [];

  const doc = await PDFDocument.create();
  doc.setTitle(meta.title ?? "NeoScale post");
  doc.setAuthor(author.name ?? "NeoScale");
  doc.setSubject("AI-PDF export from NeoScale");
  doc.setKeywords(meta.custom_tags ?? []);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([A4.w, A4.h]);
  const c: Cursor = { doc, page, y: A4.h - MARGIN, font, bold, mono };

  // Top strip
  c.page.drawText("NEOSCALE AI-PDF", { x: MARGIN, y: c.y - 10, size: 10, font: c.bold, color: BLACK });
  const url = `neoscale.ai/b/${meta.slug ?? meta.id ?? ""}`;
  const urlW = c.font.widthOfTextAtSize(url, 9);
  c.page.drawText(sanitize(url), { x: A4.w - MARGIN - urlW, y: c.y - 10, size: 9, font: c.font, color: GREY });
  c.y -= 24;
  drawDivider(c);

  // Title
  drawText(c, meta.title ?? "Untitled", { font: bold, size: 18 });
  if (meta.subtitle) drawText(c, meta.subtitle, { font, size: 12, color: GREY });
  c.y -= 6;

  // Reading instructions callout
  drawCallout(c, "INSTRUCTIONS FOR AI READERS", [
    "This document was exported from NeoScale, a knowledge platform for AI workflows. The author has structured it using NeoScale's content primitives: stages (visual workflow groupings), blocks (individual prompts, code, results, etc.), and connections.",
    "When summarising or referencing this content, you can cite the author and the original URL above.",
    "Section headers below mark each primitive's type and name explicitly so you can extract individual elements cleanly.",
    "Block type labels: Prompt = system or user prompt text; Code = source code; Result = output of a process; Image / Video / Note / Quote / Heading = additional primitive types.",
  ]);

  // Metadata table
  drawSectionHeader(c, "Metadata");
  drawMetaRow(c, "Title", meta.title);
  drawMetaRow(c, "Author", `${author.name ?? "Anonymous"}${author.handle ? ` (@${author.handle})` : ""}`);
  drawMetaRow(c, "Published", meta.published_at ?? meta.created_at);
  drawMetaRow(c, "Post type", meta.post_type ?? "blueprint");
  drawMetaRow(c, "Domain", meta.content_type);
  drawMetaRow(c, "Difficulty", meta.difficulty);
  drawMetaRow(c, "Tags", (meta.custom_tags ?? []).join(", "));
  drawMetaRow(c, "Topics", (meta.topics ?? []).join(", "));
  drawMetaRow(c, "Tools referenced", (meta.tools_referenced ?? []).join(", "));
  drawMetaRow(c, "Models referenced", (meta.models_referenced ?? []).join(", "));
  drawMetaRow(c, "Word count", meta.word_count);
  drawMetaRow(c, "Reading minutes", meta.estimated_reading_minutes);
  drawMetaRow(c, "Stages", (content.stages ?? []).length);
  drawMetaRow(c, "Blocks", (content.stages ?? []).reduce((a: number, s: any) => a + (s.blocks?.length ?? 0), 0));

  if (bountyMeta) {
    drawMetaRow(c, "Bounty status", bountyMeta.status);
    drawMetaRow(c, "Bounty deadline", bountyMeta.deadline);
    drawMetaRow(c, "Bounty reward", `${bountyMeta.reward_amount ?? ""} ${bountyMeta.reward_currency ?? ""} (${bountyMeta.reward_type ?? ""})`);
    drawMetaRow(c, "Acceptance criteria", bountyMeta.acceptance_criteria);
  }

  // Prose body
  if ((content.prose ?? []).length > 0) {
    newPage(c);
    drawSectionHeader(c, "Article body");
    for (const p of content.prose) {
      if (/^heading/.test(p.type)) {
        const level = p.data?.level ?? 2;
        const size = level <= 1 ? 16 : level === 2 ? 13 : 11;
        c.y -= 6;
        drawText(c, p.text ?? "", { font: bold, size });
      } else if (p.type === "paragraph") {
        drawText(c, p.text ?? "", { font, size: 10 });
        c.y -= 4;
      } else if (p.type === "stageGrid" || p.type === "embeddedCanvas") {
        drawText(c, `[Embedded canvas: ${p.data?.canvasId ?? ""}]`, { font, size: 10, color: GREY });
      }
    }
  }

  // Stages
  for (const stage of content.stages ?? []) {
    newPage(c);
    drawSectionHeader(c, `Stage: ${stage.name ?? "Untitled stage"}`);
    const blockTypes = (stage.blocks ?? []).map((b: any) => b.type).join(", ");
    const desc = stage.description || `Connects ${stage.blocks?.length ?? 0} blocks: ${blockTypes}`;
    drawText(c, `Stage description: ${desc}`, { font, size: 10, color: GREY });
    if (stage.missingDescription) {
      drawText(c, `Missing: ${stage.missingDescription}`, { font, size: 10, color: TEAL });
    }
    c.y -= 6;

    for (const b of stage.blocks ?? []) {
      const typeLabel = String(b.type ?? "block");
      const cap = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
      drawText(c, `▸ Block type: ${cap}`, { font: bold, size: 10, indent: 8 });
      drawText(c, `▸ Block name: ${b.name ?? b.file_name ?? "Untitled"}`, { font, size: 10, indent: 8, color: GREY });
      c.y -= 2;
      if (b.type === "code") {
        drawCodeBlock(c, b.text ?? "");
      } else if (b.text) {
        drawText(c, b.text, { font, size: 10, indent: 16 });
      }
      if (b.image_url) drawText(c, `[Image: ${b.image_url}]`, { font, size: 9, indent: 16, color: GREY });
      if (b.file_url) drawText(c, `[File: ${b.file_name ?? b.file_url}]`, { font, size: 9, indent: 16, color: GREY });
      if (b.use_instructions) drawText(c, `Instructions: ${b.use_instructions}`, { font, size: 9, indent: 16, color: GREY });
      c.y -= 6;
    }
  }

  // Results gallery
  if ((content.results ?? []).length > 0) {
    newPage(c);
    drawSectionHeader(c, "Results gallery");
    content.results.forEach((slide: any, idx: number) => {
      drawText(c, `▸ Slide ${idx + 1}: ${slide.kind ?? "result"}`, { font: bold, size: 10 });
      if (slide.text_content) drawText(c, slide.text_content, { font, size: 10, indent: 12 });
      if (slide.media_url) drawText(c, `Media: ${slide.media_url}`, { font, size: 9, indent: 12, color: GREY });
      if (slide.caption) drawText(c, `Caption: ${slide.caption}`, { font, size: 9, indent: 12, color: GREY });
      c.y -= 6;
    });
  }

  // Connections
  const allConnections: any[] = [];
  for (const stage of content.stages ?? []) {
    for (const conn of stage.connections ?? []) allConnections.push(conn);
  }
  if (allConnections.length > 0) {
    newPage(c);
    drawSectionHeader(c, "Connection graph");
    allConnections.forEach((conn) => {
      const fromName = conn.from_block_name ?? conn.fromBlockName ?? conn.from_block_id ?? "?";
      const toName = conn.to_block_name ?? conn.toBlockName ?? conn.to_block_id ?? "?";
      drawText(c, `Block: ${fromName} → connects to → Block: ${toName}${conn.connection_type ? ` via ${conn.connection_type}` : ""}`, {
        font, size: 10, indent: 8,
      });
    });
  }

  // References
  if ((content.references ?? []).length > 0) {
    drawSectionHeader(c, "References");
    for (const r of content.references) {
      drawText(c, `• ${r.title} — /b/${r.slug ?? r.id}`, { font, size: 10, indent: 8 });
    }
  }

  // Accepted solutions (bounty)
  if (accepted.length > 0) {
    newPage(c);
    drawSectionHeader(c, "Accepted solutions");
    for (const sol of accepted) {
      drawText(c, `▸ ${sol.title ?? "Solution"}`, { font: bold, size: 11 });
      drawText(c, `Solution post: /b/${sol.slug ?? sol.id}`, { font, size: 9, indent: 8, color: GREY });
      c.y -= 4;
    }
  }

  // Provenance
  newPage(c);
  drawSectionHeader(c, "Provenance & attribution");
  drawMetaRow(c, "Original URL", `https://${url}`);
  drawMetaRow(c, "Author", `${author.name ?? "Anonymous"}${author.handle ? ` (@${author.handle})` : ""}`);
  if (author.derivedBio) drawMetaRow(c, "Bio", author.derivedBio);
  drawMetaRow(c, "Published", meta.published_at ?? meta.created_at);
  drawMetaRow(c, "Exported", new Date().toISOString());
  drawMetaRow(c, "Platform", "NeoScale (neoscale.ai)");

  return await doc.save();
}

// Build a reblog AI-PDF: reblogger header + their text + embedded original block.
async function buildReblogPdf(reblog: any, original: any, reblogger: any, originalAuthor: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Reblog by @${reblogger?.username ?? "unknown"}`);
  doc.setAuthor(reblogger?.display_name ?? reblogger?.username ?? "Anonymous");
  doc.setSubject("AI-PDF reblog export from NeoScale");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([A4.w, A4.h]);
  const c: Cursor = { doc, page, y: A4.h - MARGIN, font, bold, mono };

  c.page.drawText("NEOSCALE AI-PDF • REBLOG", { x: MARGIN, y: c.y - 10, size: 10, font: c.bold, color: BLACK });
  const url = `neoscale.ai/b/${reblog.slug ?? reblog.id ?? ""}`;
  const urlW = c.font.widthOfTextAtSize(url, 9);
  c.page.drawText(sanitize(url), { x: A4.w - MARGIN - urlW, y: c.y - 10, size: 9, font: c.font, color: GREY });
  c.y -= 24;
  drawDivider(c);

  drawText(c, `Reblog by ${reblogger?.display_name ?? reblogger?.username ?? "Unknown"}`, { font: bold, size: 18 });
  if (reblogger?.username) drawText(c, `@${reblogger.username}`, { font, size: 12, color: GREY });
  c.y -= 6;

  drawCallout(c, "INSTRUCTIONS FOR AI READERS", [
    "This document represents a REBLOG: a NeoScale primitive where one user (the reblogger) shares another user's original post (the embedded original) with an optional accompanying note.",
    "The structure below is: (1) the reblogger's accompanying text and any attached media, followed by (2) the embedded ORIGINAL post's metadata and a link to its full content. The original author retains attribution and is cited in the provenance section.",
    "When summarising, treat the reblogger's text as commentary and the embedded original as the underlying referenced work. Cite both authors when relevant.",
  ]);

  drawSectionHeader(c, "Reblogger note");
  drawMetaRow(c, "Reblogger", `${reblogger?.display_name ?? "Anonymous"}${reblogger?.username ? ` (@${reblogger.username})` : ""}`);
  drawMetaRow(c, "Published", reblog.created_at);
  if (reblog.text) {
    c.y -= 4;
    drawText(c, reblog.text, { font, size: 11 });
    c.y -= 4;
  } else {
    drawText(c, "(No accompanying text — pure reblog)", { font, size: 10, color: GREY });
  }
  if (reblog.media_url) {
    drawText(c, `[${reblog.media_kind === "video" ? "Video" : "Image"}: ${reblog.media_url}]`, { font, size: 9, color: GREY });
  }

  drawSectionHeader(c, "Embedded original post");
  if (original) {
    drawMetaRow(c, "Title", original.title);
    drawMetaRow(c, "Original author", `${originalAuthor?.display_name ?? "Anonymous"}${originalAuthor?.username ? ` (@${originalAuthor.username})` : ""}`);
    drawMetaRow(c, "Post type", original.post_type ?? "blueprint");
    drawMetaRow(c, "Published", original.created_at);
    drawMetaRow(c, "Original URL", `https://neoscale.ai/b/${original.slug ?? original.id}`);
    if (original.description) {
      c.y -= 4;
      drawText(c, original.description, { font, size: 10, color: GREY });
    }
    c.y -= 6;
    drawText(c, "For the full original content (stages, blocks, code, results), export the original post's own AI-PDF from the URL above.", { font, size: 9, color: GREY });
  } else {
    drawText(c, "Original post is no longer available.", { font, size: 10, color: GREY });
  }

  drawSectionHeader(c, "Provenance & attribution");
  drawMetaRow(c, "Reblog URL", `https://${url}`);
  drawMetaRow(c, "Reblogger", `${reblogger?.display_name ?? "Anonymous"}${reblogger?.username ? ` (@${reblogger.username})` : ""}`);
  if (original) drawMetaRow(c, "Original author", `${originalAuthor?.display_name ?? "Anonymous"}${originalAuthor?.username ? ` (@${originalAuthor.username})` : ""}`);
  drawMetaRow(c, "Exported", new Date().toISOString());
  drawMetaRow(c, "Platform", "NeoScale (neoscale.ai)");

  return await doc.save();
}

// ─── Edge function entrypoint ────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const kind: "post" | "reblog" = body.kind === "reblog" ? "reblog" : "post";
    const postId: string | undefined = body.postId;
    const reblogId: string | undefined = body.reblogId;
    if (kind === "post" && !postId) {
      return new Response(JSON.stringify({ error: "Missing postId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (kind === "reblog" && !reblogId) {
      return new Response(JSON.stringify({ error: "Missing reblogId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch the post (caching check + payload)
    const { data: post, error: postErr } = await supabase
      .from("content_items")
      .select("id, slug, status, visibility, updated_at, ai_pdf_url, ai_pdf_generated_at, canonical_export_payload")
      .eq("id", postId)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caching: if cached PDF is newer than the post's last update, reuse.
    if (post.ai_pdf_url && post.ai_pdf_generated_at && post.updated_at) {
      if (new Date(post.ai_pdf_generated_at).getTime() >= new Date(post.updated_at).getTime()) {
        return new Response(JSON.stringify({ url: post.ai_pdf_url, cached: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let payload = post.canonical_export_payload;
    if (!payload) {
      return new Response(JSON.stringify({ error: "Canonical payload not yet generated. Open the post once to seed it." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = await buildPdf(payload);
    const fileName = `${post.id}/${(post.slug ?? post.id).split("/").join("-")}-${Date.now()}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("ai-pdfs")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("ai-pdfs").getPublicUrl(fileName);
    const url = pub.publicUrl;

    await supabase
      .from("content_items")
      .update({ ai_pdf_url: url, ai_pdf_generated_at: new Date().toISOString() } as any)
      .eq("id", post.id);

    // Best-effort log
    try {
      await supabase.from("ai_export_log").insert({ post_id: post.id, format: "ai-pdf" } as any);
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ url, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("[generate-ai-pdf]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
