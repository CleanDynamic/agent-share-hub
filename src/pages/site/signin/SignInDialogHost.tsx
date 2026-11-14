/* The sign-in dialog's host (D1): mounted once, beside the routes in App.tsx, so the dialog can open over any page.

   It reads `?signin=<view>` and nothing else, and loads the dialog's chunk only when the address asks for it: with no
   such parameter, and nothing closing, it renders nothing and costs the first download nothing but this file.

   CLOSING. When the parameter goes, the dialog stays for the scrim's 900ms fade-out (G11), on the view it last showed,
   and the halftone layer winds down until it says it is done (G19); then each goes. If the address asks for the dialog
   again meanwhile, it is simply open again.

   THE HALFTONE LAYER (G17) is drawn only around a dialog that has space around it: not on a phone, where the dialog is
   the whole screen. Under reduced motion it has no wind-down and goes as the dialog closes. */

import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { prefersReducedMotion } from "@/lib/theme/motion";

import { SCRIM_OUT_MS } from "./signinMotion";
import { viewOf, type SignInView } from "./signinUrl";

const SignInDialog = lazy(() => import("./SignInDialog"));
const HalftoneLayer = lazy(() => import("./HalftoneLayer"));

export function SignInDialogHost() {
  const { search } = useLocation();
  const view = viewOf(search);
  const phone = useIsPhone();
  /** The view last shown, kept while the dialog closes. */
  const [last, setLast] = useState<SignInView | null>(view);
  const [dialogDone, setDialogDone] = useState(false);
  const [layerDone, setLayerDone] = useState(false);
  const closing = !view && last !== null;

  useEffect(() => {
    if (view) {
      setLast(view);
      setDialogDone(false);
      setLayerDone(false);
    }
  }, [view]);

  useEffect(() => {
    if (!closing) return;
    if (prefersReducedMotion()) setLayerDone(true);
    const timer = window.setTimeout(() => setDialogDone(true), SCRIM_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  const layer = !phone;
  useEffect(() => {
    if (closing && dialogDone && (layerDone || !layer)) {
      setLast(null);
      setDialogDone(false);
      setLayerDone(false);
    }
  }, [closing, dialogDone, layerDone, layer]);

  const shown = view ?? last;
  if (!shown) return null;
  return (
    <>
      {/* Each its own boundary: the layer's chunk arriving late must not take the dialog off the screen. */}
      {layer && !layerDone ? (
        <Suspense fallback={null}>
          <HalftoneLayer closing={closing} onDone={() => setLayerDone(true)} />
        </Suspense>
      ) : null}
      {dialogDone ? null : (
        <Suspense fallback={null}>
          <SignInDialog view={shown} closing={closing} />
        </Suspense>
      )}
    </>
  );
}

export default SignInDialogHost;
