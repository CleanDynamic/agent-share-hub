/* CA-16 P5 — the Classification Card's preview: the gallery card as the Gallery draws it, under the title and the
   summary, with no cover. The two lines and the Regulated area tag are the Gallery's own pieces. */

import { ClassificationLines, RegulatedTag } from "@/components/classify/ClassificationBits";
import { classificationLines } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";
import { t } from "@/lib/theme/tokens";
import { display } from "@/lib/theme/type";

import { text } from "./refinedStyles";

export function CardPreview({ title, summary, classification }: { title: string; summary: string; classification: Classification | null }) {
  const lines = classificationLines(classification);
  return (
    <section aria-label="Preview" data-testid="card-preview" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ ...text(12.5, 500, t.label), margin: 0 }}>Preview</h2>
      <article
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 14px 14px",
          boxSizing: "border-box",
          background: t.module,
          border: `1px solid ${t.moduleBorder}`,
          borderRadius: 8,
          boxShadow: t.moduleShadow,
          minWidth: 0,
        }}
      >
        <h3 style={{ ...display(20), margin: 0, color: title.trim() ? t.text : t.label, textWrap: "balance", overflowWrap: "anywhere" }}>
          {title.trim() || "Name your build"}
          {lines.regulated ? (
            <>
              {" "}
              <RegulatedTag />
            </>
          ) : null}
        </h3>
        {summary.trim() ? (
          <p
            style={{ margin: 0, ...text(14, 400, t.text2), lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
          >
            {summary.trim()}
          </p>
        ) : null}
        <ClassificationLines lines={lines} />
      </article>
    </section>
  );
}
