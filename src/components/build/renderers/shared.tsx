// Shared primitives for the typed node renderers.
//
// Everything here is presentation only. No renderer — and nothing in this
// file — calls Supabase, useQuery or useAuth: a renderer receives the node,
// its registry row, the build, a resolveNode function and a resolveMedia
// function, and that is the whole of its world. Both resolvers read collections
// the page has already loaded, so a card never issues a query of its own.
//
// TWO RULES THIS FILE EXISTS TO ENFORCE
//
// 1. A renderer never switches on node.type. Presentation is chosen by the
//    node type's `renderer` column, and *within* a renderer the emphasis is
//    driven by which field KEYS the schema declares — so `dataset` leads with
//    record_count and `test_set` leads with case_count through one code path,
//    and a type added to the registry later renders sensibly with no code
//    change here.
//
// 2. A creator's content is never silently dropped. Every renderer promotes
//    the fields it knows how to present, then hands whatever is left to
//    GenericPayload through <Rest>. A field added to a schema tomorrow shows
//    up tomorrow, unstyled but present.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  Build,
  BuildMedia,
  BuildNode,
  FieldDef,
  NodePayload,
  NodeType,
} from "@/lib/build";
import { GenericPayload } from "../GenericPayload";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "../tokens";

// --- the renderer contract ---------------------------------------------------

/** Looks a node up in the loaded tree. Supplied by BuildPage; never a query. */
export type ResolveNode = (id: string) => BuildNode | undefined;

/**
 * Looks a media id up in the build's media, loaded once for the whole page.
 *
 * Same contract as resolveNode and for the same reason: a renderer that
 * resolved its own media would issue one query per node, and a build is a
 * page full of nodes.
 *
 * THREE ANSWERS, NOT TWO:
 *   a row     — resolved
 *   null      — the media is loaded and holds no such id: it is gone
 *   undefined — the media has not loaded yet: nothing is known about this id
 *
 * The distinction is what stops every figure on the page announcing "media
 * unavailable" for the moment between first paint and the media query
 * returning. Only null says that; undefined holds the slot open.
 */
export type ResolveMedia = (
  id: string | null | undefined
) => BuildMedia | null | undefined;

/** Every renderer in this directory receives exactly these props. */
export interface NodeProps {
  node: BuildNode;
  /** Absent only when the node's type is missing from the registry. */
  nodeType?: NodeType;
  build: Build;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
}

/**
 * The optional per-module copy text extractor. NodeCard owns the copy control
 * itself and asks the renderer module what to put on the clipboard; a module
 * that exports nothing falls back to the first required text field.
 */
export type GetCopyText = (node: BuildNode, nodeType?: NodeType) => string | null;

// --- payload access ----------------------------------------------------------
//
// payload is Json, so every read is defensive. A malformed payload renders as
// a missing field, never as a thrown component.

export type Rec = Record<string, unknown>;

export function payloadOf(node: BuildNode): Rec {
  const payload = node.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Rec)
    : {};
}

/** A non-empty string. Numbers and booleans are stringified rather than lost. */
export function str(payload: Rec, key: string): string | undefined {
  const value = payload[key];
  if (typeof value === "string") return value.trim().length > 0 ? value : undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function num(payload: Rec, key: string): number | undefined {
  const value = payload[key];
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function bool(payload: Rec, key: string): boolean | undefined {
  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * A list field as records. A list of bare scalars — which the dialect does not
 * produce but a hand-written payload might — becomes [{ value }] rather than
 * being dropped.
 */
export function rows(payload: Rec, key: string): Rec[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Rec)
      : { value: item }
  );
}

/** True when a value is worth printing. Mirrors GenericPayload's test. */
export function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function fieldsOf(nodeType?: NodeType): FieldDef[] {
  return nodeType?.schema?.fields ?? [];
}

export function labelFor(nodeType: NodeType | undefined, key: string, fallback?: string): string {
  const field = fieldsOf(nodeType).find((candidate) => candidate.key === key);
  return field?.label ?? fallback ?? key;
}

// --- formatting --------------------------------------------------------------

export function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/** Seconds to "1:04". Used by recording durations. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** Text that should be shown in a mono block rather than as prose. */
export function looksStructured(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("<") ||
    /^\w+\s*[:=]\s*\S+$/m.test(trimmed)
  );
}

// --- media -------------------------------------------------------------------
//
// Storage-backed media is requested through the image transformation endpoint
// with width and quality, never at original size. The application currently
// serves originals into every slot; this is the first surface not to.

const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

const OBJECT_ENDPOINT = /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/i;
const RENDER_ENDPOINT = /\/storage\/v1\/render\/image\/public\//i;

export interface MediaTransform {
  width: number;
  quality?: number;
}

/**
 * A media reference to a URL that is safe to put in an <img src>.
 *
 * Handles three shapes and refuses the fourth:
 *   - a public storage URL       -> rewritten to the render endpoint + transform
 *   - a bare "bucket/path" ref   -> built against this project's storage
 *   - any other absolute URL     -> returned untouched (a third-party CDN
 *                                   cannot be asked to transform)
 *   - an opaque id with no path  -> null. Resolving one needs the media rows,
 *                                   which the page loads once and hands the
 *                                   renderers as resolveMedia; MediaFigure
 *                                   asks that first and only falls back here.
 */
export function mediaSrc(ref: string | undefined, transform: MediaTransform): string | null {
  const value = (ref ?? "").trim();
  if (!value) return null;

  const query = `width=${Math.round(transform.width)}&quality=${transform.quality ?? 70}`;

  if (/^https?:\/\//i.test(value)) {
    const match = OBJECT_ENDPOINT.exec(value);
    if (match) {
      const [, origin, rest] = match;
      return `${origin}/storage/v1/render/image/public/${rest.split("?")[0]}?${query}`;
    }
    if (RENDER_ENDPOINT.test(value)) {
      return value.includes("?") ? value : `${value}?${query}`;
    }
    return value;
  }

  if (value.includes("/") && SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/render/image/public/${value.replace(/^\/+/, "")}?${query}`;
  }

  return null;
}

/** The untransformed twin of a transformed storage URL, for the error path. */
function originalSrc(src: string): string | null {
  if (!RENDER_ENDPOINT.test(src)) return null;
  return src.replace("/storage/v1/render/image/public/", "/storage/v1/object/public/").split("?")[0];
}

/**
 * An image from a media reference. Requested at `width` through the transform
 * endpoint; if that endpoint is not enabled on the project the original is
 * used rather than leaving a broken image in the card.
 */
export function MediaImage({
  reference,
  alt,
  width,
  quality,
  style,
}: {
  reference: string | undefined;
  alt: string;
  width: number;
  quality?: number;
  style?: CSSProperties;
}) {
  const src = mediaSrc(reference, { width, quality });
  const [failed, setFailed] = useState(false);
  // Never an empty alt: an empty one means "decoration", and a figure a
  // creator put in their record is not decoration.
  const description = alt.trim() || "Build media";

  if (!src) {
    return (
      <div
        style={{
          ...bodyText,
          color: TEXT_MUTED,
          fontSize: 12,
          padding: "18px 14px",
          textAlign: "center",
          border: `1px dashed ${HAIRLINE}`,
          borderRadius: 8,
          ...style,
        }}
      >
        {reference ? "Media not resolvable on this surface" : "No media"}
      </div>
    );
  }

  return (
    <img
      src={failed ? (originalSrc(src) ?? src) : src}
      alt={description}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        borderRadius: 8,
        border: `1px solid ${HAIRLINE}`,
        ...style,
      }}
    />
  );
}

// --- layout primitives -------------------------------------------------------

export function Stack({
  gap = 12,
  children,
  style,
}: {
  gap?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>{children}</div>
  );
}

/** A labelled block. The label is the schema's label, never a re-invented one. */
export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span style={labelText}>{label}</span>
      {children}
    </div>
  );
}

/** Body prose with the creator's line breaks kept. */
export function Prose({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p
      style={{
        ...bodyText,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** The quiet line under a block: model, params, dates, provenance. */
export function Caption({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        ...bodyText,
        fontSize: 12,
        lineHeight: 1.5,
        color: TEXT_MUTED,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Chip({
  children,
  colour = TEXT_SECONDARY,
  tinted = false,
  title,
}: {
  children: ReactNode;
  colour?: string;
  tinted?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        ...bodyText,
        fontSize: 12,
        lineHeight: 1.4,
        padding: "2px 9px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        color: colour,
        background: tinted ? hexToRgba(colour, 0.14) : "transparent",
        border: `1px solid ${tinted ? hexToRgba(colour, 0.3) : HAIRLINE}`,
      }}
    >
      {children}
    </span>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {children}
    </div>
  );
}

/** The leading stat row: a small number of headline figures. */
export function StatRow({
  stats,
  colour = TEXT_PRIMARY,
}: {
  stats: { label: string; value: string }[];
  colour?: string;
}) {
  if (stats.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      {stats.map((stat) => (
        <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...labelText, fontSize: 11 }}>{stat.label}</span>
          <span
            style={{
              ...bodyText,
              fontSize: 20,
              fontWeight: 600,
              lineHeight: 1.2,
              color: colour,
            }}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A two-column key/value grid. Used for model and params everywhere. */
export function KeyValueGrid({ pairs }: { pairs: { label: string; value: ReactNode }[] }) {
  if (pairs.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "10px 20px",
      }}
    >
      {pairs.map((pair) => (
        <div key={pair.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...labelText, fontSize: 11 }}>{pair.label}</span>
          <span style={{ ...bodyText, wordBreak: "break-word" }}>{pair.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Bullets({ items, colour = TEAL }: { items: ReactNode[]; colour?: string }) {
  if (items.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, index) => (
        <li key={index} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: colour,
              marginTop: 8,
              flexShrink: 0,
            }}
          />
          <span style={{ ...bodyText, minWidth: 0, wordBreak: "break-word" }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A coloured callout. The gap renderer's invitation, and nothing else yet. */
export function Callout({
  colour,
  heading,
  children,
}: {
  colour: string;
  heading?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        background: hexToRgba(colour, 0.06),
        border: `1px solid ${hexToRgba(colour, 0.28)}`,
      }}
    >
      {heading ? (
        <span
          style={{
            ...labelText,
            color: colour,
            textTransform: "uppercase",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {heading}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** A labelled section with a coloured left border. Breakage's three parts. */
export function AccentSection({
  label,
  colour,
  children,
}: {
  label: string;
  colour: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingLeft: 12,
        borderLeft: `3px solid ${colour}`,
      }}
    >
      <span
        style={{
          ...labelText,
          color: colour,
          textTransform: "uppercase",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

// --- monospace ---------------------------------------------------------------
//
// The read surface for code in this repo is a styled <pre>: ContentBlockViewer
// renders block.text_content into a bordered, dark, monospace block with no
// highlighter behind it. This matches that treatment. Monaco is the EDIT
// surface (CodeBlock.tsx) and stays out of this chunk — it is ~3MB.

export const MONO_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export const monoBlockStyle: CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 8,
  padding: "12px 14px",
  margin: 0,
  fontFamily: MONO_STACK,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.65,
  color: TEXT_PRIMARY,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowX: "auto",
};

/**
 * A monospace block with whitespace preserved, optionally collapsed to a line
 * count with a reveal. Collapsing counts real lines rather than clamping, so
 * what is hidden is exactly what the reveal shows.
 */
export function MonoBlock({
  text,
  collapseTo,
  style,
  children,
}: {
  text: string;
  collapseTo?: number;
  style?: CSSProperties;
  /** Rendered instead of the raw text when the caller tokenises it. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const lines = text.split("\n");
  const collapsible = typeof collapseTo === "number" && lines.length > collapseTo;
  const shown = collapsible && !open ? lines.slice(0, collapseTo).join("\n") : text;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <pre style={{ ...monoBlockStyle, ...style }}>
        {children && (!collapsible || open) ? children : shown}
        {collapsible && !open ? (
          <span style={{ color: TEXT_MUTED }}>{"\n…"}</span>
        ) : null}
      </pre>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{
            ...labelText,
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: TEAL,
            fontSize: 12,
          }}
        >
          {open ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Prompt text with {{variables}} tinted. Tokenised into spans rather than set
 * as HTML — the payload is creator-supplied and never becomes markup.
 */
export function withVariablesHighlighted(text: string, colour: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\{\{\s*[\w.-]+\s*\}\}/g;
  let cursor = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(
      <span key={`${match.index}-${match[0]}`} style={{ color: colour, fontWeight: 500 }}>
        {match[0]}
      </span>
    );
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

// --- tables ------------------------------------------------------------------

export const cellStyle: CSSProperties = {
  ...bodyText,
  verticalAlign: "top",
  padding: "7px 12px 7px 0",
  borderBottom: `1px solid ${HAIRLINE}`,
};

export const headCellStyle: CSSProperties = {
  ...labelText,
  fontSize: 11,
  textAlign: "left",
  padding: "0 12px 6px 0",
  borderBottom: `1px solid ${HAIRLINE}`,
  whiteSpace: "nowrap",
};

/** Wide tables scroll inside their own card rather than widening the page. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto" }}>
        {children}
      </table>
    </div>
  );
}

/** A list field as a table, capped, with the cap stated rather than implied. */
export function SampleTable({
  members,
  records,
  cap = 5,
}: {
  members: FieldDef[];
  records: Rec[];
  cap?: number;
}) {
  if (records.length === 0) return null;
  const shown = records.slice(0, cap);
  const columns: FieldDef[] =
    members.length > 0
      ? members
      : Array.from(new Set(shown.flatMap((record) => Object.keys(record)))).map((key) => ({
          key,
          label: key,
          type: "string" as const,
        }));

  return (
    <Stack gap={6}>
      <TableScroll>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={headCellStyle}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((record, index) => (
            <tr key={index}>
              {columns.map((column) => {
                const value = record[column.key];
                return (
                  <td key={column.key} style={cellStyle}>
                    {isPresent(value) ? (
                      <span style={{ fontFamily: MONO_STACK, fontSize: 11.5, wordBreak: "break-word" }}>
                        {String(value)}
                      </span>
                    ) : (
                      <span style={{ color: TEXT_MUTED }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </TableScroll>
      <Caption>
        {records.length > cap
          ? `Sample of ${formatNumber(records.length)} — showing the first ${shown.length}`
          : `Sample of ${formatNumber(records.length)}`}
      </Caption>
    </Stack>
  );
}

// --- references --------------------------------------------------------------

/**
 * A node_id reference as the referenced node's title. Falls back to a short id
 * when the reference points outside the loaded tree — a tray node, or a node
 * on another build — rather than printing a raw uuid at full length.
 */
export function NodeRef({
  id,
  resolveNode,
  colour = TEAL,
}: {
  id: string | undefined;
  resolveNode: ResolveNode;
  colour?: string;
}) {
  if (!id) return null;
  const target = resolveNode(id);
  const text = target?.title?.trim() || `Node ${id.slice(0, 8)}`;
  return (
    <Chip colour={target ? colour : TEXT_SECONDARY} tinted={Boolean(target)} title={id}>
      {text}
    </Chip>
  );
}

// --- the leftovers -----------------------------------------------------------

/**
 * Every schema field the renderer did not handle, through GenericPayload.
 *
 * This is what keeps a typed renderer from becoming a lie when the registry
 * grows: the renderer promotes what it knows and everything else still prints.
 */
export function Rest({
  node,
  nodeType,
  handled,
}: {
  node: BuildNode;
  nodeType?: NodeType;
  handled: string[];
}) {
  const payload = payloadOf(node);
  const skip = new Set(handled);
  const fields = fieldsOf(nodeType).filter(
    (field) => !skip.has(field.key) && isPresent(payload[field.key])
  );

  // An unregistered type has no schema at all: fall back to the raw keys so a
  // creator's content is never lost to a missing registry row.
  const extraKeys =
    fieldsOf(nodeType).length === 0
      ? Object.keys(payload).filter((key) => !skip.has(key) && isPresent(payload[key]))
      : [];

  if (fields.length === 0 && extraKeys.length === 0) return null;

  const effective: FieldDef[] =
    fields.length > 0
      ? fields
      : extraKeys.map((key) => ({
          key,
          label: key,
          type: Array.isArray(payload[key]) ? ("list" as const) : ("string" as const),
        }));

  return <GenericPayload payload={payload as NodePayload} fields={effective} />;
}

/**
 * The fallback renderer, adapted to the renderer contract.
 *
 * GenericPayload takes a payload and a field list rather than NodeProps, so it
 * is wrapped here. It walks whatever schema the type declares, which means a
 * node with an unrecognised renderer still prints every field its creator
 * filled in.
 *
 * It lives in shared.tsx rather than in index.ts so that the registry stays a
 * plain .ts module with no JSX in it.
 */
export function GenericRenderer({ node, nodeType }: NodeProps) {
  return (
    <div data-visual-slot="renderer-generic" style={{ minWidth: 0 }}>
      <GenericPayload payload={node.payload as NodePayload} fields={fieldsOf(nodeType)} />
    </div>
  );
}

// --- the default copy text ---------------------------------------------------

/**
 * The fallback the copy control uses when a renderer module exports no
 * getCopyText: the first required text field in the schema.
 */
export function firstRequiredTextField(node: BuildNode, nodeType?: NodeType): string | null {
  const payload = payloadOf(node);
  const field =
    fieldsOf(nodeType).find((candidate) => candidate.type === "text" && candidate.required) ??
    fieldsOf(nodeType).find((candidate) => candidate.type === "text");
  if (!field) return null;
  return str(payload, field.key) ?? null;
}

/** Present scalar fields as "label: value" lines. Used by config copy text. */
export function scalarsAsText(node: BuildNode, nodeType?: NodeType): string | null {
  const payload = payloadOf(node);
  const lines = fieldsOf(nodeType)
    .filter((field) => field.type !== "list" && isPresent(payload[field.key]))
    .map((field) => `${field.label}: ${String(payload[field.key])}`);
  return lines.length > 0 ? lines.join("\n") : null;
}
