// G5 of the type prompt: while a section loads it draws one card per card it will show, so nothing below the first card
// moves when the section arrives. Connected apps shows one card (it may show none, when the list is not available; the
// skeleton shows the one it shows whenever there is a list).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { never } = vi.hoisted(() => ({ never: () => new Promise<never>(() => undefined) }));
vi.mock("@/lib/settings/account", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/settings/account")>()), loadAccount: never }));
vi.mock("@/lib/settings/notificationSettings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/settings/notificationSettings")>()), loadNotificationPreferences: never }));
vi.mock("@/lib/settings/privacySettings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/settings/privacySettings")>()), loadIsPrivate: never }));
vi.mock("@/lib/settings/blocks", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/settings/blocks")>()), listBlocks: never }));
vi.mock("@/lib/settings/apps", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/settings/apps")>()), listApps: never }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: null }) }));

import { PREFERENCE_GROUPS, type NotificationPreferences } from "@/lib/settings/notificationPrefs";

import { AccountView } from "./AccountView";
import { AppsView } from "./AppsView";
import { AccountSection, AppsSection, NotificationsSection, PrivacySection } from "./containers";
import { NotificationsView } from "./NotificationsView";
import { PrivacyView } from "./PrivacyView";

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);
const bones = (node: ReactNode) => render(wrap(node)).container.querySelectorAll('[data-testid="settings-card-bones"]').length;
const cards = (node: ReactNode) => render(wrap(node)).container.querySelectorAll("section[aria-label]").length;
const nop = async () => undefined;
const prefs = Object.fromEntries(PREFERENCE_GROUPS.flatMap((group) => group.rows.map((row) => [row.key, true]))) as unknown as NotificationPreferences;

describe("a settings section while it loads", () => {
  it("Account: one skeleton card per card", () => {
    const loaded = cards(<AccountView email="a@b.c" methods={[]} onChangeEmail={nop} onChangePassword={nop} onLink={nop} onUnlink={nop} onSignOutEverywhere={nop} />);
    expect(loaded).toBe(4);
    expect(bones(<AccountSection />)).toBe(loaded);
  });

  it("Notifications: one skeleton card per group", () => {
    const loaded = cards(<NotificationsView prefs={prefs} onToggle={() => undefined} />);
    expect(loaded).toBe(PREFERENCE_GROUPS.length);
    expect(bones(<NotificationsSection />)).toBe(loaded);
  });

  it("Privacy and blocking: one skeleton card per card", () => {
    const loaded = cards(<PrivacyView isPrivate={false} onTogglePrivate={() => undefined} blocked={[]} onUnblock={() => undefined} />);
    expect(loaded).toBe(3);
    expect(bones(<PrivacySection />)).toBe(loaded);
  });

  it("Connected apps: one skeleton card, the one the listed apps sit in", () => {
    const loaded = cards(<AppsView apps={[]} onRevoke={nop} />);
    expect(loaded).toBe(1);
    expect(bones(<AppsSection />)).toBe(loaded);
  });
});

describe("the route table's placeholder for Settings", () => {
  it("is the Settings page while it loads: its h1, its list, and the section's cards", async () => {
    const { SettingsPlaceholder } = await import("@/lib/routing/placeholders");
    const view = render(
      <MemoryRouter initialEntries={["/settings/notifications"]}>
        <SettingsPlaceholder />
      </MemoryRouter>,
    );
    expect(view.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
    expect(view.getByRole("heading", { level: 2 }).textContent).toBe("Notifications");
    expect(view.container.querySelectorAll('[data-testid="settings-card-bones"]').length).toBe(PREFERENCE_GROUPS.length);
  });
});
