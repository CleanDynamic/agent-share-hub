/* Part A, G1: Settings, Account, "Two-step sign-in". PURE: data and callbacks in.

   Lists the member's authenticators (name, date added) with `Remove` on each, and `Add an authenticator`. Adding asks
   first for the password (no authenticator yet) or a fresh code (one already), then shows a QR code and the same key as
   text, then takes one code to confirm. Removing asks for a fresh code from that authenticator. G5: once an
   authenticator is added, the member's backup codes are shown here, once. */

import { KeyRound, Lock, Smartphone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { CODE_LENGTH, MFA_COPY, addedLabel, type Authenticator, type Enrolment } from "@/lib/auth/mfa";
import { SettingsError } from "@/lib/settings/useAction";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { AuthField, FieldMessage } from "@/pages/site/signin/AuthParts";

import { Group, Note, SettingRow } from "./SettingParts";

export interface TwoStepGroupProps {
  /** Null: they could not be loaded. */
  factors: readonly Authenticator[] | null;
  hasPassword: boolean;
  /** Proves it is the member, then starts adding one. */
  onBeginAdd: (input: { name: string; password: string | null; code: string | null }) => Promise<Enrolment>;
  /** Confirms the new authenticator with its first code. Returns the backup codes to show once, when there are new ones. */
  onFinishAdd: (factorId: string, code: string) => Promise<readonly string[] | null>;
  onCancelAdd: (factorId: string) => Promise<void>;
  /** Proves it is the member with a fresh code from that authenticator, then removes it. */
  onRemove: (factor: Authenticator, code: string) => Promise<void>;
  /** G5: the backup codes block, given the codes just made. */
  renderBackupCodes?: (codes: readonly string[], onDone: () => void) => React.ReactNode;
}

type Step =
  | { kind: "idle"; done?: string }
  | { kind: "identify" }
  | { kind: "scan"; enrolment: Enrolment }
  | { kind: "codes"; codes: readonly string[] }
  | { kind: "remove"; factor: Authenticator };

function messageOf(error: unknown): string {
  return error instanceof SettingsError ? error.message : "Something went wrong. Try again.";
}

const CODE_FIELD = { icon: KeyRound, inputMode: "numeric" as const, maxLength: CODE_LENGTH + 1, autoComplete: "one-time-code", required: true };

export function TwoStepGroup({ factors, hasPassword, onBeginAdd, onFinishAdd, onCancelAdd, onRemove, renderBackupCodes }: TwoStepGroupProps) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = (next: Step = { kind: "idle" }) => {
    setStep(next);
    setName("");
    setPassword("");
    setCode("");
    setError("");
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  if (factors === null) {
    return (
      <Group title={MFA_COPY.group}>
        <Note>Couldn't load your authenticators. Try again later.</Note>
      </Group>
    );
  }

  const hasFactor = factors.length > 0;
  const cannotAdd = !hasFactor && !hasPassword;
  const actions = (primary: string, onCancel: () => void) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Button type="submit" variant="secondary" size={32} fontSize={12} disabled={busy}>
        {busy ? "Checking" : primary}
      </Button>
      <Button variant="ghost" size={32} fontSize={12} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );

  return (
    <Group title={MFA_COPY.group}>
      {factors.map((factor) => (
        <SettingRow
          key={factor.id}
          label={factor.name}
          hint={addedLabel(factor.createdAt)}
          control={
            step.kind === "remove" && step.factor.id === factor.id ? null : (
              <Button variant="secondary" size={32} fontSize={12} aria-label={`${MFA_COPY.remove} ${factor.name}`} onClick={() => reset({ kind: "remove", factor })}>
                {MFA_COPY.remove}
              </Button>
            )
          }
          below={
            step.kind === "remove" && step.factor.id === factor.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await onRemove(factor, code);
                    reset({ kind: "idle", done: MFA_COPY.removed });
                  });
                }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <AuthField label={`Code from ${factor.name}`} value={code} onChange={setCode} {...CODE_FIELD} />
                {actions(MFA_COPY.remove, () => reset())}
                {error ? <FieldMessage>{error}</FieldMessage> : null}
              </form>
            ) : null
          }
        />
      ))}
      <SettingRow
        last
        label="Authenticator app"
        hint={cannotAdd ? MFA_COPY.setPasswordFirst : hasFactor ? MFA_COPY.intro : MFA_COPY.none}
        control={
          step.kind === "identify" || step.kind === "scan" || step.kind === "codes" ? null : (
            <Button variant="secondary" size={32} fontSize={12} disabled={cannotAdd} onClick={() => reset({ kind: "identify" })}>
              {MFA_COPY.add}
            </Button>
          )
        }
        below={
          step.kind === "identify" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const enrolment = await onBeginAdd({ name, password: hasFactor ? null : password, code: hasFactor ? code : null });
                  setCode("");
                  setPassword("");
                  setStep({ kind: "scan", enrolment });
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <Note>{hasFactor ? MFA_COPY.codeFirst : MFA_COPY.passwordFirst}</Note>
              <AuthField label="Name (optional)" icon={Smartphone} value={name} onChange={setName} placeholder="Authenticator app" autoComplete="off" />
              {hasFactor ? (
                <AuthField label={`Code from ${factors[0].name}`} value={code} onChange={setCode} {...CODE_FIELD} />
              ) : (
                <AuthField label="Password" icon={Lock} showPasswordToggle value={password} onChange={setPassword} autoComplete="current-password" required />
              )}
              {actions("Continue", () => reset())}
              {error ? <FieldMessage>{error}</FieldMessage> : null}
            </form>
          ) : step.kind === "scan" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const codes = await onFinishAdd(step.enrolment.factorId, code);
                  if (codes && codes.length > 0 && renderBackupCodes) reset({ kind: "codes", codes });
                  else reset({ kind: "idle", done: MFA_COPY.added });
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <Note>{MFA_COPY.scan}</Note>
              <img src={step.enrolment.qrCode} alt="QR code for your authenticator app" width={160} height={160} style={{ background: "#ffffff", borderRadius: r.media, padding: 8 }} />
              <div>
                <span style={{ display: "block", color: t.label, fontSize: 12 }}>{MFA_COPY.keyLabel}</span>
                <code data-testid="totp-secret" style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text, wordBreak: "break-all", userSelect: "all" }}>
                  {step.enrolment.secret}
                </code>
              </div>
              <AuthField label={MFA_COPY.confirmCode} value={code} onChange={setCode} {...CODE_FIELD} />
              {actions("Confirm", () => {
                const factorId = step.enrolment.factorId;
                reset();
                void onCancelAdd(factorId).catch(() => undefined);
              })}
              {error ? <FieldMessage>{error}</FieldMessage> : null}
            </form>
          ) : step.kind === "codes" && renderBackupCodes ? (
            renderBackupCodes(step.codes, () => reset({ kind: "idle", done: MFA_COPY.added }))
          ) : step.kind === "idle" && step.done ? (
            <Note role="status">{step.done}</Note>
          ) : null
        }
      />
    </Group>
  );
}

export default TwoStepGroup;
