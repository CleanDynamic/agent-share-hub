// The part viewer (UI-P11): a frame for ONE part of a build, not a browser.
//
// A solid `--solid` panel, radius 16, hairline `--glass-border`, `--shadow-card`,
// laid out as a column:
//
//   1. a 46px strip — a 96px block in `--viewer-block` holding "PART 01", then the
//      raised tab in `--tab`, joined to the page below it by dropping its bottom
//      edge, carrying the part's `CategoryChip` and "01 · System prompt";
//   2. the page's `UnderlineTabs` at 12px;
//   3. the body: a Run / Understand switch with a Copy button, the layer's blurb,
//      and the part's content.
//
// ON A PHONE (`variant="phone"`, UI-P29) the strip is 44px with a 78px block,
// the tab carries the chip and the part's name without its number, there is no
// tab row inside — the page's tabs are a sideways row of their own above the
// viewer — and the body is a step larger: a 34/12 switch and Copy, a 12px blurb
// and 15px content.
//
// NO WINDOW DOTS, NO CLOSE BUTTON. The strip borrows a browser's silhouette for
// the shape of its tab and nothing else: there is nothing here to close, and
// three dots would say there was.
//
// CONTROLLED. The viewer holds no state: the page owns which tab and which mode
// are current, because both of them decide what content to load.

import type { ReactNode } from "react";
import { Copy } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Button } from "./Button";
import { CategoryChip } from "./CategoryChip";
import { Segmented, type SegmentedItem } from "./Segmented";
import { UnderlineTabs, type UnderlineTab } from "./UnderlineTabs";

export type PartViewerMode = "run" | "understand";

const MODES: readonly SegmentedItem<PartViewerMode>[] = [
  { value: "run", label: "Run" },
  { value: "understand", label: "Understand" },
];

export interface PartViewerProps<V extends string = string> {
  /** The part's place in the build, from 1. Drawn "01". Null when the build has no parts yet. */
  number: number | null;
  /** The part's category key (`instruction`, `configuration`, …) and its label. No chip when the label is empty. */
  category: string;
  categoryLabel: string;
  /** "System prompt". */
  name: string;
  /** The page's sections: Anatomy, Watch it get built, … Not drawn on a phone. */
  tabs: readonly UnderlineTab<V>[];
  tab: V;
  onTabChange: (tab: V) => void;
  mode: PartViewerMode;
  onModeChange: (mode: PartViewerMode) => void;
  /** What this layer of the part is for, in a line. */
  blurb: ReactNode;
  /** The part's content. */
  children: ReactNode;
  onCopy?: () => void;
  /** The tablist's accessible name. */
  tabsLabel?: string;
  /** The body's id, for the tabs' `aria-controls`. */
  panelId?: string;
  /** `phone`: the 390 board's viewer — a 44px strip, no tab row, a larger body. */
  variant?: "desktop" | "phone";
}

export function PartViewer<V extends string = string>({
  number,
  category,
  categoryLabel,
  name,
  tabs,
  tab,
  onTabChange,
  mode,
  onModeChange,
  blurb,
  children,
  onCopy,
  tabsLabel = "Sections of this build",
  panelId,
  variant = "desktop",
}: PartViewerProps<V>) {
  const phone = variant === "phone";
  const n = number === null ? "—" : String(number).padStart(2, "0");
  const current = tabs.find((x) => x.value === tab);

  return (
    <section
      data-ui="part-viewer"
      data-variant={phone ? "phone" : undefined}
      aria-label={number === null ? name : `Part ${n}: ${name}`}
      style={{
        height: phone ? undefined : "100%",
        borderRadius: r.panel,
        overflow: "hidden",
        background: t.solid,
        border: `1px solid ${t.glassBorder}`,
        boxShadow: t.shadowCard,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", height: phone ? 44 : 46, flexShrink: 0 }}>
        <div
          style={{
            /* The reference's width is the content box: the block is 96 + 16 (78 + 14 on a phone) across. */
            width: phone ? 78 : 96,
            boxSizing: "content-box",
            flexShrink: 0,
            background: t.viewerBlock,
            borderRadius: phone ? "0 0 12px 0" : "0 0 14px 0",
            display: "flex",
            alignItems: "center",
            gap: 7,
            paddingLeft: phone ? 14 : 16,
            fontFamily: DM_MONO,
            fontSize: phone ? 10 : 11,
            letterSpacing: ".08em",
            color: t.text2,
          }}
        >
          PART {n}
        </div>
        <div
          style={{
            flexGrow: 1,
            minWidth: 0,
            margin: "7px 0 0 7px",
            background: t.tab,
            border: `1px solid ${t.headerBorder}`,
            borderBottom: 0,
            borderRadius: "12px 0 0 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: phone ? 10 : 12,
            fontFamily: FIGTREE,
            fontSize: phone ? 13 : 12,
            fontWeight: 600,
            color: t.text,
          }}
        >
          {categoryLabel ? <CategoryChip category={category} label={categoryLabel} /> : null}
          {/* A long name clips to one line rather than growing the strip. */}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {phone || number === null ? name : `${n} · ${name}`}
          </span>
        </div>
      </div>

      {phone ? null : (
        <div style={{ padding: "10px 14px 0" }}>
          <UnderlineTabs tabs={tabs} value={tab} onChange={onTabChange} fontSize={12} label={tabsLabel} />
        </div>
      )}

      <div
        id={panelId}
        role={phone ? undefined : "tabpanel"}
        aria-labelledby={phone ? undefined : current?.id}
        style={{
          padding: phone ? "14px 16px" : "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Segmented
            items={MODES}
            value={mode}
            onChange={onModeChange}
            size={phone ? 34 : 30}
            fontSize={phone ? 12 : 11}
            label="View"
          />
          <Button variant="secondary" size={phone ? 34 : 30} fontSize={12} icon={Copy} onClick={onCopy}>
            Copy
          </Button>
        </div>
        <div style={{ fontFamily: FIGTREE, fontSize: phone ? 12 : 11, color: t.text2 }}>{blurb}</div>
        <div style={{ fontFamily: FIGTREE, fontSize: phone ? 15 : 14, lineHeight: 1.65, color: t.text }}>{children}</div>
      </div>
    </section>
  );
}

export default PartViewer;
