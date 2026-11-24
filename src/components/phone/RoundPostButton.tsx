// The round post button (prompt 17): X's floating button. 56 round, Mint with the On-mint icon at 24, right 16, its bottom the
// dock's height plus the safe-area inset plus 16. It hides while the keyboard is open. The one Mint element of its region.

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { PHONE_DOCK, PHONE_FAB, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
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
}

export function RoundPostButton({ label, icon = "compose", onClick, to }: RoundPostButtonProps) {
  const keyboard = useKeyboardOpen();
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  if (keyboard) return null;
  const style = {
    position: "fixed" as const,
    right: PHONE_MARGIN,
    bottom: `calc(${PHONE_DOCK}px + env(safe-area-inset-bottom) + ${PHONE_MARGIN}px)`,
    zIndex: 25,
    boxSizing: "border-box" as const,
    width: PHONE_FAB,
    height: PHONE_FAB,
    borderRadius: r.full,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: 0,
    background: t.brandAccent,
    color: t.onBrandAccent,
    boxShadow: t.shadowFloat,
    textDecoration: "none",
    cursor: "pointer",
    ...ring(state.focusVisible),
  };
  return to ? (
    <PageLink to={to} aria-label={label} data-testid="round-post-button" {...handlers} style={style}>
      <MobileIcon name={icon} size={24} />
    </PageLink>
  ) : (
    <button type="button" aria-label={label} data-testid="round-post-button" onClick={onClick} {...handlers} style={style}>
      <MobileIcon name={icon} size={24} />
    </button>
  );
}

export default RoundPostButton;
