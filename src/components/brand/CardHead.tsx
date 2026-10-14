// The card head (UI-P85, refined look): a title in Geist 13.5/500, an optional subtitle in 12 `--text2` four below
// it, and an optional action at the top right (an `IconButton` or a chevron link). `PanelHead` renders this under the
// refined look, so a panel's head and a card's head are one piece.

import type { ElementType, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface CardHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** An `IconButton` or a chevron link, aligned to the top right. */
  action?: ReactNode;
  /** Render the title as a heading of this level. A plain block when absent. */
  headingLevel?: 1 | 2 | 3 | 4;
}

export function CardHead({ title, subtitle, action, headingLevel }: CardHeadProps) {
  const Title: ElementType = headingLevel ? (`h${headingLevel}` as ElementType) : "div";
  return (
    <div data-ui="card-head" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <Title
          style={{
            margin: 0,
            fontFamily: FIGTREE,
            fontSize: 13.5,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: "normal",
            color: t.text,
          }}
        >
          {title}
        </Title>
        {subtitle ? (
          <div style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {action ? <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>{action}</div> : null}
    </div>
  );
}

export default CardHead;
