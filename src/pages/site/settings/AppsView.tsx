/* UX-15 P7: Connected apps. PURE.

   Each app the person approved on /oauth/consent: its registered name (text, as the consent page shows it), what it can access
   (the scopes it was granted, as the auth server names them), when it was authorised, and `Revoke`, which asks once. When the auth
   server cannot list apps the section is one sentence. */

import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { APPS_COPY, grantedLabel, type ConnectedApp } from "@/lib/settings/apps";
import { useAction } from "@/lib/settings/useAction";
import { t } from "@/lib/theme/tokens";

import { ConfirmInline, Group, Note, SectionPage, SettingRow } from "./SettingParts";

export interface AppsViewProps {
  /** Null: the auth server cannot list apps. */
  apps: readonly ConnectedApp[] | null;
  onRevoke: (app: ConnectedApp) => Promise<void>;
}

function AppRow({ app, last, onRevoke }: { app: ConnectedApp; last: boolean; onRevoke: AppsViewProps["onRevoke"] }) {
  const [asking, setAsking] = useState(false);
  const action = useAction(() => onRevoke(app), "settings-revoke");
  return (
    <SettingRow
      last={last}
      label={app.name}
      hint={
        <>
          <span style={{ display: "block" }}>{app.scopes.length > 0 ? `Can access: ${app.scopes.join(", ")}` : "No access listed"}</span>
          <span style={{ display: "block", color: t.label }}>{`Authorised ${grantedLabel(app.grantedAt)}`}</span>
        </>
      }
      control={
        asking ? null : (
          <Button variant="secondary" size={32} fontSize={12} aria-label={`${APPS_COPY.revoke} ${app.name}`} onClick={() => setAsking(true)}>
            {APPS_COPY.revoke}
          </Button>
        )
      }
      below={
        asking ? (
          <ConfirmInline
            message={APPS_COPY.confirm(app.name)}
            confirmLabel={APPS_COPY.revoke}
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

export function AppsView({ apps, onRevoke }: AppsViewProps) {
  return (
    <SectionPage title="Connected apps">
      {apps === null ? (
        <Note>{APPS_COPY.unavailable}</Note>
      ) : (
        <Group title="Apps that can access your account">
          {apps.length === 0 ? (
            <Note>{APPS_COPY.empty}</Note>
          ) : (
            apps.map((app, index) => <AppRow key={app.clientId} app={app} last={index === apps.length - 1} onRevoke={onRevoke} />)
          )}
        </Group>
      )}
    </SectionPage>
  );
}

export default AppsView;
