// The round post button (prompt 17): X's floating button. 56 round, Mint with the On-mint icon at 24, right 16, its bottom the
// dock's height plus the safe-area inset plus 16. It hides while the keyboard is open. The one Mint element of its region.

import type { Ref } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { PHONE_DOCK, PHONE_FAB, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { useKeyboardOpen } from "./useKeyboardInset";

export interface RoundPostButtonProps {
  /** The accessible name: "Post", "New post". */
  label: string;
  icon?: MobileIconName;
  onClick?: () => void;
  /** A link instead of a button. */
  to?: string;
  /** Where its foot stands, when not over the dock (the editor's, above its sticky footer). */
  bottom?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  /** 29f: the editor's round Add: 44 round, Raised fill, the icon in Text, 16 from the right. It is not Mint: Publish is that screen's. */
  quiet?: boolean;
  /** A menu or a sheet it opens. */
  "aria-haspopup"?: "dialog" | "menu";
  "aria-expanded"?: boolean;
}

export function RoundPostButton({ label, icon = "compose", onClick, to, bottom, buttonRef, quiet = false, ...aria }: RoundPostButtonProps) {
  const keyboard = useKeyboardOpen();
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  if (keyboard) return null;
  const style = {
    position: "fixed" as const,
    right: PHONE_MARGIN,
    bottom: bottom ?? `calc(${PHONE_DOCK}px + env(safe-area-inset-bottom) + ${PHONE_MARGIN}px)`,
    zIndex: 25,
    boxSizing: "border-box" as const,
    width: quiet ? TOUCH_MIN : PHONE_FAB,
    height: quiet ? TOUCH_MIN : PHONE_FAB,
    borderRadius: r.full,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: 0,
    background: quiet ? t.control : t.brandAccent,
    color: quiet ? t.text : t.onBrandAccent,
    boxShadow: quiet ? "none" : t.shadowFloat,
    textDecoration: "none",
    cursor: "pointer",
    ...ring(state.focusVisible),
  };
  return to ? (
    <PageLink to={to} aria-label={label} data-testid="round-post-button" {...handlers} style={style}>
      <MobileIcon name={icon} size={quiet ? 22 : 24} />
    </PageLink>
  ) : (
    <button ref={buttonRef} type="button" aria-label={label} {...aria} data-testid="round-post-button" onClick={onClick} {...handlers} style={style}>
      <MobileIcon name={icon} size={quiet ? 22 : 24} />
    </button>
  );
}

export default RoundPostButton;
