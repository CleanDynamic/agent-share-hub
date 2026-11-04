/* UX-05: the two controls the posts pages share, drawn as Home draws them: a control (`--control`, 1px `--control-border`,
   radius 6, 32 high, 12.5/400, 44 on a phone) and the view's one primary (`--action` fill, `--on-action` text, 500). A link
   when it goes somewhere. */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { PRIMARY, controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The handlers a menu or popover trigger puts on its child (Radix opens on pointer down), kept: the control's own are added to them. */
const incomingOf = (rest: ButtonHTMLAttributes<HTMLButtonElement>) => ({
  onMouseEnter: rest.onMouseEnter as never,
  onMouseLeave: rest.onMouseLeave as never,
  onFocus: rest.onFocus as never,
  onBlur: rest.onBlur as never,
  onPointerDown: rest.onPointerDown as never,
  onPointerUp: rest.onPointerUp as never,
  onPointerCancel: rest.onPointerCancel as never,
});

const base: CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: r.control,
  fontFamily: FIGTREE,
  fontSize: 12.5,
  lineHeight: "normal",
  whiteSpace: "nowrap",
  textDecoration: "none",
  cursor: "pointer",
};

interface ControlProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children"> {
  to?: string;
  /** A link that saves the file it goes to. */
  download?: boolean;
  /** Fill the width and stand 44 high on a phone. */
  block?: boolean;
  children: ReactNode;
}

/** A control: a button, or a link when `to` is given. */
export const PostControl = forwardRef<HTMLButtonElement, ControlProps>(function PostControl({ to, download, block, children, type = "button", ...rest }, ref) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLElement>(incomingOf(rest), { disabled: rest.disabled });
  const style: CSSProperties = { ...base, height: phone ? TOUCH_MIN : 32, padding: "0 12px", fontWeight: 400, color: t.text, width: block && phone ? "100%" : undefined, ...controlPaint(state), ...ring(state.focusVisible), ...(rest.disabled ? { opacity: 0.5, cursor: "default" } : null) };
  if (to) {
    return (
      <Link to={to} download={download} {...handlers} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} {...rest} {...handlers} style={style}>
      {children}
    </button>
  );
});

/** The view's one primary. */
export const PostPrimary = forwardRef<HTMLButtonElement, ControlProps>(function PostPrimary({ to, download, block, children, type = "button", ...rest }, ref) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLElement>(incomingOf(rest), { disabled: rest.disabled });
  const style: CSSProperties = { ...base, ...PRIMARY, height: phone ? TOUCH_MIN : 32, padding: "0 12px", fontWeight: 500, width: block && phone ? "100%" : undefined, ...ring(state.focusVisible) };
  if (to) {
    return (
      <Link to={to} download={download} data-visual-slot="btn-primary" {...handlers} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} data-visual-slot="btn-primary" {...rest} {...handlers} style={style}>
      {children}
    </button>
  );
});
