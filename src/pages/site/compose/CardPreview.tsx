/* CA-16 P5: the Classification Card's preview: the Gallery card's build line as the Gallery draws it, with no cover. The
   title, the Regulated area tag and the two lines are the Gallery's own pieces (FeedPost draws no summary, so neither
   does this). */

import { Avatar } from "@/components/brand/Avatar";
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

export function CardPreview({ title, classification, maker }: { title: string; classification: Classification | null; maker?: PreviewMaker | null }) {
  const lines = classificationLines(classification);
  const name = (maker?.name ?? maker?.handle ?? "").trim();
  return (
    <section aria-label="Preview" data-testid="card-preview">
      <article
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 16px 16px",
          boxSizing: "border-box",
          background: t.module,
          border: `1px solid ${t.moduleBorder}`,
          borderRadius: 8,
          boxShadow: t.moduleShadow,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {maker ? <Avatar size={24} userId={maker.id ?? "preview"} name={name || "Maker"} src={maker.avatar} /> : null}
          {name ? <span style={{ ...text(13, 500, t.text), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span> : null}
          {maker?.handle ? <span style={{ ...text(13, 400, t.label), minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`@${maker.handle}`}</span> : null}
          <span style={{ marginLeft: "auto", fontFamily: DM_MONO, fontSize: 11, color: t.label }}>Preview</span>
        </div>
        {/* The Gallery card's build line: the title, the Regulated area tag beside it, the two lines under. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 6, minWidth: 0 }}>
          <span style={{ ...text(15, 500, title.trim() ? t.text : t.label), overflowWrap: "anywhere", lineHeight: 1.35 }}>{title.trim() || "Name your build"}</span>
          {lines.regulated ? <RegulatedTag /> : null}
        </div>
        <ClassificationLines lines={lines} />
      </article>
    </section>
  );
}
