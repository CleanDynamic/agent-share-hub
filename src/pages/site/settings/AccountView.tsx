/* UX-15 P3: Account. PURE: data and callbacks in, three groups out. The only state here is what is typed and what a request says.

   Email: the address and `Change email`, which opens a field and `Save`. Password: `Change password`, or `Set a password` for a
   person who signs in through a provider. Sign-in methods and devices: each linked provider with `Unlink` (off, with the reason, for
   the last one), `Link <provider>` for the rest, and `Sign out everywhere`, which asks once. */

import { Lock, Mail } from "lucide-react";
import { useState } from "react";

import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Button } from "@/components/brand/Button";
import {
  COPY,
  calculatePasswordStrength,
  canUnlink,
  hasPassword as hasPasswordOf,
  linkableFor,
  type LinkableProvider,
  type SignInMethod,
} from "@/lib/settings/account";
import { useAction } from "@/lib/settings/useAction";
import { AuthField, FieldMessage } from "@/pages/site/signin/AuthParts";

import { ConfirmInline, Group, Note, SectionPage, SettingRow } from "./SettingParts";

export interface AccountViewProps {
  email: string | null;
  methods: SignInMethod[];
  onChangeEmail: (next: string) => Promise<void>;
  onChangePassword: (input: { current: string | null; next: string }) => Promise<void>;
  onLink: (provider: LinkableProvider) => Promise<void>;
  onUnlink: (id: string) => Promise<void>;
  onSignOutEverywhere: () => Promise<void>;
}

function EmailGroup({ email, onChangeEmail }: Pick<AccountViewProps, "email" | "onChangeEmail">) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const action = useAction(onChangeEmail, "settings-email");
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
              onSubmit={async (event) => {
                event.preventDefault();
                if (await action.run(next)) setNext("");
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <AuthField label="New email address" icon={Mail} type="email" value={next} onChange={setNext} autoComplete="email" required />
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="submit" variant="secondary" size={32} fontSize={12} disabled={action.state.status === "sending"}>
                  {action.state.status === "sending" ? "Sending" : "Save"}
                </Button>
                <Button variant="ghost" size={32} fontSize={12} onClick={() => { setOpen(false); setNext(""); action.reset(); }}>
                  {sent ? "Close" : "Cancel"}
                </Button>
              </div>
              {action.state.status === "error" ? <FieldMessage>{action.state.message}</FieldMessage> : null}
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
              onSubmit={async (event) => {
                event.preventDefault();
                if (await action.run({ current: hasPassword ? current : null, next })) {
                  setCurrent("");
                  setNext("");
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {hasPassword ? (
                <AuthField label="Current password" icon={Lock} showPasswordToggle value={current} onChange={setCurrent} autoComplete="current-password" required />
              ) : null}
              <div>
                <AuthField label="New password" icon={Lock} showPasswordToggle value={next} onChange={setNext} placeholder="At least 8 characters" autoComplete="new-password" required />
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
              {action.state.status === "error" ? <FieldMessage>{action.state.message}</FieldMessage> : null}
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

function DevicesGroup({ onSignOutEverywhere }: Pick<AccountViewProps, "onSignOutEverywhere">) {
  const [asking, setAsking] = useState(false);
  const action = useAction(onSignOutEverywhere, "settings-signout");
  return (
    <Group title="Devices">
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
      <DevicesGroup onSignOutEverywhere={props.onSignOutEverywhere} />
    </SectionPage>
  );
}

export default AccountView;
