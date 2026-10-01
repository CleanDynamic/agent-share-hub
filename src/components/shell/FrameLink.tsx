// A router link with the theme's keyboard focus ring (UI-P17).
//
// Inline styles cannot say `:focus-visible`, so the ring is resolved in
// JavaScript the way `Button` and `IconButton` do it (`useInteractive`). Every
// link the site frame's chrome draws goes through this, so keyboard focus looks
// the same on the header, the footer, the breadcrumb and the dock.

import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

export type FrameLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  /** Painted on top of the ring-aware style. */
  hoverStyle?: React.CSSProperties;
};

export function FrameLink({
  style,
  hoverStyle,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: FrameLinkProps) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>({
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  });
  return (
    <Link
      {...rest}
      {...handlers}
      style={{ textDecoration: "none", ...style, ...(state.hovered ? hoverStyle : null), ...ring(state.focusVisible) }}
    />
  );
}
