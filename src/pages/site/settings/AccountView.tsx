/* UX-15 P3: Account. PURE: data and callbacks in, three groups out. The only state here is what is typed and what a request says.

   Email: the address and `Change email`, which opens a field and `Save`. Password: `Change password`, or `Set a password` for a
   person who signs in through a provider. Sign-in methods and devices: each linked provider with `Unlink` (off, with the reason, for
   the last one), `Link <provider>` for the rest, and `Sign out everywhere`, which asks once.

   G16: Devices lists each session (device and browser, last active, this device marked) with its own `Sign out`, which asks once,
   says in plain words that a signed-out device can keep working for up to an hour, and keeps `Sign out everywhere`. */

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { Lock, Mail } from "lucide-react";
import { useId, useState } from "react";

import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/brand/Button";
import {
  COPY,
  calculatePasswordStrength,
  canUnlink,
  describeDevice,
  lastActiveLabel,
  type DeviceSession,
  hasPassword as hasPasswordOf,
  linkableFor,
  type LinkableProvider,
  type SignInMethod,
} from "@/lib/settings/account";
import { useAction } from "@/lib/settings/useAction";
import { t } from "@/lib/theme/tokens";
import { AuthField, FieldMessage, useErrorFocus } from "@/pages/site/signin/AuthParts";

import { ConfirmInline, Group, Note, SectionPage, SettingRow } from "./SettingParts";

export interface AccountViewProps {
  email: string | null;
  methods: SignInMethod[];
  onChangeEmail: (next: string) => Promise<void>;
  onChangePassword: (input: { current: string | null; next: string }) => Promise<void>;
  onLink: (provider: LinkableProvider) => Promise<void>;
  onUnlink: (id: string) => Promise<void>;
  onSignOutEverywhere: () => Promise<void>;
  /** G16: the member's sessions, newest activity first, as a read: PageState draws its loading and failed states (G2). */
  devices: ReadLike;
  onSignOutDevice: (session: DeviceSession) => Promise<void>;
}

function EmailGroup({ email, onChangeEmail }: Pick<AccountViewProps, "email" | "onChangeEmail">) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const action = useAction(onChangeEmail, "settings-email");
  const emailFailed = action.state.status === "error";
  const emailErrorId = useId();
  const emailFocus = useErrorFocus<HTMLFormElement>();
  const sent = action.state.status === "sent";
  return (
    <Group title="Email">
      <SettingRow
        last
        label="Email address"
        hint={email ?? "Loading"}
        control={
          open ? null : (
            <Button variant="secondary" size={32} fontSize={12} onClick={() => { setOpen(true); action.reset(); }}>
              Change email
            </Button>
          )
        }
        below={
          open ? (
            <form
              ref={emailFocus.ref}
              onInputCapture={emailFocus.disarm}
              onSubmit={async (event) => {
                event.preventDefault();
                emailFocus.arm();
                if (await action.run(next)) setNext("");
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <AuthField label="New email address" icon={Mail} type="email" value={next} onChange={setNext} autoComplete="email" required describedBy={emailFailed ? emailErrorId : undefined} invalid={emailFailed} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="submit" variant="secondary" size={32} fontSize={12} disabled={action.state.status === "sending"}>
                  {action.state.status === "sending" ? "Sending" : "Save"}
                </Button>
                <Button variant="ghost" size={32} fontSize={12} onClick={() => { setOpen(false); setNext(""); action.reset(); }}>
                  {sent ? "Close" : "Cancel"}
                </Button>
              </div>
              {/* G14, G15: the error is the field's: tied to it, said once as its description when focus goes there. */}
              {action.state.status === "error" ? <FieldMessage id={emailErrorId} live={false}>{action.state.message}</FieldMessage> : null}
              {sent ? <Note role="status">{COPY.emailSent}</Note> : null}
            </form>
          ) : null
        }
      />
    </Group>
  );
}

function PasswordGroup({ hasPassword, onChangePassword }: { hasPassword: boolean; onChangePassword: AccountViewProps["onChangePassword"] }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const action = useAction(onChangePassword, "settings-password");
  const sent = action.state.status === "sent";
  const passwordFailed = action.state.status === "error";
  const passwordErrorId = useId();
  const passwordFocus = useErrorFocus<HTMLFormElement>();
  const verb = hasPassword ? "Change password" : "Set a password";
  return (
    <Group title="Password">
      <SettingRow
        last
        label="Password"
        hint={hasPassword ? "The password you sign in with." : "You sign in through a provider. A password lets you sign in with your email too."}
        control={
          open ? null : (
            <Button variant="secondary" size={32} fontSize={12} onClick={() => { setOpen(true); action.reset(); }}>
              {verb}
            </Button>
          )
        }
        below={
          open ? (
            <form
              ref={passwordFocus.ref}
              onInputCapture={passwordFocus.disarm}
              onSubmit={async (event) => {
                event.preventDefault();
                passwordFocus.arm();
                if (await action.run({ current: hasPassword ? current : null, next })) {
                  setCurrent("");
                  setNext("");
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {hasPassword ? (
                <AuthField label="Current password" icon={Lock} showPasswordToggle value={current} onChange={setCurrent} autoComplete="current-password" required describedBy={passwordFailed ? passwordErrorId : undefined} invalid={passwordFailed} />
              ) : null}
              <div>
                <AuthField label="New password" icon={Lock} showPasswordToggle value={next} onChange={setNext} placeholder="At least 8 characters" autoComplete="new-password" required describedBy={passwordFailed ? passwordErrorId : undefined} invalid={passwordFailed} />
                {next ? <PasswordStrengthMeter strength={calculatePasswordStrength(next)} /> : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="submit" variant="secondary" size={32} fontSize={12} disabled={action.state.status === "sending"}>
                  {action.state.status === "sending" ? "Saving" : "Save"}
                </Button>
                <Button variant="ghost" size={32} fontSize={12} onClick={() => { setOpen(false); setCurrent(""); setNext(""); action.reset(); }}>
                  {sent ? "Close" : "Cancel"}
                </Button>
              </div>
              {/* G14, G15: the server's refusal names neither field, so it is tied to both; focus goes to the first. */}
              {action.state.status === "error" ? <FieldMessage id={passwordErrorId} live={false}>{action.state.message}</FieldMessage> : null}
              {sent ? <Note role="status">{COPY.passwordChanged}</Note> : null}
            </form>
          ) : null
        }
      />
    </Group>
  );
}

function MethodsGroup({ methods, onLink, onUnlink }: Pick<AccountViewProps, "methods" | "onLink" | "onUnlink">) {
  const unlink = useAction(onUnlink, "settings-unlink");
  const link = useAction(onLink, "settings-link");
  const [busyId, setBusyId] = useState<string | null>(null);
  const removable = canUnlink(methods);
  const rest = linkableFor(methods);
  return (
    <Group title="Sign-in methods">
      {methods.map((method, index) => (
        <SettingRow
          key={method.id}
          last={index === methods.length - 1 && rest.length === 0}
          label={method.label}
          hint={removable ? method.email : (<>{method.email ? `${method.email}. ` : ""}{COPY.onlyMethod}</>)}
          control={
            <Button
              variant="secondary"
              size={32}
              fontSize={12}
              disabled={!removable || busyId === method.id}
              aria-label={`Unlink ${method.label}`}
              onClick={async () => {
                setBusyId(method.id);
                await unlink.run(method.id);
                setBusyId(null);
              }}
            >
              Unlink
            </Button>
          }
        />
      ))}
      {rest.map((one, index) => (
        <SettingRow
          key={one.provider}
          last={index === rest.length - 1}
          label={one.label}
          hint="Not linked"
          control={
            <Button variant="secondary" size={32} fontSize={12} onClick={() => void link.run(one.provider)}>
              {`Link ${one.label}`}
            </Button>
          }
        />
      ))}
      {unlink.state.status === "error" ? <FieldMessage>{unlink.state.message}</FieldMessage> : null}
      {link.state.status === "error" ? <FieldMessage>{link.state.message}</FieldMessage> : null}
    </Group>
  );
}

function DeviceRow({ session, onSignOutDevice }: { session: DeviceSession; onSignOutDevice: AccountViewProps["onSignOutDevice"] }) {
  const [asking, setAsking] = useState(false);
  const action = useAction(() => onSignOutDevice(session), "settings-signout-device");
  const device = describeDevice(session.userAgent);
  return (
    <SettingRow
      label={device}
      hint={
        <>
          <span style={{ display: "block" }}>{lastActiveLabel(session.lastActive)}</span>
          {session.current ? <span style={{ display: "block", color: t.label }}>{COPY.thisDevice}</span> : null}
        </>
      }
      control={
        asking ? null : (
          <Button variant="secondary" size={32} fontSize={12} aria-label={`Sign out ${device}`} onClick={() => setAsking(true)}>
            Sign out
          </Button>
        )
      }
      below={
        asking ? (
          <ConfirmInline
            message={session.current ? COPY.signOutThisDevice : COPY.signOutDevice(device)}
            confirmLabel="Sign out"
            busy={action.state.status === "sending"}
            error={action.state.status === "error" ? action.state.message : null}
            onConfirm={() => void action.run()}
            onCancel={() => { setAsking(false); action.reset(); }}
          />
        ) : null
      }
    />
  );
}

function DevicesGroup({ onSignOutEverywhere, devices, onSignOutDevice }: Pick<AccountViewProps, "onSignOutEverywhere" | "devices" | "onSignOutDevice">) {
  const sessions = (devices.data as readonly DeviceSession[] | undefined) ?? [];
  const [asking, setAsking] = useState(false);
  const action = useAction(onSignOutEverywhere, "settings-signout");
  return (
    <Group title="Devices">
      <PageState
        read={devices}
        thing="your devices"
        region="Devices"
        log="[Settings] devices read failed"
        style={{ paddingBlock: 12 }}
        skeleton={
          <LoadingRegion what="your devices">
            <Skeleton height={48} />
          </LoadingRegion>
        }
      >
        {() => (
          <>
            {sessions.map((session) => <DeviceRow key={session.id} session={session} onSignOutDevice={onSignOutDevice} />)}
            {sessions.length > 0 ? <Note>{COPY.devicesHour}</Note> : null}
          </>
        )}
      </PageState>
      <SettingRow
        last
        label="Sign out everywhere"
        hint="Ends every session, on every device. You will sign in again here."
        control={
          asking ? null : (
            <Button variant="secondary" size={32} fontSize={12} onClick={() => setAsking(true)}>
              Sign out everywhere
            </Button>
          )
        }
        below={
          asking ? (
            <ConfirmInline
              message={COPY.signOutEverywhere}
              confirmLabel="Sign out everywhere"
              busy={action.state.status === "sending"}
              error={action.state.status === "error" ? action.state.message : null}
              onConfirm={() => void action.run()}
              onCancel={() => { setAsking(false); action.reset(); }}
            />
          ) : null
        }
      />
    </Group>
  );
}

export function AccountView(props: AccountViewProps) {
  return (
    <SectionPage title="Account">
      <EmailGroup email={props.email} onChangeEmail={props.onChangeEmail} />
      <PasswordGroup hasPassword={hasPasswordOf(props.methods)} onChangePassword={props.onChangePassword} />
      <MethodsGroup methods={props.methods} onLink={props.onLink} onUnlink={props.onUnlink} />
      <DevicesGroup onSignOutEverywhere={props.onSignOutEverywhere} devices={props.devices} onSignOutDevice={props.onSignOutDevice} />
    </SectionPage>
  );
}

export default AccountView;
