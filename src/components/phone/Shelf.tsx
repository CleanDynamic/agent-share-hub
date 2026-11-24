// A shelf (prompt 17): a row that scrolls sideways. 156-wide items 12 apart, padding 0 16 8, snapping to item starts. An item is
// a 156 square on Card (radius 8) holding a number in mono 31 Text 2, then a title 13/600 and a line 13 Text 3.

import type { ReactNode } from "react";

import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const SHELF_ITEM = 156;

export interface ShelfItem {
  id: string;
  number: ReactNode;
  title: string;
  line?: string;
  /** Makes the item a link. */
  to?: string;
  onSelect?: () => void;
}

export interface ShelfProps {
  items: readonly ShelfItem[];
  /** The row's accessible name. */
  label: string;
}

function Item({ item }: { item: ShelfItem }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement & HTMLButtonElement & HTMLDivElement>();
  const body = (
    <>
      <span style={{ fontFamily: DM_MONO, fontSize: 31, lineHeight: "36px", fontWeight: 400, color: t.text2, fontVariantNumeric: "tabular-nums" }}>{item.number}</span>
      <span style={{ marginTop: "auto", fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, lineHeight: "16px", color: t.text, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</span>
      {item.line ? <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.line}</span> : null}
    </>
  );
  const style = {
    boxSizing: "border-box" as const,
    flex: `0 0 ${SHELF_ITEM}px`,
    width: SHELF_ITEM,
    height: SHELF_ITEM,
    padding: 12,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    alignItems: "flex-start",
    textAlign: "left" as const,
    border: 0,
    borderRadius: 8,
    background: t.module,
    color: t.text,
    textDecoration: "none",
    scrollSnapAlign: "start" as const,
    cursor: item.to || item.onSelect ? "pointer" : "default",
    ...ring(state.focusVisible),
  };
  if (item.to) {
    return (
      <PageLink to={item.to} role="listitem" {...handlers} style={style}>
        {body}
      </PageLink>
    );
  }
  if (item.onSelect) {
    return (
      <button type="button" role="listitem" onClick={item.onSelect} {...handlers} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div role="listitem" style={style}>
      {body}
    </div>
  );
}

export function Shelf({ items, label }: ShelfProps) {
  return (
    <div
      data-ui="shelf"
      className="bg-scroll-row"
      role="list"
      aria-label={label}
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        scrollbarWidth: "none",
        scrollSnapType: "x mandatory",
        scrollPaddingLeft: PHONE_MARGIN,
        padding: `0 ${PHONE_MARGIN}px 8px`,
      }}
    >
      {items.map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </div>
  );
}

export default Shelf;
