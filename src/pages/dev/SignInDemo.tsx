/* UI-P36 — /dev/kit/pages/signin?theme=noon|dusk&viewport=desktop|mobile.

   `SignInView` in `board` fit with the Sign in card and the sample data, inside
   the bare frame, which this page draws itself (`KitPages` lists it as
   unframed). The compare harness photographs this against
   `design/reference/…/signin.html`.

   `?mode=signup|reset|confirm|verify` draws the other three pages' cards in the
   same view, for looking at; they have no board, so nothing compares them, and
   they take the card's own height rather than the board's.

   THE THEME CONTROL IS TOLD THE ROOM. The compare pages set `<html data-theme>`
   without touching the stored choice, so the control would otherwise say Noon
   on the Dusk board. */

import { useSearchParams } from "react-router-dom";

import { AuthEmailVerificationCard } from "@/components/auth/AuthEmailVerificationCard";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import { signinFixture, SIGNIN_MODES, type SigninMode } from "@/dev/fixtures/signin";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { LoginForm } from "@/pages/site/signin/LoginForm";
import { ResetConfirmForm, ResetRequestForm } from "@/pages/site/signin/ResetForms";
import { SignInView } from "@/pages/site/signin/SignInView";
import { SignupForm } from "@/pages/site/signin/SignupForm";
import type { AuthMode } from "@/pages/site/signin/authModel";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

const PAGE: Record<SigninMode, AuthMode> = { login: "login", signup: "signup", reset: "reset", confirm: "reset", verify: "verify" };

export default function SignInDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const theme = useDesignTheme();
  const [params] = useSearchParams();
  const asked = params.get("mode") as SigninMode | null;
  const mode: SigninMode = asked && SIGNIN_MODES.includes(asked) ? asked : "login";
  const sample = signinFixture();

  return (
    <SiteFrameView variant="bare" viewport={viewport}>
      <SignInView
        fit={mode === "login" ? fit : "content"}
        mode={PAGE[mode]}
        onBack={noop}
        /* UI-P37: the counts waiting (loading), none yet (empty), or unreadable and left out (error). */
        reproducedToday={state === "loading" || state === "error" ? null : state === "empty" ? 0 : sample.reproducedToday}
        inGallery={state === "loading" || state === "error" ? null : state === "empty" ? 0 : sample.inGallery}
        countsFailed={state === "error"}
        themeValue={theme}
      >
        {mode === "signup" ? (
          <SignupForm {...sample.signup} />
        ) : mode === "reset" ? (
          <ResetRequestForm {...sample.reset} />
        ) : mode === "confirm" ? (
          <ResetConfirmForm {...sample.confirm} />
        ) : mode === "verify" ? (
          <AuthEmailVerificationCard email="you@studio.com" resendState="idle" onResend={noop} onChangeEmail={noop} />
        ) : (
          <LoginForm {...sample.login} />
        )}
      </SignInView>
    </SiteFrameView>
  );
}
