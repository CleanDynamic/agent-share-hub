/* UX-15: the containers. One per section: each reads what its view needs through `src/lib/settings/` only (query keys
   `['settings', '<fn>', ...]`), maps it to the view's props and hands the view its callbacks. No Supabase call in this file. The views
   are pure and tested on their own. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { listApps, revokeApp } from "@/lib/settings/apps";
import { DATA_COPY, deleteMyAccount, prepareExport, saveFile } from "@/lib/settings/data";
import { blockKeys, listBlocks, unblockUser, type BlockedPerson } from "@/lib/settings/blocks";
import { loadIsPrivate, setIsPrivate } from "@/lib/settings/privacySettings";
import { loadNotificationPreferences, setNotificationPreference } from "@/lib/settings/notificationSettings";
import { type NotificationPreferences, type PreferenceKey } from "@/lib/settings/notificationPrefs";
import { changeEmail, changePassword, hasPassword, linkProvider, loadAccount, signOutEverywhere, unlinkMethod } from "@/lib/settings/account";

import { AccountView } from "./AccountView";
import { AppsView } from "./AppsView";
import { DataView } from "./DataView";
import { NotificationsView } from "./NotificationsView";
import { PrivacyView } from "./PrivacyView";
import { SectionError, SectionLoading } from "./SettingParts";
import { SECTION_BONES } from "./SettingsLoading";

const STALE_MS = 60_000;

export function AccountSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["settings", "loadAccount"], queryFn: loadAccount, staleTime: STALE_MS });
  if (account.isError) return <SectionError title="Account" onRetry={() => void account.refetch()} />;
  if (!account.data) return <SectionLoading title="Account" groups={SECTION_BONES.account} />;
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
  if (!prefs.data) return <SectionLoading title="Notifications" groups={SECTION_BONES.notifications} />;
  return <NotificationsView prefs={prefs.data} onToggle={(changed, on) => write.mutate({ key: changed, on })} />;
}

export function PrivacySection() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const privateKey = ["settings", "loadIsPrivate", userId] as const;
  /* Both reads need only the reader, so they go together: one round. */
  const isPrivate = useQuery({ queryKey: privateKey, queryFn: () => loadIsPrivate(userId!), enabled: !!userId, staleTime: STALE_MS });
  const blocks = useQuery({ queryKey: blockKeys.list, queryFn: () => listBlocks(), enabled: !!userId, staleTime: STALE_MS });

  const togglePrivate = useMutation({
    mutationFn: (on: boolean) => setIsPrivate(userId!, on),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey: privateKey });
      const before = queryClient.getQueryData<boolean>(privateKey);
      queryClient.setQueryData(privateKey, on);
      return { before };
    },
    onError: (_error, _on, context) => {
      queryClient.setQueryData(privateKey, context?.before);
      toast(NOT_SAVED);
    },
    onSuccess: () => {
      toast(SAVED);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const unblock = async (person: BlockedPerson) => {
    if (!userId) return;
    setBusy((current) => new Set(current).add(person.id));
    try {
      await unblockUser(userId, person.id);
      queryClient.setQueryData<BlockedPerson[]>(blockKeys.list, (current) => (current ?? []).filter((one) => one.id !== person.id));
      void queryClient.invalidateQueries({ predicate: (query) => ["feed", "profile", "openbuilds", "posts", "post", "notifications", "messages"].includes(String(query.queryKey[0])) || query.queryKey[1] === "listBlockedIds" || query.queryKey[1] === "blockStateOf" });
      toast("Unblocked.");
    } catch {
      toast(NOT_SAVED);
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(person.id);
        return next;
      });
    }
  };

  if (isPrivate.isError || blocks.isError) return <SectionError title="Privacy and blocking" onRetry={() => { void isPrivate.refetch(); void blocks.refetch(); }} />;
  if (isPrivate.data === undefined || !blocks.data) return <SectionLoading title="Privacy and blocking" groups={SECTION_BONES.privacy} />;
  return <PrivacyView isPrivate={isPrivate.data} onTogglePrivate={(on) => togglePrivate.mutate(on)} blocked={blocks.data} onUnblock={(person) => void unblock(person)} busy={busy} />;
}

export function DataSection() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <DataView
      username={profile?.username ?? null}
      onPrepare={prepareExport}
      onSave={saveFile}
      onDelete={async (typed) => {
        await deleteMyAccount(typed);
        queryClient.clear();
        navigate("/", { replace: true });
        toast(DATA_COPY.accountDeleted);
      }}
    />
  );
}

export function AppsSection() {
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: ["settings", "listApps"], queryFn: listApps, staleTime: STALE_MS });
  if (apps.isError) return <SectionError title="Connected apps" onRetry={() => void apps.refetch()} />;
  if (!apps.data) return <SectionLoading title="Connected apps" groups={SECTION_BONES.apps} />;
  return (
    <AppsView
      apps={apps.data.state === "listed" ? apps.data.apps : null}
      onRevoke={async (app) => {
        await revokeApp(app.clientId);
        await queryClient.invalidateQueries({ queryKey: ["settings", "listApps"] });
        toast("Access revoked.");
      }}
    />
  );
}
