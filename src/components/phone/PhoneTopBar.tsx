// The phone's top bar (prompt 17): a `48px 1fr 48px` grid, 52 tall, on Page, no line and no fill change on scroll, under the
// top safe-area inset. Left is the account avatar, Back or Close; the centre is the logo or the h1 title; right is one icon
// button. Every target is a 44 round hit area.

import { SITE_NAME } from "@/lib/site";
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
  /** An icon button. Omit it and give `text` for a ghost text button. */
  icon?: MobileIconName;
  /** A ghost text button, 13/600 ("Mark all read", "Sign in", "Skip"). The words are its accessible name. */
  text?: string;
  disabled?: boolean;
  /** The accessible name. */
  label: string;
  onClick?: () => void;
  /** A link instead of a button. */
  to?: string;
}

export interface PhoneTopBarProps {
  left: "account" | "back" | "close" | null;
  /** A ghost text button in the left slot instead (signed out: "Sign in"). Wins over `left`. */
  leftAction?: PhoneTopBarAction | null;
  /** `"logo"`, the page's title, or `""` for nothing. */
  centre: "logo" | (string & {});
  /** What the title is drawn as. The page's own h1 stays the page's; the bar's words are a `p` there. */
  titleAs?: "h1" | "p";
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
  /** Onboarding (prompt 27 Part C): the title is "1 of 3" in mono 13 Text 3, and three 4px segments sit at the very top under the inset. */
  progress?: { step: number; of: number };
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

function IconButton({ icon, text, disabled, label, onClick, to }: PhoneTopBarAction) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  if (text) {
    const ghost: CSSProperties = {
      ...HIT,
      width: "auto",
      minWidth: TOUCH_MIN,
      padding: "0 8px",
      borderRadius: r.full,
      fontFamily: FIGTREE,
      fontSize: 13,
      fontWeight: 600,
      lineHeight: "16px",
      whiteSpace: "nowrap",
      color: disabled ? t.label : t.text,
      cursor: disabled ? "default" : "pointer",
      textDecoration: "none",
      ...ring(state.focusVisible),
    };
    return (
      <button type="button" aria-label={label === text ? undefined : label} disabled={disabled} onClick={onClick} {...handlers} style={ghost}>
        {text}
      </button>
    );
  }
  const style: CSSProperties = { ...HIT, textDecoration: "none", ...ring(state.focusVisible) };
  if (to) {
    return (
      <FrameLink to={to} aria-label={label} style={style}>
        <MobileIcon name={icon ?? "more"} size={24} />
      </FrameLink>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} {...handlers} style={style}>
      <MobileIcon name={icon ?? "more"} size={24} />
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

export function PhoneTopBar({ left, leftAction = null, centre, titleAs = "h1", right = null, onLeft, leftLabel, viewer = null, unread = false, theme = "dusk", progress }: PhoneTopBarProps) {
  /* Words in a side slot are wider than 48: the sides then take equal shares and the centre its own width. */
  const wide = Boolean(leftAction?.text || right?.text);
  const Title = titleAs;
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
      {progress ? (
        <div role="progressbar" aria-label="Onboarding" aria-valuemin={1} aria-valuemax={progress.of} aria-valuenow={progress.step} data-testid="phone-progress" style={{ display: "flex", gap: 6, padding: "0 16px" }}>
          {Array.from({ length: progress.of }, (_, index) => (
            <span key={index} data-done={index < progress.step ? "" : undefined} style={{ flex: 1, height: 4, borderRadius: 2, background: index < progress.step ? t.brandAccent : t.control }} />
          ))}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(48px, 1fr) minmax(0, auto) minmax(48px, 1fr)" : "48px 1fr 48px", alignItems: "center", height: PHONE_TOPBAR, padding: "0 8px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: wide ? "flex-start" : "center" }}>
          {leftAction ? (
            <IconButton {...leftAction} />
          ) : left === "account" ? (
            <AccountButton viewer={viewer} unread={unread} onClick={onLeft} />
          ) : left === "back" ? (
            <IconButton icon="back" label={leftLabel ?? "Back"} onClick={onLeft} />
          ) : left === "close" ? (
            <IconButton icon="close" label={leftLabel ?? "Close"} onClick={onLeft} />
          ) : null}
        </div>
        {centre === "" ? (
          <span />
        ) : centre === "logo" ? (
          <FrameLink to={SITE_NAV.home} aria-label={`${SITE_NAME} home`} data-hit="" style={{ display: "flex", justifyContent: "center", alignItems: "center", justifySelf: "center" }}>
            <BeaverLogo theme={theme} size={PHONE_LOGO_WIDTH_BAR} />
          </FrameLink>
        ) : (
          <Title
            style={{
              margin: 0,
              minWidth: 0,
              textAlign: "center",
              fontFamily: progress ? DM_MONO : FIGTREE,
              fontSize: progress ? 13 : 17,
              fontWeight: progress ? 400 : 600,
              lineHeight: progress ? "16px" : "22px",
              color: progress ? t.label : t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {centre}
          </Title>
        )}
        <div style={{ display: "flex", justifyContent: wide ? "flex-end" : "center" }}>{right ? <IconButton {...right} /> : null}</div>
      </div>
    </header>
  );
}

export default PhoneTopBar;
