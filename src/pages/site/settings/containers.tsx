/* UX-15: the containers. One per section: each reads what its view needs through `src/lib/settings/` only (query keys
   `['settings', '<fn>', ...]`), maps it to the view's props and hands the view its callbacks. No Supabase call in this file. The views
   are pure and tested on their own. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { loadNotificationPreferences, setNotificationPreference } from "@/lib/settings/notificationSettings";
import { type NotificationPreferences, type PreferenceKey } from "@/lib/settings/notificationPrefs";
import { changeEmail, changePassword, hasPassword, linkProvider, loadAccount, signOutEverywhere, unlinkMethod } from "@/lib/settings/account";

import { AccountView } from "./AccountView";
import { NotificationsView } from "./NotificationsView";
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

/** The saved line every switch and choice says: quiet, a toast, nothing that moves. */
export const SAVED = "Saved.";
export const NOT_SAVED = "Couldn't save that. Try again.";

export function NotificationsSection() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = ["settings", "loadNotificationPreferences", userId] as const;
  const prefs = useQuery({ queryKey: key, queryFn: () => loadNotificationPreferences(userId!), enabled: !!userId, staleTime: STALE_MS });
  const write = useMutation({
    mutationFn: (input: { key: PreferenceKey; on: boolean }) => setNotificationPreference(input.key, input.on),
    // The switch moves at once; a refused write puts it back.
    onMutate: async ({ key: changed, on }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<NotificationPreferences>(key);
      queryClient.setQueryData<NotificationPreferences>(key, (current) => (current ? { ...current, [changed]: on } : current));
      return { before };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.before);
      toast(NOT_SAVED);
    },
    onSuccess: () => toast(SAVED),
  });
  if (prefs.isError) return <SectionError title="Notifications" onRetry={() => void prefs.refetch()} />;
  if (!prefs.data) return <SectionLoading title="Notifications" rows={4} />;
  return <NotificationsView prefs={prefs.data} onToggle={(changed, on) => write.mutate({ key: changed, on })} />;
}
