// Primitives every typed renderer is built from.
//
// The typed renderers differ in what they emphasise, not in how they look. A
// stat row is a stat row whether it is counting dataset records or eval passes,
// so it lives here once. Everything is inline style={{ }} — Tailwind's
// generated utilities win over hand-written classes at build time, so this
// route styles nothing with a class.

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import type { NodePayload } from "@/lib/build";
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
import { MONO_STACK, fieldsOf, type Stat } from "./payload";
import type { NodeProps } from "./types";

// --- surfaces ----------------------------------------------------------------

const monoSurface: CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 8,
  padding: "12px 14px",
};

/**
 * A block of text kept exactly as the creator wrote it. Whitespace is the
 * content in a prompt; collapsing it would change what the reader is copying.
 */
export function MonoBlock({
  text,
  accent,
  maxLines,
}: {
  text: string;
  accent?: string;
  maxLines?: number;
}) {
  const clamp: CSSProperties =
    maxLines === undefined
      ? {}
      : {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: maxLines,
          overflow: "hidden",
        };

  return (
    <pre
      // jsdom drops -webkit-* declarations, so the clamp is also stated as an
      // attribute. It is what the reveal test asserts on.
      data-clamped-lines={maxLines}
      style={{
        ...monoSurface,
        ...(accent ? { borderLeft: `2px solid ${hexToRgba(accent, 0.55)}` } : {}),
        fontFamily: MONO_STACK,
        fontSize: 12.5,
        fontWeight: 400,
        lineHeight: 1.65,
        color: TEXT_PRIMARY,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        ...clamp,
      }}
    >
      {text}
    </pre>
  );
}

/** A long block collapsed to `lines`, with a control to see the rest. */
export function Revealable({
  text,
  lines,
  accent,
  label,
}: {
  text: string;
  lines: number;
  accent?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // Clamping a block shorter than the clamp adds a control that does nothing.
  const clamped = text.split("\n").length > lines || text.length > lines * 90;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <MonoBlock text={text} accent={accent} maxLines={clamped && !open ? lines : undefined} />
      {clamped ? (
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
            color: accent ?? TEXT_SECONDARY,
            fontSize: 11,
          }}
        >
          {open ? `Hide ${label}` : `Show the whole ${label}`}
        </button>
      ) : null}
    </div>
  );
}

/** A labelled block. The label is quiet; the content is what the reader wants. */
export function Section({
  label,
  children,
  accent,
}: {
  label?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <span style={{ ...labelText, color: accent ?? TEXT_SECONDARY, fontSize: 11 }}>
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Prose as written, wrapped, never collapsed. */
export function Prose({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <p
      style={{
        ...bodyText,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...(dim ? { color: TEXT_SECONDARY } : {}),
      }}
    >
      {children}
    </p>
  );
}

/** The quiet line under a block: model, params, dates. Never a heading. */
export function Caption({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <span
      style={{
        ...bodyText,
        fontSize: 11.5,
        color: TEXT_MUTED,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

/** The headline numbers, read before anything else on the card. */
export function StatRow({ stats, accent }: { stats: Stat[]; accent?: string }) {
  if (stats.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
      {stats.map((stat) => (
        <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: accent ?? TEXT_PRIMARY,
              lineHeight: 1.2,
            }}
          >
            {stat.value}
          </span>
          <span style={{ ...labelText, fontSize: 10.5, textTransform: "uppercase", color: TEXT_MUTED }}>
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Scalar detail, two columns. Labels left, values right, one row per field. */
export function DetailGrid({ items }: { items: Stat[] }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,auto) minmax(0,1fr)",
        columnGap: 16,
        rowGap: 6,
        alignItems: "baseline",
      }}
    >
      {items.map((item) => (
        <Fragment key={item.label}>
          <span style={{ ...labelText, fontSize: 11, whiteSpace: "nowrap" }}>{item.label}</span>
          <span style={{ ...bodyText, wordBreak: "break-word" }}>{item.value}</span>
        </Fragment>
      ))}
    </div>
  );
}

export function Chip({
  children,
  colour,
  dim,
}: {
  children: ReactNode;
  colour?: string;
  dim?: boolean;
}) {
  const tint = colour ?? TEXT_SECONDARY;
  return (
    <span
      style={{
        ...bodyText,
        fontSize: 12,
        padding: "2px 9px",
        borderRadius: 6,
        border: `1px solid ${colour ? hexToRgba(colour, 0.35) : HAIRLINE}`,
        background: colour ? hexToRgba(colour, 0.12) : "transparent",
        color: dim ? TEXT_MUTED : tint,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;
}

export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ ...bodyText, color: TEAL, textDecoration: "none", wordBreak: "break-all" }}
    >
      {children ?? href}
    </a>
  );
}

/** A small table. Horizontal overflow scrolls inside itself, never the page. */
export function MiniTable({
  columns,
  rows,
  accent,
  markedRow,
}: {
  columns: string[];
  rows: ReactNode[][];
  accent?: string;
  /** Index of the row to mark with an accent left border, if any. */
  markedRow?: number;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto" }}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={`${column}-${index}`}
                style={{
                  ...labelText,
                  fontSize: 11,
                  textAlign: "left",
                  padding: "4px 12px 6px 0",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  whiteSpace: "nowrap",
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const marked = markedRow === rowIndex;
            return (
              <tr
                key={rowIndex}
                data-marked={marked ? "true" : undefined}
                style={
                  marked && accent
                    ? { background: hexToRgba(accent, 0.08) }
                    : undefined
                }
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={{
                      ...bodyText,
                      verticalAlign: "top",
                      padding: "7px 12px 7px 0",
                      borderBottom: `1px solid ${HAIRLINE}`,
                      ...(cellIndex === 0 && marked && accent
                        ? { borderLeft: `3px solid ${accent}`, paddingLeft: 9 }
                        : {}),
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The wrapper every renderer's content sits in: one column, even rhythm. */
export function Stack({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

/**
 * The fallback, adapted to the renderer contract.
 *
 * An unregistered type, an unmapped renderer key and a payload nobody wrote a
 * renderer for all land here rather than on a blank card.
 */
export function GenericPayloadRenderer({ node, nodeType }: NodeProps) {
  return (
    <GenericPayload
      payload={node.payload as NodePayload}
      fields={fieldsOf(nodeType)}
    />
  );
}
