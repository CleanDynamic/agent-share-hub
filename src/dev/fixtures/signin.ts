/* UI-P36 — Sign in's sample data, as `SignInView` and its bodies take it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). The board
   draws the Sign in card with empty fields (the reference shows the fields'
   placeholders), "Keep me signed in" ticked and the primary at full strength, so
   `canSubmit` is true here: the live page enables it once both fields have
   something in them. The orbs' numbers are `home.reproduced_today` and
   `gallery.in_gallery`. Join, reset and verify have no board; they are drawn
   with the same sample so they can be looked at (`?mode=signup`, `reset`,
   `confirm`, `verify`). Nothing here reaches a production bundle. */

import type { LoginFormProps } from "@/pages/site/signin/LoginForm";
import type { ResetConfirmFormProps, ResetRequestFormProps } from "@/pages/site/signin/ResetForms";
import type { SignupFormProps } from "@/pages/site/signin/SignupForm";

import { fixtures } from "../designFixtures";

const noop = () => undefined;

export type SigninMode = "login" | "signup" | "reset" | "confirm" | "verify";

export const SIGNIN_MODES: readonly SigninMode[] = ["login", "signup", "reset", "confirm", "verify"];

const providers = { onProvider: noop, loadingProvider: null } as const;

export function signinFixture() {
  const login: LoginFormProps = {
    emailOrUsername: "",
    password: "",
    rememberMe: true,
    onEmailOrUsernameChange: noop,
    onPasswordChange: noop,
    onRememberMeChange: noop,
    canSubmit: true,
    isSubmitting: false,
    onSubmit: noop,
    ...providers,
  };

  const signup: SignupFormProps = {
    displayName: "",
    username: "",
    email: "",
    password: "",
    agreedToTerms: false,
    onDisplayNameChange: noop,
    onUsernameChange: noop,
    onEmailChange: noop,
    onPasswordChange: noop,
    onAgreedToTermsChange: noop,
    usernameValidation: { state: "idle" },
    emailValidation: { state: "idle" },
    passwordStrength: "weak",
    canSubmit: true,
    isSubmitting: false,
    onSubmit: noop,
    ...providers,
  };

  const reset: ResetRequestFormProps = {
    email: "",
    onEmailChange: noop,
    canSubmit: true,
    isSubmitting: false,
    onSubmit: noop,
  };

  const confirm: ResetConfirmFormProps = {
    password: "",
    confirmPassword: "",
    passwordStrength: "weak",
    onPasswordChange: noop,
    onConfirmPasswordChange: noop,
    canSubmit: true,
    isSubmitting: false,
    onSubmit: noop,
  };

  return {
    reproducedToday: fixtures.home.reproduced_today,
    inGallery: fixtures.gallery.in_gallery,
    login,
    signup,
    reset,
    confirm,
  };
}
