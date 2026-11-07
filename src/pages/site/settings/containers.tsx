/* UX-15: the containers. One per section: each reads what its view needs through `src/lib/settings/` only (query keys
   `['settings', '<fn>', ...]`), maps it to the view's props and hands the view its callbacks. No Supabase call in this file. The views
   are pure and tested on their own. */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { changeEmail, changePassword, hasPassword, linkProvider, loadAccount, signOutEverywhere, unlinkMethod } from "@/lib/settings/account";

import { AccountView } from "./AccountView";
import { SectionError, SectionLoading } from "./SettingParts";

const STALE_MS = 60_000;

export function AccountSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["settings", "loadAccount"], queryFn: loadAccount, staleTime: STALE_MS });
  if (account.isError) return <SectionError title="Account" onRetry={() => void account.refetch()} />;
  if (!account.data) return <SectionLoading title="Account" />;
  const { email, methods } = account.data;
  return (
    <AccountView
      email={email}
      methods={methods}
      onChangeEmail={(next) => changeEmail(next, email)}
      onChangePassword={async ({ current, next }) => {
        await changePassword({ email, current, next, hasPassword: hasPassword(methods) });
        await queryClient.invalidateQueries({ queryKey: ["settings", "loadAccount"] });
      }}
      onLink={linkProvider}
      onUnlink={async (id) => {
        await unlinkMethod(id);
        await queryClient.invalidateQueries({ queryKey: ["settings", "loadAccount"] });
      }}
      onSignOutEverywhere={async () => {
        await signOutEverywhere();
        navigate("/login", { replace: true });
      }}
    />
  );
}
