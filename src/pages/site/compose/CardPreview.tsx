/* CA-16 P5: the Classification Card's preview: the Gallery card's build line as the Gallery draws it, with no cover. The
   title, the Regulated area tag and the two lines are the Gallery's own pieces (FeedPost draws no summary, so neither
   does this). */

import { ClassificationLines, RegulatedTag } from "@/components/classify/ClassificationBits";
import { classificationLines } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { text } from "./refinedStyles";

export interface PreviewMaker {
  id: string | null;
  name: string | null;
  handle: string | null;
  avatar: string | null;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export function CardPreview({ title, classification, maker }: { title: string; classification: Classification | null; maker?: PreviewMaker | null }) {
  const lines = classificationLines(classification);
  const name = (maker?.name ?? maker?.handle ?? "").trim();
  return (
    <section aria-label="Preview" data-testid="card-preview">
      <article style={{ padding: "14px 16px", boxSizing: "border-box", background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: 10, boxShadow: t.wellShadow, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {maker ? (
            <span aria-hidden="true" style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 13, background: t.controlOn, display: "inline-flex", alignItems: "center", justifyContent: "center", ...text(10.5, 500, t.text) }}>
              {initialsOf(name) || "?"}
            </span>
          ) : null}
          {name ? <span style={{ ...text(13, 500, t.text), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span> : null}
          {maker?.handle ? <span style={{ ...text(13, 400, t.label), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`@${maker.handle}`}</span> : null}
          <span style={{ marginLeft: "auto", fontFamily: DM_MONO, fontSize: 11.5, color: t.label }}>Preview</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 4, minWidth: 0 }}>
          <span style={{ ...text(15, 500, title.trim() ? t.text : t.label), overflowWrap: "anywhere", lineHeight: "20px" }}>{title.trim() || "Name your build"}</span>
          {lines.regulated ? <RegulatedTag /> : null}
        </div>
        {lines.line1.length > 0 || lines.line2.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <ClassificationLines lines={lines} />
          </div>
        ) : null}
      </article>
    </section>
  );
}
