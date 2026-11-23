/* Synth 06: a section's head. The fact is the heading, 20/600 ("36 drafts"), 16px side padding and 8px under it. When the
   section has a page of its own, a small ghost icon button with a chevron-right sits at the right, named "Open <heading>".
   The `meta` prop is kept so callers compile, and it no longer renders: a caller that passed a count and a title now
   passes the count as the title. */

import type { ElementType, ReactNode } from "react";
import { PageLink as Link } from "@/lib/routing/PageLink";

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface SectionHeadProps {
  title: ReactNode;
  /** Kept for callers; no longer rendered. The fact is the title. */
  meta?: ReactNode;
  /** Where the chevron goes. Without it there is no chevron. */
  to?: string;
  /** The section's name, for the chevron's accessible name: "Open <openName>". Defaults to the title when that is text. */
  openName?: string;
  /** Render the title as a heading of this level. A plain block when absent. */
  headingLevel?: 1 | 2 | 3 | 4;
}

/** The chevron alone, for a head drawn another way: a ghost icon button, 32 (44 touch) with a chevron-right. */
export function SectionChevron({ to, name }: { to: string; name: string }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      aria-label={`Open ${name}`}
      {...handlers}
      style={{
        boxSizing: "border-box",
        flexShrink: 0,
        width: phone ? TOUCH_MIN : 32,
        height: phone ? TOUCH_MIN : 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: r.full,
        background: state.hovered ? t.module : "transparent",
        color: t.text2,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name="chev" size={16} />
    </Link>
  );
}

export function SectionHead({ title, to, openName, headingLevel }: SectionHeadProps) {
  const Title: ElementType = headingLevel ? (`h${headingLevel}` as ElementType) : "div";
  const name = openName ?? (typeof title === "string" ? title : "");
  return (
    <div data-ui="section-head" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px 8px", fontFamily: FIGTREE }}>
      <Title style={{ flexGrow: 1, minWidth: 0, margin: 0, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text }}>{title}</Title>
      {to ? <SectionChevron to={to} name={name} /> : null}
    </div>
  );
}

export default SectionHead;
