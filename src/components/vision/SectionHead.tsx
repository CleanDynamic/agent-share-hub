/* SV-02: a section's head, as the vision boards draw it (series README, Visual grammar 3).

   Title 14/500 at line-height 1.3, the meta line 12/400 in `--label` two below it, and, when the section has a page of
   its own, a 28px chevron at the top right: `--control` with a 1px `--control-border`, radius 6, a 12px chevron in
   `--text`. The chevron is a link named "Open <section>". It is a `PageLink` (SV-04), so it changes page through `go()`. On a phone the
   hit area reaches 44px by padding with a matching negative margin, so the drawn 28px does not change. */

import type { ElementType, ReactNode } from "react";
import { PageLink as Link } from "@/lib/routing/PageLink";

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface SectionHeadProps {
  title: ReactNode;
  /** The line under the title: a count, a period, what the section holds. */
  meta?: ReactNode;
  /** Where the chevron goes. Without it there is no chevron. */
  to?: string;
  /** The section's name, for the chevron's accessible name: "Open <openName>". Defaults to the title when that is text. */
  openName?: string;
  /** Render the title as a heading of this level. A plain block when absent. */
  headingLevel?: 1 | 2 | 3 | 4;
}

function Chevron({ to, name }: { to: string; name: string }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      aria-label={`Open ${name}`}
      {...handlers}
      style={{
        boxSizing: "content-box",
        flexShrink: 0,
        width: 28,
        height: 28,
        padding: phone ? (TOUCH_MIN - 28) / 2 : 0,
        margin: phone ? (28 - TOUCH_MIN) / 2 : 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        borderRadius: r.control,
        color: t.text,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          boxSizing: "border-box",
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: r.control,
          ...controlPaint(state),
        }}
      >
        <Glyph name="chev" size={12} />
      </span>
    </Link>
  );
}

export function SectionHead({ title, meta, to, openName, headingLevel }: SectionHeadProps) {
  const Title: ElementType = headingLevel ? (`h${headingLevel}` as ElementType) : "div";
  const name = openName ?? (typeof title === "string" ? title : "");
  return (
    <div data-ui="section-head" style={{ display: "flex", alignItems: "flex-start", gap: 12, fontFamily: FIGTREE }}>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <Title style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: t.text }}>{title}</Title>
        {meta ? (
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 400, lineHeight: "normal", color: t.label }}>{meta}</div>
        ) : null}
      </div>
      {to ? <Chevron to={to} name={name} /> : null}
    </div>
  );
}

export default SectionHead;
