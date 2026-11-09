// UX-15 P4: Notifications. Each switch writes its own key, a missing key reads as on, a refused write puts the switch back, and the
// retired kinds have no row. (That a turned-off kind is skipped by rc_notify is T11 in design/audits/ux-15/rls-plan.sql.)

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rpc: vi.fn(), prefs: {} as Record<string, unknown> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: db.rpc,
    auth: {},
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { notification_preferences: db.prefs }, error: null }) }) }) }) }),
  },
}));
const toasts = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(toasts, { error: toasts }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { PREFERENCE_GROUPS, PREFERENCE_KEYS, parsePreferences } from "@/lib/settings/notificationPrefs";

import { NotificationsSection, NOT_SAVED, SAVED } from "./containers";
import { NOTIFICATIONS_NOTE, NotificationsView } from "./NotificationsView";

beforeEach(() => {
  vi.clearAllMocks();
  db.prefs = {};
  db.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(cleanup);

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NotificationsSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("the view", () => {
  it("has the four groups, one switch per row, each named for what it does", () => {
    render(<NotificationsView prefs={parsePreferences({})} onToggle={vi.fn()} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Your builds", "Topics and replies", "People", "Saved things"]);
    const labels = PREFERENCE_GROUPS.flatMap((g) => g.rows.map((r) => r.label));
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-labelledby")).length).toBe(labels.length);
    for (const label of [
      "Someone rebuilds one of your builds",
      "Someone reproduces one of your builds",
      "Someone comments on one of your builds",
      "Someone likes one of your builds",
      "Someone replies to your topic or reply",
      "Someone mentions you",
      "Someone likes your topic or reply",
      "Your entry is pinned",
      "Someone starts a topic from your build",
      "Someone follows you",
      "Something you saved changes",
    ]) {
      expect(screen.getByRole("switch", { name: label }), label).toBeTruthy();
    }
  });

  it("has no row for a retired kind, and ends with where notifications go", () => {
    render(<NotificationsView prefs={parsePreferences({})} onToggle={vi.fn()} />);
    expect(screen.queryByText(/solution|solved|bounty/i)).toBeNull();
    expect(NOTIFICATIONS_NOTE).toBe("Notifications appear on your Notifications page. No notification is sent by email.");
    expect(screen.getByText(NOTIFICATIONS_NOTE)).toBeTruthy();
  });

  it("asks for the new state of the one switch pressed", () => {
    const onToggle = vi.fn();
    render(<NotificationsView prefs={parsePreferences({})} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch", { name: "Your entry is pinned" }));
    expect(onToggle).toHaveBeenCalledWith("post_pinned", false);
  });
});

describe("the container", () => {
  it("shows a missing key as on and a stored false as off", async () => {
    db.prefs = { new_follower: true, content_approved: true, post_like: false };
    mount();
    const like = await screen.findByRole("switch", { name: "Someone likes your topic or reply" });
    expect(like.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Someone mentions you" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("switch").filter((s) => s.getAttribute("aria-checked") === "true")).toHaveLength(PREFERENCE_KEYS.length - 1);
  });

  it("writes the key of the switch pressed, once, and says Saved quietly", async () => {
    mount();
    fireEvent.click(await screen.findByRole("switch", { name: "Someone mentions you" }));
    await waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(1));
    expect(db.rpc).toHaveBeenCalledWith("set_notification_preference", { _key: "post_mention", _on: false });
    await waitFor(() => expect(toasts).toHaveBeenCalledWith(SAVED));
    expect(screen.getByRole("switch", { name: "Someone mentions you" }).getAttribute("aria-checked")).toBe("false");
  });

  it("writes every switch under its own key", async () => {
    mount();
    const rows = PREFERENCE_GROUPS.flatMap((g) => g.rows);
    for (const row of rows) fireEvent.click(await screen.findByRole("switch", { name: row.label }));
    await waitFor(() => expect(db.rpc).toHaveBeenCalledTimes(rows.length));
    expect(db.rpc.mock.calls.map((c) => (c[1] as { _key: string })._key).sort()).toEqual(rows.map((r) => r.key).sort());
  });

  it("puts the switch back and says so when the write is refused", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "no" } });
    mount();
    fireEvent.click(await screen.findByRole("switch", { name: "Someone follows you" }));
    await waitFor(() => expect(toasts).toHaveBeenCalledWith(NOT_SAVED));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Someone follows you" }).getAttribute("aria-checked")).toBe("true"));
  });

  it("keeps every switch inside its group", async () => {
    mount();
    const group = await screen.findByRole("region", { name: "Saved things" });
    expect(within(group).getAllByRole("switch")).toHaveLength(1);
  });
});
