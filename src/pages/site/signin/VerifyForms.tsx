/* The verify-email states as views of the sign-in dialog (Reference A, other views).

   Pending ("Check your inbox", with the resend action and its sub-states), checking, verified ("You're in") and failed
   ("This link doesn't work"), with every existing word and action of the cards in `components/auth`. Each state's own
   title is its heading. On a phone the existing cards are drawn as they are today. Back to sign in is row 1's.

   PURE and fully controlled: the container owns the state and the handlers. */

import { AuthEmailErrorCard } from "@/components/auth/AuthEmailErrorCard";
import { AuthEmailSuccessCard } from "@/components/auth/AuthEmailSuccessCard";
import { AuthEmailVerificationCard, type ResendState } from "@/components/auth/AuthEmailVerificationCard";
import { Button } from "@/components/brand/Button";
import { useRoom } from "@/components/brand/useRoom";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Gap, PrimaryAction, PushDown, ViewHeading } from "./AuthParts";
import { DIALOG, useAuthSizes } from "./authSizes";
import { SIGNIN_COLOURS } from "./signinColours";

const LINE = { margin: 0, fontFamily: FIGTREE, fontSize: 12, lineHeight: `${DIALOG.line}px`, color: t.text2 } as const;

export interface VerifyPendingProps {
  email: string;
  resendState: ResendState;
  cooldownSeconds?: number;
  onResend: () => void;
  onChangeEmail: () => void;
}

/** "Check your inbox": the address, and the resend action as a secondary button, 32 high, with its three other states in the same 32 row. */
export function VerifyPending({ email, resendState, cooldownSeconds = 0, onResend, onChangeEmail }: VerifyPendingProps) {
  const { phone } = useAuthSizes();
  const room = useRoom();
  if (phone) {
    return <AuthEmailVerificationCard email={email} resendState={resendState} cooldownSeconds={cooldownSeconds} onResend={onResend} onChangeEmail={onChangeEmail} />;
  }
  const row = { height: DIALOG.control, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;
  return (
    <>
      <ViewHeading title="Check your inbox">
        We sent a verification link to <span style={{ color: t.text }}>{email}</span>. Open it and your account is active — you can close
        this page.
      </ViewHeading>
      <Gap size={16} />
      <p style={LINE}>Didn&apos;t get the email?</p>
      <Gap size={8} />
      {resendState === "sent" ? (
        <div style={row}>
          <p style={{ ...LINE, fontWeight: 500, color: t.evidence }}>Sent again — it should arrive in a minute.</p>
        </div>
      ) : resendState === "cooldown" ? (
        <div style={row}>
          <p style={{ ...LINE, fontWeight: 500 }}>Resend available in {cooldownSeconds}s</p>
        </div>
      ) : (
        <Button variant="secondary" size={32} fullWidth disabled={resendState === "sending"} onClick={onResend}>
          {resendState === "sending" ? "Sending…" : "Resend verification"}
        </Button>
      )}
      <Gap size={16} />
      <p style={LINE}>
        Wrong email?{" "}
        <button
          type="button"
          onClick={onChangeEmail}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: FIGTREE,
            fontSize: 12,
            color: SIGNIN_COLOURS[room].link,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 4,
            textDecorationThickness: 1,
          }}
        >
          Sign up again
        </button>
      </p>
    </>
  );
}

/** "You're in", and Continue as the primary on the bottom line. */
export function VerifySuccess({ onContinue }: { onContinue: () => void }) {
  const { phone } = useAuthSizes();
  if (phone) return <AuthEmailSuccessCard onContinue={onContinue} />;
  return (
    <>
      <ViewHeading title="You're in">
        Your email is confirmed and your account is active. Continue and {SITE_NAME} picks up where you left off.
      </ViewHeading>
      <PushDown />
      <PrimaryAction type="button" onClick={onContinue}>
        Continue to {SITE_NAME}
      </PrimaryAction>
    </>
  );
}

/** "This link doesn't work", and Send a new link as the primary. On a phone the card keeps its own Back to sign in. */
export function VerifyFailed({ onResend, onBackToSignIn }: { onResend: () => void; onBackToSignIn: () => void }) {
  const { phone } = useAuthSizes();
  if (phone) return <AuthEmailErrorCard onResend={onResend} onBackToSignIn={onBackToSignIn} />;
  return (
    <>
      <ViewHeading title={"This link doesn't work"}>
        It may have expired or been used already. Send a new link and we&apos;ll email another one straight away — your account is
        still there.
      </ViewHeading>
      <PushDown />
      <PrimaryAction type="button" onClick={onResend}>
        Send a new link
      </PrimaryAction>
    </>
  );
}
