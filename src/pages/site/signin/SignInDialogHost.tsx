/* The sign-in dialog's host (D1): mounted once, beside the routes in App.tsx, so the dialog can open over any page.

   It reads `?signin=<view>` and nothing else, and loads the dialog's chunk only when the address asks for it: with no
   such parameter, and nothing closing, it renders nothing and costs the first download nothing but this file.

   CLOSING. When the parameter goes, the dialog stays for the scrim's 900ms fade-out (G11), on the view it last showed,
   and then goes. If the address asks for it again meanwhile, it is simply open again. */

import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { SCRIM_OUT_MS } from "./signinMotion";
import { viewOf, type SignInView } from "./signinUrl";

const SignInDialog = lazy(() => import("./SignInDialog"));

export function SignInDialogHost() {
  const { search } = useLocation();
  const view = viewOf(search);
  /** The view last shown, kept while the dialog closes. */
  const [last, setLast] = useState<SignInView | null>(view);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (view) {
      setLast(view);
      setClosing(false);
    } else if (last) {
      setClosing(true);
    }
    // `last` is read only to know whether there is anything to close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => {
      setLast(null);
      setClosing(false);
    }, SCRIM_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const shown = view ?? last;
  if (!shown) return null;
  return (
    <Suspense fallback={null}>
      <SignInDialog view={shown} closing={!view} />
    </Suspense>
  );
}

export default SignInDialogHost;
