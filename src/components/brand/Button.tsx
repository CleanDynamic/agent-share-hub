// The button (UI-P07).
//
// THREE VARIANTS, ONE PER JOB. `primary` is the one action in a page body
// (`--action` fill, `--on-action` label), `secondary` is every other action on a
// glass fill with a `--line` hairline, `ghost` is the quiet one — `--text2` on
// nothing. Only one primary per page body: the header's New build is chrome and
// does not count, which is a rule for the page rather than something a button
// can enforce, so it is stated here and not checked.
//
// SIZE IS THE DRAWN NUMBER; THE BUTTON RENDERS ONE OF TWO HEIGHTS (the control-
// heights pass). Callers pass the height the reference drew and
// `refinedButtonHeight` maps it: drawn 28 or less renders 24 (0 8px, 12px), the
// small button, for a row or a card header only; drawn 30 to 42 renders 32
// (0 12px, 13px). Drawn 44 and over renders 36 (0 16px) on desktop, which only
// sign-in and the editor pass, and keeps its 44 or 48 on a phone. On a phone every
// button keeps a 44 high hit area (`touchArea`). `fontSize` is accepted and not
// read: the label is 13/500, 12 on a 24. The radius is `r.control`, the gap 8,
// and a labelled button draws no icon.
//
// This is the new button. The shadcn `ui/button.tsx` and every call site of it
// are untouched: they move when their page is rebuilt.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { PageLink } from "@/lib/routing/PageLink";
import { useInteractive } from "@/lib/theme/interactive";
import { ring, touchArea } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { controlPaint, PRIMARY, refinedButtonHeight } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = 28 | 30 | 32 | 34 | 36 | 38 | 42 | 44 | 46 | 48;
export type ButtonFontSize = 11 | 12 | 13 | 14 | 15;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  /** Height in px, as the reference drew it; rendered through the density table. */
  size?: ButtonSize;
  /** Label size in px, as the reference drew it; rendered through the density table. */
  fontSize?: ButtonFontSize;
  /** A lucide icon, drawn before the label at 15px and stroke 1.8. */
  icon?: LucideIcon;
  /** `display: flex; width: 100%` — the mobile 48px buttons. */
  fullWidth?: boolean;
  /** Draw the button as a link to this address, with identical styles: a router link for a path on the site, an anchor otherwise. */
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = 36,
  fontSize = 13,
  icon: Icon,
  fullWidth = false,
  href,
  type = "button",
  disabled,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: ButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>(
    { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
    { disabled },
  );
  const phone = useIsPhone();
  /* Radius 6, heights 24 and 32 (a phone's 44 and 48 stay), padding 0 8px at 24 and 0 12px at 32 (16 at 36 and over,
     which only sign-in and the editor reach), 12/13 at 500. Primary, secondary (the control recipe) and ghost are the
     board's. A labelled button draws no icon. */
  const height = refinedButtonHeight(size, phone);
  const small = height <= 24;
  const paint: CSSProperties =
    variant === "primary"
      ? { ...PRIMARY, ...(state.hovered ? { filter: "brightness(1.08)" } : null) }
      : variant === "secondary"
        ? controlPaint(state)
        : {
            background: "transparent",
            border: "1px solid transparent",
            color: state.hovered ? t.text : t.text2,
          };
  const look: CSSProperties = {
    boxSizing: "border-box",
    height,
    padding: small ? "0 8px" : height < 36 ? "0 12px" : "0 16px",
    borderRadius: r.control,
    color: variant === "secondary" ? t.text : undefined,
    ...paint,
    fontFamily: FIGTREE,
    fontSize: small ? 12 : 13,
    fontWeight: 500,
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : undefined,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textDecoration: "none",
    ...touchArea(phone),
    ...ring(state.focusVisible),
    ...style,
  };
  if (href !== undefined) {
    /* The same element in every respect but its tag: the button's attributes and handlers ride on the anchor. */
    const anchor = { "data-ui": "button", "data-variant": variant, ...(rest as object), ...(handlers as object), style: look };
    /* A download is never routed: the router would take the click. */
    return href.startsWith("/") && !("download" in rest) ? (
      <PageLink to={href} {...anchor}>
        {children}
      </PageLink>
    ) : (
      <a href={href} {...anchor}>
        {children}
      </a>
    );
  }
  return (
    <button data-ui="button" data-variant={variant} type={type} disabled={disabled} {...rest} {...handlers} style={look}>
      {children}
    </button>
  );
}

export default Button;
