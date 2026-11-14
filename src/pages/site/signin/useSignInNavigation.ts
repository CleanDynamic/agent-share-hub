/* Moving between the dialog's views, and closing it, through the address (D1). A view change is a push one step deeper;
   a replace keeps the depth (a finished reset going back to sign in); closing steps back out of every push, or, for a
   dialog that arrived by address, replaces the address with the page's own. */

import { useLocation, useNavigate } from "react-router-dom";

import { deeper, depthOf, withoutDialog, withView, type SignInView } from "./signinUrl";

export function useSignInNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  return {
    /** The address of `view` on this page, for a link. */
    hrefFor: (view: SignInView) => `${location.pathname}${withView(location.search, view)}`,
    /** The history state a link to another view carries. */
    linkState: deeper(location.state),
    /** Push `view`, one step deeper. */
    show: (view: SignInView, extra?: Record<string, unknown>) =>
      navigate(`${location.pathname}${withView(location.search, view)}`, { state: { ...deeper(location.state), ...extra } }),
    /** Replace the current view with `view`, at the same depth; `search` replaces the query first (a spent token taken off). */
    replaceWith: (view: SignInView, extra?: Record<string, unknown>, search: string = location.search) =>
      navigate(`${location.pathname}${withView(search, view)}`, {
        replace: true,
        state: { ...(depthOf(location.state) ? { signinDepth: depthOf(location.state) } : null), ...extra },
      }),
    /** Close the dialog: back out of every push, or take the dialog's parameters off an address that opened it. */
    close: () => {
      const depth = depthOf(location.state);
      if (depth > 0) navigate(-depth);
      else navigate(`${location.pathname}${withoutDialog(location.search)}${location.hash}`, { replace: true });
    },
  };
}
