// The phone's section head (prompt 17): the fact as a 17/22 600 heading (29g: the phone has
// no 20; it was 20/24 at -0.01em), padding 20 16 8, and an optional
// small link at the right (13, underlined). Never a label with the fact under it: the heading is the fact.

import type { ElementType, ReactNode } from "react";

import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface SectionFactProps {
  /** The fact: "36 drafts", "8 sessions". */
  fact: ReactNode;
  /** Heading level; a plain block when absent. */
  headingLevel?: 2 | 3 | 4;
  link?: { label: string; to: string };
}

export function SectionFact({ fact, headingLevel = 2, link }: SectionFactProps) {
  const Title: ElementType = `h${headingLevel}`;
  return (
    <div data-ui="section-fact" style={{ display: "flex", alignItems: "baseline", gap: 12, padding: `20px ${PHONE_MARGIN}px 8px`, fontFamily: FIGTREE }}>
      <Title style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{fact}</Title>
      {link ? (
        <PageLink
          to={link.to}
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-10px 0", fontSize: 13, lineHeight: "16px", color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          {link.label}
        </PageLink>
      ) : null}
    </div>
  );
}

export default SectionFact;
