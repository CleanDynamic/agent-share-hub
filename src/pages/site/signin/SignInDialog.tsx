/* The sign-in dialog with its views: the chunk the host loads when the address asks for it (`?signin=<view>`).

   Row 1 is the Sign in · Join free switch on those two views and "Back to sign in" on every other; every change of view
   is a push, and closing (Escape, Close, the scrim) steps back out of the dialog, so the page behind is the page the
   person was on, untouched. */

import { useState } from "react";

import { AccountSwitch, BackToSignIn, SignInDialogFrame } from "./SignInDialogFrame";
import { LoginPanel } from "./LoginPanel";
import { ResetPanel } from "./ResetPanel";
import { SignupPanel } from "./SignupPanel";
import { VerifyPanel } from "./VerifyPanel";
import type { SignInView } from "./signinUrl";
import { useSignInNavigation } from "./useSignInNavigation";

export function SignInDialog({ view, closing = false }: { view: SignInView; closing?: boolean }) {
  const views = useSignInNavigation();
  /* G11: Escape, Close and the scrim start the fade at once; the address follows (a step back in the history, which
     takes a frame or more), and the host then keeps the dialog for the scrim's fade-out. */
  const [leaving, setLeaving] = useState(false);
  const rowStart =
    view === "login" || view === "signup" ? (
      <AccountSwitch value={view} onChange={(next) => (next === view ? undefined : views.show(next))} />
    ) : (
      <BackToSignIn to={views.hrefFor("login")} state={views.linkState} />
    );
  return (
    <SignInDialogFrame
      open={!closing && !leaving}
      onOpenChange={(open) => {
        if (open || closing || leaving) return;
        setLeaving(true);
        views.close();
      }}
      view={view}
      rowStart={rowStart}
    >
      {view === "signup" ? <SignupPanel /> : view === "reset" ? <ResetPanel /> : view === "verify" ? <VerifyPanel /> : <LoginPanel />}
    </SignInDialogFrame>
  );
}

export default SignInDialog;
