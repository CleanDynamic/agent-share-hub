// The phone's top bar (prompt 17): a `48px 1fr 48px` grid, 52 tall, on Page, no line and no fill change on scroll, under the
// top safe-area inset. Left is the account avatar, Back or Close; the centre is the logo or the h1 title; right is one icon
// button. Every target is a 44 round hit area.

import type { CSSProperties } from "react";

import { initialsOf } from "@/components/brand/Avatar";
import { BeaverLogo } from "@/components/shell/BeaverLogo";
import { PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { FrameLink } from "@/components/shell/FrameLink";
import { SITE_NAV } from "@/components/shell/siteNav";
import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const PHONE_LOGO_WIDTH_BAR = 56;

export interface PhoneTopBarAction {
  icon: MobileIconName;
  /** The accessible name. */
  label: string;
  onClick?: () => void;
  /** A link instead of a button. */
  to?: string;
}

export interface PhoneTopBarProps {
  left: "account" | "back" | "close" | null;
  /** `"logo"` or the page's title, drawn as the h1. */
  centre: "logo" | (string & {});
  right?: PhoneTopBarAction | null;
  /** What the left control does. */
  onLeft?: () => void;
  /** Back's or Close's accessible name: "Back to Drafts", "Back", "Close". */
  leftLabel?: string;
  /** The person, for the avatar's initials and the account button's name. */
  viewer?: { name: string; avatarUrl?: string | null } | null;
  /** Something in Activity is unread: the Mint square on the avatar. */
  unread?: boolean;
  theme?: "dusk" | "noon";
}

const HIT: CSSProperties = {
  boxSizing: "border-box",
  width: TOUCH_MIN,
  height: TOUCH_MIN,
  borderRadius: r.full,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: 0,
  background: "transparent",
  color: t.text,
  cursor: "pointer",
};

function IconButton({ icon, label, onClick, to }: PhoneTopBarAction) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style: CSSProperties = { ...HIT, textDecoration: "none", ...ring(state.focusVisible) };
  if (to) {
    return (
      <FrameLink to={to} aria-label={label} style={style}>
        <MobileIcon name={icon} size={24} />
      </FrameLink>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} {...handlers} style={style}>
      <MobileIcon name={icon} size={24} />
    </button>
  );
}

function AccountButton({ viewer, unread, onClick }: { viewer: PhoneTopBarProps["viewer"]; unread: boolean; onClick?: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const name = viewer?.name.trim() ?? "";
  return (
    <button
      type="button"
      aria-label={unread ? `${name || "Account"}, account menu, unread activity` : name ? `${name}, account menu` : "Account menu"}
      onClick={onClick}
      {...handlers}
      style={{ ...HIT, position: "relative", ...ring(state.focusVisible) }}
    >
      <span
        aria-hidden="true"
        data-testid="phone-avatar"
        style={{
          width: 32,
          height: 32,
          borderRadius: r.full,
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.control,
          color: t.text2,
          fontFamily: DM_MONO,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {viewer?.avatarUrl ? (
          <img src={viewer.avatarUrl} alt="" width={32} height={32} style={{ width: 32, height: 32, objectFit: "cover" }} />
        ) : viewer ? (
          initialsOf(name)
        ) : (
          <MobileIcon name="account" size={16} />
        )}
      </span>
      {unread ? (
        <span
          aria-hidden="true"
          data-testid="phone-unread"
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 9,
            height: 9,
            borderRadius: 3,
            background: t.brandAccent,
            boxShadow: `0 0 0 2px ${t.bg}`,
          }}
        />
      ) : null}
    </button>
  );
}

export function PhoneTopBar({ left, centre, right = null, onLeft, leftLabel, viewer = null, unread = false, theme = "dusk" }: PhoneTopBarProps) {
  return (
    <header
      data-testid="phone-top-bar"
      data-ui="phone-top-bar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        boxSizing: "border-box",
        paddingTop: "env(safe-area-inset-top)",
        background: t.bg,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 48px", alignItems: "center", height: PHONE_TOPBAR, padding: "0 8px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {left === "account" ? (
            <AccountButton viewer={viewer} unread={unread} onClick={onLeft} />
          ) : left === "back" ? (
            <IconButton icon="back" label={leftLabel ?? "Back"} onClick={onLeft} />
          ) : left === "close" ? (
            <IconButton icon="close" label={leftLabel ?? "Close"} onClick={onLeft} />
          ) : null}
        </div>
        {centre === "logo" ? (
          <FrameLink to={SITE_NAV.home} aria-label="OpenBuilds.ai home" style={{ display: "flex", justifyContent: "center", alignItems: "center", justifySelf: "center" }}>
            <BeaverLogo theme={theme} size={PHONE_LOGO_WIDTH_BAR} />
          </FrameLink>
        ) : (
          <h1
            style={{
              margin: 0,
              minWidth: 0,
              textAlign: "center",
              fontFamily: FIGTREE,
              fontSize: 17,
              fontWeight: 600,
              lineHeight: "22px",
              color: t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {centre}
          </h1>
        )}
        <div style={{ display: "flex", justifyContent: "center" }}>{right ? <IconButton {...right} /> : null}</div>
      </div>
    </header>
  );
}

export default PhoneTopBar;
