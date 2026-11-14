/* The sign-in dialog's host (D1): mounted once, beside the routes in App.tsx, so the dialog can open over any page.

   It reads `?signin=<view>` and nothing else, and loads the dialog's chunk only when the address asks for it: with no
   such parameter it renders nothing and costs the first download nothing but this file. */

import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

import { viewOf } from "./signinUrl";

const SignInDialog = lazy(() => import("./SignInDialog"));

export function SignInDialogHost() {
  const { search } = useLocation();
  const view = viewOf(search);
  if (!view) return null;
  return (
    <Suspense fallback={null}>
      <SignInDialog view={view} />
    </Suspense>
  );
}

export default SignInDialogHost;
