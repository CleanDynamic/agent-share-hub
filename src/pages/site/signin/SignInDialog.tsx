/* The sign-in dialog with its views: the chunk the host loads when the address asks for it (`?signin=<view>`).

   Row 1 is the Sign in · Join free switch on those two views and "Back to sign in" on every other; every change of view
   is a push, and closing (Escape, Close, the scrim) steps back out of the dialog, so the page behind is the page the
   person was on, untouched. */

import { AccountSwitch, BackToSignIn, SignInDialogFrame } from "./SignInDialogFrame";
import { LoginPanel } from "./LoginPanel";
import { ResetPanel } from "./ResetPanel";
import { SignupPanel } from "./SignupPanel";
import { VerifyPanel } from "./VerifyPanel";
import type { SignInView } from "./signinUrl";
import { useSignInNavigation } from "./useSignInNavigation";

export function SignInDialog({ view }: { view: SignInView }) {
  const views = useSignInNavigation();
  const rowStart =
    view === "login" || view === "signup" ? (
      <AccountSwitch value={view} onChange={(next) => (next === view ? undefined : views.show(next))} />
    ) : (
      <BackToSignIn to={views.hrefFor("login")} state={views.linkState} />
    );
  return (
    <SignInDialogFrame open onOpenChange={(open) => (open ? undefined : views.close())} view={view} rowStart={rowStart}>
      {view === "signup" ? <SignupPanel /> : view === "reset" ? <ResetPanel /> : view === "verify" ? <VerifyPanel /> : <LoginPanel />}
    </SignInDialogFrame>
  );
}

export default SignInDialog;
