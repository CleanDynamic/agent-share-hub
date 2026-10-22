/* CA-16 P5 — the Classification Card's preview: the Gallery card's build line as the Gallery draws it, with no cover. The
   title, the Regulated area tag and the two lines are the Gallery's own pieces (FeedPost draws no summary, so neither
   does this). */

import { ClassificationLines, RegulatedTag } from "@/components/classify/ClassificationBits";
import { classificationLines } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";
import { t } from "@/lib/theme/tokens";

import { text } from "./refinedStyles";

export function CardPreview({ title, classification }: { title: string; classification: Classification | null }) {
  const lines = classificationLines(classification);
  return (
    <section aria-label="Preview" data-testid="card-preview" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ ...text(12.5, 500, t.label), margin: 0 }}>Preview</h2>
      <article
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "12px 14px 14px",
          boxSizing: "border-box",
          background: t.module,
          border: `1px solid ${t.moduleBorder}`,
          borderRadius: 8,
          boxShadow: t.moduleShadow,
          minWidth: 0,
        }}
      >
        {/* The Gallery card's build line: the title at 13/500, the Regulated area tag beside it, the two lines under. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 6, minWidth: 0 }}>
          <span style={{ ...text(13, 500, title.trim() ? t.text : t.label), overflowWrap: "anywhere", lineHeight: 1.4 }}>{title.trim() || "Name your build"}</span>
          {lines.regulated ? <RegulatedTag /> : null}
        </div>
        <ClassificationLines lines={lines} />
      </article>
    </section>
  );
}
