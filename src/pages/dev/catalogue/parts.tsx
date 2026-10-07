/* UI-P06 — the pieces every section of /dev/kit/components is made of.

   The reference catalogue (design/reference/components/{noon,dusk}.html) lays
   every section out the same way: a padded band with a Sentient title and a
   one-line note, then rows of examples, each with a mono caption under it. These
   are that layout, once, so a section is its examples and nothing else. The
   `data-catalogue` value is the join key the compare harness uses against the
   reference, so it must be the reference's own name for the section.

   UI-P53: the band's padding, the gaps and the note's size follow the
   catalogue as UI-P52 tightened it (28px 40px → 20px 29px, gaps 24 → 17). */

import type { CSSProperties, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { display, FIGTREE, mono } from "@/lib/theme/type";

export function Section({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <section
      data-catalogue={name}
      style={{ padding: "20px 29px", borderBottom: `1px solid ${t.hairline}` }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 13 }}>
        <h2 style={{ ...display(30), margin: 0, lineHeight: "normal", letterSpacing: "-0.02em", color: t.text }}>{name}</h2>
        <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{note}</span>
      </div>
      {children}
    </section>
  );
}

/** A row of examples. */
export function Row({
  gap = 17,
  style,
  children,
}: {
  gap?: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "center", ...style }}>{children}</div>
  );
}

/** One example with its caption underneath. */
export function Example({
  caption,
  children,
  style,
}: {
  caption: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {children}
      <div
        style={{
          ...mono(10, { caps: false }),
          lineHeight: "normal",
          letterSpacing: ".08em",
          color: t.label,
          marginTop: 4,
        }}
      >
        {caption}
      </div>
    </div>
  );
}
