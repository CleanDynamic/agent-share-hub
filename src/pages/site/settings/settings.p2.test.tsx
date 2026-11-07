// UX-15 P2: the routes, the unknown section, aria-current, the phone list and the three entry points.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/shell/useMinWidth", async (original) => ({
  ...(await original<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => phone.on,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: {}, from: vi.fn() } }));

import { AccountMenu } from "@/components/shell/AccountMenu";
import { trailFor } from "@/components/shell/breadcrumbTrail";
import { ROUTE_TABLE, matchRoute } from "@/lib/routing/routeTable";
import { activityFixture } from "@/dev/fixtures/activity";
import { ActivityView } from "@/pages/site/activity/ActivityView";
import { CustomiseProfile } from "@/pages/site/profile/CustomiseProfile";
import { DEFAULT_SETTINGS } from "@/lib/profile/settings";

import { SettingsPage } from "./SettingsPage";

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<><SettingsPage /><Where /></>} />
        <Route path="/settings/:section" element={<><SettingsPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  phone.on = false;
});
afterEach(cleanup);

describe("the routes", () => {
  it("answers /settings and every section from one route table entry, signed in only", () => {
    expect(ROUTE_TABLE.settings.signedIn).toBe(true);
    for (const path of ["/settings", "/settings/account", "/settings/privacy", "/settings/data"]) {
      expect(matchRoute(path)?.entry.key, path).toBe("settings");
    }
    expect(matchRoute("/settings/a/b")).toBeNull();
  });

  it("names the trail Home / Settings / <section>", () => {
    expect(trailFor("/settings", null)).toEqual([{ label: "Home", href: "/" }, { label: "Settings" }]);
    expect(trailFor("/settings/privacy", null)).toEqual([
      { label: "Home", href: "/" },
      { label: "Settings", href: "/settings" },
      { label: "Privacy and blocking" },
    ]);
    expect(trailFor("/settings/billing", null)).toEqual([{ label: "Home", href: "/" }, { label: "Settings" }]);
  });
});

describe("on a desktop", () => {
  it("lists the six sections and marks the current one", () => {
    mount("/settings/privacy");
    const nav = screen.getByRole("navigation", { name: "Settings" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Account", "Notifications", "Privacy and blocking", "Connected apps", "Your data", "Appearance"]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["Privacy and blocking"]);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy and blocking" })).toBeTruthy();
  });

  it("shows the first section beside the list at /settings", () => {
    mount("/settings");
    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Settings" })).getByRole("link", { name: "Account" }).getAttribute("aria-current")).toBe("page");
  });

  it("sends a section that does not exist to /settings", () => {
    mount("/settings/billing");
    expect(screen.getByTestId("where").textContent).toBe("/settings");
  });
});

describe("on a phone", () => {
  it("is the list at /settings: six rows, each a link to its section, one h1", () => {
    phone.on = true;
    mount("/settings");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
    const links = within(screen.getByRole("navigation", { name: "Settings" })).getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[2].getAttribute("href")).toBe("/settings/privacy");
  });

  it("is the section alone at /settings/<section>, with no list", () => {
    phone.on = true;
    mount("/settings/data");
    expect(screen.getByRole("heading", { level: 1, name: "Your data" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Settings" })).toBeNull();
  });
});

describe("the three entry points", () => {
  it("the account menu has Settings between Drafts and Sign out", () => {
    render(
      <MemoryRouter>
        <AccountMenu viewer={{ id: "u1", name: "Ada", handle: "ada", avatarUrl: null }} onSignOut={vi.fn()} defaultOpen />
      </MemoryRouter>,
    );
    const items = [...screen.getByRole("menu").querySelectorAll("a, button")];
    expect(items.map((el) => el.textContent)).toEqual(["Profile", "Library", "Drafts", "Settings", "Sign out"]);
    expect(items[3].getAttribute("href")).toBe("/settings");
  });

  it("Customise profile's Who sees group links to /settings/privacy", () => {
    render(
      <MemoryRouter>
        <CustomiseProfile
          open
          onClose={vi.fn()}
          initial={{ displayName: "Maya", oneLine: "", location: "", links: [], about: "", settings: { ...DEFAULT_SETTINGS, sideSections: DEFAULT_SETTINGS.sideSections.map((s) => ({ ...s })) }, pins: [] }}
          pinLabels={new Map()}
          pictures={{ avatar: { url: null }, header: { url: null } }}
          onPicture={vi.fn()}
          onSave={vi.fn(async () => undefined)}
        />
      </MemoryRouter>,
    );
    const who = screen.getByRole("region", { name: "Who sees" });
    expect(within(who).getByRole("link", { name: "More privacy settings" }).getAttribute("href")).toBe("/settings/privacy");
  });

  it("the Activity page has a quiet Notification settings link", () => {
    render(
      <MemoryRouter>
        <ActivityView fit="content" {...activityFixture()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Notification settings" }).getAttribute("href")).toBe("/settings/notifications");
  });
});
