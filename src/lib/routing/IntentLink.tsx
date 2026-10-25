// SV-03 P6: a router link that starts its page on intent (hover for 60 ms, focus, touch, press). Props a caller passes for
// the same events still run: this one is added to them, not put in their place.

import { forwardRef, type ComponentProps, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";

import { useIntent } from "./useIntent";

type Handler = ((event: SyntheticEvent<HTMLAnchorElement>) => void) | undefined;
const both = (ours: () => void, theirs: Handler) => (event: SyntheticEvent<HTMLAnchorElement>) => {
  theirs?.(event);
  ours();
};

export const IntentLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function IntentLink(props, ref) {
  const { to, onPointerEnter, onPointerLeave, onFocus, onTouchStart, onPointerDown, ...rest } = props;
  const href = typeof to === "string" ? to : (to.pathname ?? undefined);
  const intent = useIntent(href);
  return (
    <Link
      ref={ref}
      to={to}
      {...rest}
      onPointerEnter={both(intent.onPointerEnter, onPointerEnter as Handler)}
      onPointerLeave={both(intent.onPointerLeave, onPointerLeave as Handler)}
      onFocus={both(intent.onFocus, onFocus as Handler)}
      onTouchStart={both(intent.onTouchStart, onTouchStart as Handler)}
      onPointerDown={both(intent.onPointerDown, onPointerDown as Handler)}
    />
  );
});
