/* /dev/kit/pages/signin?theme=noon|dusk&viewport=desktop|mobile — the sign-in dialog (Reference A), open, with the
   sample data, over an empty bare frame.

   `?mode=signup|reset|confirm|verify` draws the other views in the same dialog. `?error=1` fills the Sign in view's
   error line ("Wrong email or password"), so the two can be compared (G9). Nothing here reaches a production bundle. */

import { useSearchParams } from "react-router-dom";

import { AuthEmailVerificationCard } from "@/components/auth/AuthEmailVerificationCard";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import { signinFixture, SIGNIN_MODES, type SigninMode } from "@/dev/fixtures/signin";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { LoginForm } from "@/pages/site/signin/LoginForm";
import { ResetConfirmForm, ResetRequestForm } from "@/pages/site/signin/ResetForms";
import { AccountSwitch, BackToSignIn, SignInDialogFrame } from "@/pages/site/signin/SignInDialogFrame";
import { SignupForm } from "@/pages/site/signin/SignupForm";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

export default function SignInDemo({ viewport }: DesignPageProps) {
  useDesignTheme();
  const [params] = useSearchParams();
  const asked = params.get("mode") as SigninMode | null;
  const mode: SigninMode = asked && SIGNIN_MODES.includes(asked) ? asked : "login";
  const sample = signinFixture();
  const here = (next: SigninMode) => {
    const query = new URLSearchParams(params);
    query.set("mode", next);
    return `?${query.toString()}`;
  };
  const rowStart =
    mode === "login" || mode === "signup" ? (
      <AccountSwitch value={mode} loginTo={here("login")} signupTo={here("signup")} />
    ) : (
      <BackToSignIn to={here("login")} />
    );

  return (
    <SiteFrameView variant="bare" viewport={viewport}>
      <div style={{ minHeight: "100dvh" }} />
      <SignInDialogFrame open onOpenChange={noop} view={mode} rowStart={rowStart}>
        {mode === "signup" ? (
          <SignupForm {...sample.signup} />
        ) : mode === "reset" ? (
          <ResetRequestForm {...sample.reset} />
        ) : mode === "confirm" ? (
          <ResetConfirmForm {...sample.confirm} />
        ) : mode === "verify" ? (
          <AuthEmailVerificationCard email="you@studio.com" resendState="idle" onResend={noop} onChangeEmail={noop} />
        ) : (
          <LoginForm {...sample.login} forgotTo={here("reset")} error={params.get("error") ? "Wrong email or password" : undefined} />
        )}
      </SignInDialogFrame>
    </SiteFrameView>
  );
}
