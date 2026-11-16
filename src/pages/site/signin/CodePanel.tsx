/* Part A, G2: the "Enter your code" view of the sign-in dialog.

   Shown after a correct password to a member with a verified authenticator. One six-digit field (numeric keypad, the
   phone's one-time-code autofill) and Verify; the member is signed in only once the code verifies. Row 1 is "Back to
   sign in", as on every view but Sign in and Join, and the dialog keeps its rectangle (G1 of the dialog: 840 by 540).

   G7: five wrong codes in a row end the attempt. The half-signed-in session is signed out of this browser and the
   member is back on the password view, told why. Leaving the view any other way (Back to sign in, closing) signs it out
   too: LoginPanel and SignInDialog do that.

   D4: no way round the code here. A member who has lost their authenticator and their backup codes is told to contact
   support. */

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { abandonCodeStep, clearTries, MAX_CODE_TRIES, pendingCodeFactor, recordWrongTry } from "@/lib/auth/codeStep";
import { CODE_LENGTH, MFA_COPY, cleanCode, verifyCode } from "@/lib/auth/mfa";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";
import { returnPathFrom } from "@/lib/auth/safeReturnPath";
import { SettingsError } from "@/lib/settings/useAction";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AuthField, Gap, PrimaryAction, PushDown, ViewHeading } from "./AuthParts";
import { DIALOG } from "./authSizes";
import { useSignInNavigation } from "./useSignInNavigation";

export const CODE_COPY = {
  title: "Enter your code",
  body: `Open your authenticator app and enter the 6-digit code it shows for ${SITE_NAME}.`,
  label: "Code",
  verify: "Verify",
  verifying: "Checking",
  wrong: (left: number) => `That code didn't work. ${left === 1 ? "One more try" : `${left} more tries`} before you sign in again.`,
  ended: "Too many wrong codes. Sign in again.",
  support: "Lost your authenticator and your backup codes? Contact support and we'll help you back in.",
} as const;

const LINE = { margin: 0, fontFamily: FIGTREE, fontSize: 12, lineHeight: `${DIALOG.line}px`, color: t.text2 } as const;

export function CodePanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = returnPathFrom(searchParams);
  const { user } = useAuth();
  const views = useSignInNavigation();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Which authenticator to ask for. With no code owed (no session, or already aal2), this view has nothing to do.
  useEffect(() => {
    let live = true;
    void pendingCodeFactor().then((id) => {
      if (!live) return;
      if (id) setFactorId(id);
      else views.replaceWith("login");
    });
    return () => {
      live = false;
    };
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (!factorId || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await verifyCode(factorId, code);
    } catch (failure) {
      const message = failure instanceof SettingsError ? failure.message : MFA_COPY.wrongCode;
      setIsSubmitting(false);
      // A field that is not six digits never reached the server, and is not a try.
      if (message === MFA_COPY.codeShape) {
        setError(message);
        return;
      }
      const tries = recordWrongTry();
      if (tries >= MAX_CODE_TRIES) {
        await abandonCodeStep();
        views.replaceWith("login", { signinNotice: CODE_COPY.ended });
        return;
      }
      setCode("");
      setError(CODE_COPY.wrong(MAX_CODE_TRIES - tries));
      return;
    }
    clearTries();
    const destination = redirectParam || (user?.id ? await resolvePostAuthRoute(user.id) : "/");
    navigate(destination, { replace: true });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleVerify();
      }}
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      noValidate
    >
      <ViewHeading title={CODE_COPY.title}>{CODE_COPY.body}</ViewHeading>
      <Gap size={16} />
      <AuthField
        label={CODE_COPY.label}
        icon={KeyRound}
        value={code}
        onChange={(value) => {
          setCode(value);
          setError("");
        }}
        placeholder="123456"
        inputMode="numeric"
        maxLength={CODE_LENGTH + 1}
        autoComplete="one-time-code"
        required
        error={error}
        reserveMessage
      />
      <Gap size={8} />
      <p style={LINE}>{CODE_COPY.support}</p>
      <PushDown />
      <PrimaryAction loading={isSubmitting} loadingText={CODE_COPY.verifying} disabled={!factorId || cleanCode(code) === null}>
        {CODE_COPY.verify}
      </PrimaryAction>
    </form>
  );
}

export default CodePanel;
