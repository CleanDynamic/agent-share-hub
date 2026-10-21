/* CA-12 P7 to P12 — what each tile shows of the thing itself, drawn once for the composer, the build page, Preview and the
   windows. A prompt shows what came back, an agent its instructions, a tool its app and how it was connected, a file its
   type and a preview, a manual step where it was done and its steps.

   PURE. Every body takes the `Step` the graph already makes (`buildSteps`), so the maker sees what readers see. */

import { File as FileIcon, FileCode, FileImage, FileSpreadsheet, FileText, Link as LinkIcon } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";

import { CodeLines } from "@/components/code/CodeLines";
import { CONNECTION_LABEL, RESULT_THUMBS, resultHolds, type CheckCase, type FileKind, type ResultFacts, type Step } from "@/lib/build/graph";
import { manualLinesOf, manualWhereLabel, siteNameOf } from "@/lib/build/graph";
import { formatSize } from "@/lib/build/readerSteps";
import { t } from "@/lib/theme/tokens";
import { TextButton } from "@/pages/site/compose/composeControls";
import { ManualThumb } from "@/pages/site/compose/ManualThumb";
import { Quiet, ToolMark } from "@/pages/site/compose/refinedPieces";
import { ellipsis, text } from "@/pages/site/compose/refinedStyles";

export const TILE_COPY = {
  noInstructions: "No instructions yet",
  readAll: "Read all",
  nothingAdded: "Nothing added yet",
  noPreview: "No preview",
  cases: (n: number) => `${n} ${n === 1 ? "case" : "cases"}`,
  allPassed: "all passed",
  failing: "First failing case",
} as const;

const clamp = (lines: number): CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" });

/* ── a tool ── */

/** The app's mark and name, how it was connected, and what it did. Absent parts are not drawn. */
export function ToolTileBody({ step, indent = 0 }: { step: Step; indent?: number }) {
  const name = step.tool ?? step.title ?? "Tool";
  const connection = step.app?.connection ? CONNECTION_LABEL[step.app.connection] : null;
  const where = step.app?.connection === "mcp" && step.app.runsAt ? (step.app.runsAt === "web" ? "at a web address" : "on the maker's computer") : null;
  const how = [connection, where].filter(Boolean).join(" · ");
  return (
    <div data-testid="tool-tile" style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: indent, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <ToolMark tool={name} size={20} />
        <span style={{ ...text(13.5, 500, t.text), ...ellipsis }}>{name}</span>
      </div>
      {how ? <span data-testid="tool-how" style={text(12.5, 400, t.text2)}>{how}</span> : null}
      {step.app?.scopes ? <span data-testid="tool-scopes" style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{step.app.scopes}</span> : null}
    </div>
  );
}

/* ── a file ── */

const FILE_ICON: Record<FileKind, typeof FileIcon> = { text: FileText, code: FileCode, pdf: FileText, picture: FileImage, spreadsheet: FileSpreadsheet, other: FileIcon };
const FILE_WORD: Record<FileKind, string> = { text: "Text", code: "Code", pdf: "PDF", picture: "Picture", spreadsheet: "Spreadsheet", other: "File" };

/** A file's type mark: a 32px square with the type's glyph. */
export function FileMark({ kind, size = 32 }: { kind: FileKind; size?: number }) {
  const Icon = FILE_ICON[kind];
  return (
    <span
      data-testid="file-mark"
      data-kind={kind}
      aria-label={FILE_WORD[kind]}
      role="img"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: 6, background: t.cell, border: `1px solid ${t.line}`, color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}
    >
      <Icon size={Math.round(size / 2)} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

/** The type mark, the file's name and size, and a preview: 4 lines of a text or code file, a thumbnail of a picture, the PDF mark for a PDF. */
export function FileTileBody({ step, indent = 0 }: { step: Step; indent?: number }) {
  const facts = step.fileFacts;
  if (!facts) return null;
  const size = formatSize(facts.size);
  return (
    <div data-testid="file-tile" style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: indent, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <FileMark kind={facts.kind} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ ...text(13.5, 500, t.text), ...ellipsis }}>{facts.name}</span>
          <Quiet>{[FILE_WORD[facts.kind], size].filter(Boolean).join(" · ")}</Quiet>
        </span>
      </div>
      {facts.kind === "picture" && facts.mediaId ? (
        <ManualThumb mediaId={facts.mediaId} size={96} />
      ) : (facts.kind === "text" || facts.kind === "code" || facts.kind === "spreadsheet") && facts.preview.length > 0 ? (
        <CodeLines text={facts.preview.join("\n")} maxLines={4} testId="file-preview" label={`${facts.name} preview`} />
      ) : null}
      {step.text ? <span style={{ ...text(12.5, 400, t.text2), overflowWrap: "anywhere" }}>{step.text}</span> : null}
    </div>
  );
}

/* ── a manual step ── */

/** Where it was done (the app's or site's mark and name), then its steps as a numbered list, then its picture. */
export function ManualTileBody({ step, indent = 0, picture = true }: { step: Step; indent?: number; picture?: boolean }) {
  const where = step.where ?? (step.tool ? ({ kind: "app", name: step.tool, url: null } as const) : null);
  const label = manualWhereLabel(where);
  const markName = where?.kind === "app" || where?.kind === "site" ? label : step.tool;
  const site = where?.kind === "site" ? siteNameOf(where.url) : null;
  const lines = step.lines ?? manualLinesOf(step.text);
  return (
    <div data-testid="manual-tile" style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: indent, minWidth: 0 }}>
      <div data-testid="manual-where" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {where?.kind === "app" ? <ToolMark tool={markName} size={14} /> : null}
        
        <span style={{ ...text(12.5, 500, t.text2), ...ellipsis }}>{label}</span>
        {site && site !== label ? <Quiet>{site}</Quiet> : null}
      </div>
      {lines.length > 1 ? (
        <ol data-testid="manual-lines" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 2, ...text(13.5, 400, t.text), lineHeight: "22px" }}>
          {lines.map((line, at) => (
            <li key={at} style={{ overflowWrap: "anywhere" }}>
              {line}
            </li>
          ))}
        </ol>
      ) : (
        <p data-testid="manual-lines" style={{ ...text(13.5, 400, t.text), margin: 0, lineHeight: "22px", overflowWrap: "anywhere" }}>
          {lines[0] ?? ""}
        </p>
      )}
      {picture && step.mediaId ? <ManualThumb mediaId={step.mediaId} size={48} /> : null}
    </div>
  );
}

/* ── an agent ── */

/** "When I ask", or the way it runs in the words Details uses; an agent with none runs when asked. */
export function startsLine(runs: string): string {
  return runs || "When I ask";
}

/* ── a prompt's reply ── */

/** What came back: its first 2 lines, indented under a 2px hairline, with "Read all" when there is more. */
export function ReplyBlock({ reply, onRead, indent = 0 }: { reply: string; onRead?: () => void; indent?: number }): ReactNode {
  const more = reply.split(/\r?\n/).length > 2 || reply.length > 180;
  return (
    <div data-testid="prompt-reply" style={{ marginLeft: indent, borderLeft: `2px solid ${t.hairline}`, paddingLeft: 12, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <p style={{ ...text(13, 400, t.text2), margin: 0, lineHeight: "20px", overflowWrap: "anywhere", whiteSpace: "pre-wrap", ...clamp(2) }}>{reply}</p>
      {more && onRead ? (
        <div>
          <TextButton underline onClick={onRead} style={text(12, 500, t.text2)}>
            {TILE_COPY.readAll}
          </TextButton>
        </div>
      ) : null}
    </div>
  );
}

/* ── a check's cases ── */

/** The case total, and the first failing case when there is one. */
export function CheckCasesBody({ cases = [], indent = 0 }: { cases?: readonly CheckCase[]; indent?: number }) {
  if (cases.length === 0) return null;
  const failing = cases.find((c) => !c.passed);
  return (
    <div data-testid="check-cases" style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: indent, minWidth: 0 }}>
      <Quiet>{`${TILE_COPY.cases(cases.length)} · ${failing ? `${cases.filter((c) => c.passed).length} passed` : TILE_COPY.allPassed}`}</Quiet>
      {failing ? (
        <div data-testid="check-first-failing" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={text(12, 500, t.text2)}>{TILE_COPY.failing}</span>
          <span style={{ ...text(12.5, 400, t.text), overflowWrap: "anywhere" }}>{[failing.input && `In: ${failing.input}`, failing.expected && `Expected: ${failing.expected}`, failing.actual && `Got: ${failing.actual}`].filter(Boolean).join(" · ")}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ── a result ── */

/** The site's icon from the favicon service the article blocks already use; a link glyph when it does not load. The page itself is never fetched. */
function SiteIcon({ host, size = 20 }: { host: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box: CSSProperties = { width: size, height: size, flexShrink: 0, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: t.text2 };
  return failed ? (
    <span data-testid="site-icon" data-fallback="" style={box}>
      <LinkIcon size={Math.round(size * 0.8)} strokeWidth={1.5} aria-hidden="true" />
    </span>
  ) : (
    <span data-testid="site-icon" style={box}>
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" width={size} height={size} onError={() => setFailed(true)} style={{ display: "block", width: "100%", height: "100%" }} />
    </span>
  );
}

/** What a result holds, the thing itself: a link as a card, up to 4 thumbnails, a file, or a model. Nothing yet reads "Nothing added yet". */
export function ResultTileBody({ facts, indent = 0 }: { facts: ResultFacts; indent?: number }) {
  const wrap: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, paddingLeft: indent, minWidth: 0 };
  if (!resultHolds(facts)) {
    return (
      <div data-testid="result-tile" style={wrap}>
        <span data-testid="result-empty" style={text(13, 400, t.label)}>{TILE_COPY.nothingAdded}</span>
      </div>
    );
  }
  if (facts.link) {
    const { link } = facts;
    return (
      <div data-testid="result-tile" style={wrap}>
        <a
          data-testid="result-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: 8, borderRadius: 6, border: `1px solid ${t.line}`, background: t.cell, textDecoration: "none", boxSizing: "border-box" }}
        >
          <SiteIcon host={link.host} />
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ ...text(13.5, 500, t.text), ...ellipsis }}>{link.site}</span>
            {link.path ? <span style={{ ...text(12.5, 400, t.text2), ...ellipsis }}>{link.path}</span> : null}
          </span>
        </a>
      </div>
    );
  }
  if (facts.mediaIds.length > 0) {
    const shown = facts.mediaIds.slice(0, RESULT_THUMBS);
    const more = facts.mediaIds.length - shown.length;
    return (
      <div data-testid="result-tile" style={wrap}>
        <div data-testid="result-thumbs" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {shown.map((id) => (
            <ManualThumb key={id} mediaId={id} size={64} />
          ))}
          {more > 0 ? <Quiet>{`+${more} more`}</Quiet> : null}
        </div>
      </div>
    );
  }
  if (facts.file) {
    const { file } = facts;
    const size = formatSize(file.size);
    return (
      <div data-testid="result-tile" style={wrap}>
        <div data-testid="result-file" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <FileMark kind={file.kind} />
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ ...text(13.5, 500, t.text), ...ellipsis }}>{file.name}</span>
            <Quiet>{[FILE_WORD[file.kind], size].filter(Boolean).join(" · ")}</Quiet>
          </span>
        </div>
      </div>
    );
  }
  const model = facts.model;
  return (
    <div data-testid="result-tile" style={wrap}>
      <span data-testid="result-model" style={{ ...text(13.5, 500, t.text), overflowWrap: "anywhere" }}>{model?.baseModel ? `Based on ${model.baseModel}` : "A trained model"}</span>
      {model?.method ? <span style={{ ...text(12.5, 400, t.text2), overflowWrap: "anywhere" }}>{model.method}</span> : null}
    </div>
  );
}
