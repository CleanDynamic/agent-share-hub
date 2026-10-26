// SV-04 P2: a router link that changes page through `go()`: the target is current at once, the page starts on intent
// (IntentLink: hover for 60 ms, focus, touch, press), and the change waits in the frame's one transition.
//
// A click with a modifier, a middle click, a `target` or `reloadDocument` is the browser's, as with any link. Outside
// PageChangeProvider (a view drawn on its own) it is an IntentLink.

import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import type { Link } from "react-router-dom";

import { useGo } from "./go";
import { IntentLink } from "./IntentLink";

export type PageLinkProps = ComponentProps<typeof Link>;

export const PageLink = forwardRef<HTMLAnchorElement, PageLinkProps>(function PageLink(props, ref) {
  const { onClick, to, replace, state, target, reloadDocument, preventScrollReset, relative, viewTransition, ...rest } = props;
  const go = useGo();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!go || event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    if ((target && target !== "_self") || reloadDocument) return;
    event.preventDefault();
    go(to, { replace, state, preventScrollReset, relative });
  };
  return (
    <IntentLink
      ref={ref}
      to={to}
      replace={replace}
      state={state}
      target={target}
      reloadDocument={reloadDocument}
      preventScrollReset={preventScrollReset}
      relative={relative}
      viewTransition={viewTransition}
      {...rest}
      onClick={handle}
    />
  );
});

export default PageLink;
