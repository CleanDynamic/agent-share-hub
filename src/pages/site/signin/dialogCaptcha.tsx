/* G6: the sign-in dialog's one Turnstile widget, shared by its views.

   The dialog holds the widget (useTurnstile), so it lives as long as the dialog does and every view uses the same one:
   join, sign in, the reset request and resend verification each take its token and reset it after every submission,
   successful or not. The widget is invisible and sits outside the layout (G9). Outside a dialog there is no check. */

import { createContext, useContext, type ReactNode } from "react";

import { AUTH_MESSAGES } from "@/lib/auth/authMessages";
import { useTurnstile, type Captcha } from "@/lib/auth/turnstile";

/** What the error line says when the check fails, before or after the request. */
export const VERIFY_FAILED = AUTH_MESSAGES.captcha;

type DialogCaptcha = Pick<Captcha, "token" | "reset">;

const NO_CHECK: DialogCaptcha = { token: async () => ({ token: undefined, failed: false }), reset: () => {} };

const CaptchaContext = createContext<DialogCaptcha>(NO_CHECK);

export function DialogCaptchaProvider({ children }: { children: ReactNode }) {
  const captcha = useTurnstile();
  return <CaptchaContext.Provider value={captcha}>{children}</CaptchaContext.Provider>;
}

export function useDialogCaptcha(): DialogCaptcha {
  return useContext(CaptchaContext);
}
