// A phone row (prompt 17): at least 56 tall, padding 8 16, gap 12. An optional leading slot (a 40 avatar at radius 9, a 40 icon
// square on Raised at radius 10, or a grip), a text column (title 15/20 600 on one line, a line 13/16 Text 3 on one line), and an
// optional trailing slot (a small button, a count, a chevron at 20 Text 3). The whole row is a link or a button when it goes
// somewhere; the trailing slot of a row that is itself a control is drawn, not nested.

import type { CSSProperties, ReactNode } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { PHONE_MARGIN, PHONE_ROW } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export type PhoneRowLead =
  | { kind: "avatar"; node: ReactNode }
  | { kind: "icon"; icon: MobileIconName }
  | { kind: "grip" };

export type PhoneRowTrail =
  | { kind: "chevron" }
  | { kind: "count"; value: ReactNode }
  | { kind: "node"; node: ReactNode };

export interface PhoneRowProps {
  title: string;
  line?: string;
  lead?: PhoneRowLead;
  trail?: PhoneRowTrail;
  /** A link row. */
  to?: string;
  /** A button row. */
  onSelect?: () => void;
  "data-testid"?: string;
}

function Lead({ lead }: { lead: PhoneRowLead }) {
  if (lead.kind === "avatar") {
    return <span style={{ width: 40, height: 40, borderRadius: 9, overflow: "hidden", flexShrink: 0, display: "inline-flex" }}>{lead.node}</span>;
  }
  if (lead.kind === "icon") {
    return (
      <span style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: t.control, color: t.text2 }}>
        <MobileIcon name={lead.icon} size={20} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={{ width: 24, height: 40, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label }}>
      <MobileIcon name="grip" size={20} />
    </span>
  );
}

function Trail({ trail }: { trail: PhoneRowTrail }) {
  if (trail.kind === "chevron") {
    return (
      <span aria-hidden="true" style={{ flexShrink: 0, color: t.label, display: "inline-flex" }}>
        <MobileIcon name="chevr" size={20} />
      </span>
    );
  }
  if (trail.kind === "count") {
    return <span style={{ flexShrink: 0, fontFamily: DM_MONO, fontSize: 13, color: t.text2, fontVariantNumeric: "tabular-nums" }}>{trail.value}</span>;
  }
  return <span style={{ flexShrink: 0, display: "inline-flex" }}>{trail.node}</span>;
}

export function PhoneRow({ title, line, lead, trail, to, onSelect, ...rest }: PhoneRowProps) {
  const { state, handlers } = useInteractive<HTMLAnchorElement & HTMLButtonElement & HTMLDivElement>();
  const style: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    minHeight: PHONE_ROW,
    padding: `8px ${PHONE_MARGIN}px`,
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: 0,
    background: "transparent",
    color: t.text,
    textAlign: "left",
    textDecoration: "none",
    fontFamily: FIGTREE,
    cursor: to || onSelect ? "pointer" : "default",
    ...ring(state.focusVisible),
  };
  const body = (
    <>
      {lead ? <Lead lead={lead} /> : null}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        {line ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</span> : null}
      </span>
      {trail ? <Trail trail={trail} /> : null}
    </>
  );
  if (to) {
    return (
      <PageLink to={to} data-ui="phone-row" {...rest} {...handlers} style={style}>
        {body}
      </PageLink>
    );
  }
  if (onSelect) {
    return (
      <button type="button" data-ui="phone-row" onClick={onSelect} {...rest} {...handlers} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div data-ui="phone-row" {...rest} style={style}>
      {body}
    </div>
  );
}

export default PhoneRow;
