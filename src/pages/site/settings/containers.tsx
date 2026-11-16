/* UX-15: the containers. One per section: each reads what its view needs through `src/lib/settings/` only (query keys
   `['settings', '<fn>', ...]`), maps it to the view's props and hands the view its callbacks. No Supabase call in this file. The views
   are pure and tested on their own. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageState, type PageStateProps } from "@/components/pagestate/PageState";
import { useAuth } from "@/contexts/AuthContext";
import { APPS_COPY, listApps, revokeApp } from "@/lib/settings/apps";
import { DATA_COPY, deleteMyAccount, prepareExport, saveFile } from "@/lib/settings/data";
import { blockKeys, listBlocks, unblockUser, type BlockedPerson } from "@/lib/settings/blocks";
import { loadIsPrivate, setIsPrivate } from "@/lib/settings/privacySettings";
import { loadNotificationPreferences, setNotificationPreference } from "@/lib/settings/notificationSettings";
import { type NotificationPreferences, type PreferenceKey } from "@/lib/settings/notificationPrefs";
import { changeEmail, changePassword, hasPassword, linkProvider, listMySessions, loadAccount, signOutDevice, signOutEverywhere, unlinkMethod } from "@/lib/settings/account";

import { AccountView } from "./AccountView";
import { AppsView } from "./AppsView";
import { DataView } from "./DataView";
import { NotificationsView } from "./NotificationsView";
import { PrivacyView } from "./PrivacyView";
import { SectionLoading, SectionPage } from "./SettingParts";
import { SECTION_BONES } from "./SettingsLoading";

const STALE_MS = 60_000;

/**
 * G4: a section's loading and failed states, through PageState: its skeleton is the section's own, and a failure sits under
 * the section's title. The view draws its own title once the data is in. G1: a read that never answers fails at
 * READ_TIMEOUT_MS by itself, so no section keeps a timer of its own.
 */
function SectionState({ title, read, groups, empty, children }: { title: string; read: PageStateProps["read"]; groups: Parameters<typeof SectionLoading>[0]["groups"]; empty?: PageStateProps["empty"]; children: () => React.ReactNode }) {
  return (
    <PageState
      read={read}
      thing="your settings"
      region={title}
      skeleton={<SectionLoading title={title} groups={groups} />}
      frame={(body) => <SectionPage title={title}>{body}</SectionPage>}
      frameReady={false}
      empty={empty}
    >
      {children}
    </PageState>
  );
}

export function AccountSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const account = useQuery({ queryKey: ["settings", "loadAccount"], queryFn: loadAccount, staleTime: STALE_MS });
  // G16: the devices load on their own. If they cannot, the group says so in one line and the rest of the page works.
  const sessions = useQuery({ queryKey: ["settings", "listMySessions"], queryFn: listMySessions, staleTime: STALE_MS, retry: 1 });
  return <SectionState title="Account" read={account} groups={SECTION_BONES.account}>{() => {
  const { email, methods } = account.data!;
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
      devices={sessions}
      onSignOutDevice={async (session) => {
        await signOutDevice(session);
        if (session.current) {
          navigate("/login", { replace: true });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["settings", "listMySessions"] });
      }}
    />
  );
  }}</SectionState>;
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
  return (
    <SectionState title="Notifications" read={prefs} groups={SECTION_BONES.notifications}>
      {() => <NotificationsView prefs={prefs.data!} onToggle={(changed, on) => write.mutate({ key: changed, on })} />}
    </SectionState>
  );
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

  return (
    <SectionState title="Privacy and blocking" read={[isPrivate, blocks]} groups={SECTION_BONES.privacy}>
      {() => <PrivacyView isPrivate={isPrivate.data!} onTogglePrivate={(on) => togglePrivate.mutate(on)} blocked={blocks.data!} onUnblock={(person) => void unblock(person)} busy={busy} />}
    </SectionState>
  );
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
  return (
    <SectionState
      title="Connected apps"
      read={apps}
      groups={SECTION_BONES.apps}
      empty={{ when: ([state]) => (state as Awaited<ReturnType<typeof listApps>>).state === "listed" && (state as { apps: unknown[] }).apps.length === 0, line: APPS_COPY.empty }}
    >
      {() => (
    <AppsView
      apps={apps.data!.state === "listed" ? apps.data!.apps : null}
      onRevoke={async (app) => {
        await revokeApp(app.clientId);
        await queryClient.invalidateQueries({ queryKey: ["settings", "listApps"] });
        toast("Access revoked.");
      }}
    />
      )}
    </SectionState>
  );
}
