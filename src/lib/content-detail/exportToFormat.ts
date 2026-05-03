import { supabase } from "@/integrations/supabase/client";
import { getCanonicalPayload } from "./getCanonicalPayload";
import type { CanonicalPostPayload, ExportFormat } from "./types";

function escapeMd(s: string): string {
  return (s ?? "").split("|").join("\\|");
}

function payloadToMarkdown(p: CanonicalPostPayload): string {
  const lines: string[] = [];
  lines.push(`# ${p.meta.title ?? "Untitled"}`);
  if (p.meta.subtitle) lines.push(`*${p.meta.subtitle}*`);
  lines.push("");
  lines.push(`> By ${p.authorAttribution.name} (@${p.authorAttribution.handle})`);
  if (p.authorAttribution.derivedBio) lines.push(`> ${p.authorAttribution.derivedBio}`);
  lines.push("");
  if (p.meta.description) {
    lines.push(p.meta.description);
    lines.push("");
  }

  for (const block of p.content.prose) {
    if (/^heading/.test(block.type)) {
      const level = (block.data?.level ?? 2) as number;
      lines.push(`${"#".repeat(Math.min(6, level))} ${block.text ?? ""}`);
    } else if (block.type === "paragraph") {
      lines.push(block.text ?? "");
    } else if (block.type === "stageGrid" || block.type === "embeddedCanvas") {
      lines.push(`*[Embedded canvas: ${block.data?.canvasId ?? ""}]*`);
    }
    lines.push("");
  }

  for (const stage of p.content.stages) {
    lines.push(`## Stage: ${stage.name}`);
    if (stage.missingDescription) lines.push(`> Missing: ${stage.missingDescription}`);
    for (const b of stage.blocks) {
      lines.push(`### ${b.type}`);
      if (b.text) lines.push(b.text);
      if (b.image_url) lines.push(`![image](${b.image_url})`);
      if (b.file_url) lines.push(`[${escapeMd(b.file_name ?? "file")}](${b.file_url})`);
      if (b.use_instructions) lines.push(`_${b.use_instructions}_`);
      lines.push("");
    }
  }

  if (p.content.results.length > 0) {
    lines.push(`## Results`);
    for (const r of p.content.results) {
      if (r.kind === "written") lines.push(r.text_content ?? "");
      else if (r.media_url) lines.push(`![${r.kind}](${r.media_url})`);
      if (r.caption) lines.push(`*${r.caption}*`);
      lines.push("");
    }
  }

  if (p.content.references.length > 0) {
    lines.push(`## References`);
    for (const r of p.content.references as any[]) {
      lines.push(`- [${r.title}](/b/${r.slug ?? r.id})`);
    }
  }

  return lines.join("\n");
}

function payloadToPlain(p: CanonicalPostPayload): string {
  return payloadToMarkdown(p)
    .split(/\!\[[^\]]*\]\([^)]+\)/g)
    .join("")
    .split(/\[([^\]]+)\]\([^)]+\)/g)
    .join("$1")
    .split(/[#>*_`]/g)
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

function payloadToHtml(p: CanonicalPostPayload): string {
  const md = payloadToMarkdown(p);
  // Minimal MD → HTML (no deps). Good enough for PDF rasterization upstream.
  const html = md
    .split("\n")
    .map((line) => {
      if (/^#{1,6} /.test(line)) {
        const m = line.match(/^(#{1,6})\s+(.*)$/)!;
        const lv = m[1].length;
        return `<h${lv}>${m[2]}</h${lv}>`;
      }
      if (line.trim() === "") return "";
      return `<p>${line}</p>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.meta.title ?? ""}</title></head><body>${html}</body></html>`;
}

export async function exportToFormat({
  postId,
  format,
  exporterId,
}: {
  postId: string;
  format: ExportFormat;
  exporterId?: string | null;
}): Promise<{ url?: string; content?: string; format: ExportFormat }> {
  const payload = await getCanonicalPayload(postId);

  let result: { url?: string; content?: string };
  switch (format) {
    case "markdown":
      result = { content: payloadToMarkdown(payload) };
      break;
    case "plain":
      result = { content: payloadToPlain(payload) };
      break;
    case "json":
    case "copy-json":
      result = { content: JSON.stringify(payload, null, 2) };
      break;
    case "pdf": {
      // Client-side stub: hand back HTML. A future edge function will rasterize.
      result = { content: payloadToHtml(payload) };
      break;
    }
    case "ai-pdf": {
      // AI-PDF template hook — same payload, marked for downstream renderer.
      // If a cached ai_pdf_url exists, reuse it; else return HTML stub.
      const { data } = await (supabase as any)
        .from("content_items")
        .select("ai_pdf_url")
        .eq("id", postId)
        .maybeSingle();
      const url = (data as any)?.ai_pdf_url;
      result = url ? { url } : { content: payloadToHtml(payload) };
      break;
    }
    default:
      throw new Error(`Unknown export format: ${format}`);
  }

  // Best-effort log.
  try {
    await (supabase as any)
      .from("ai_export_log")
      .insert({ post_id: postId, exporter_id: exporterId ?? null, format });
  } catch (e) {
    console.warn("[exportToFormat] log failed", e);
  }

  return { ...result, format };
}
