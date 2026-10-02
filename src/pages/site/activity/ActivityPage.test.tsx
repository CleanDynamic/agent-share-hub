// UI-P35 — Activity's container: what loads and when, what following a row and "Mark all read"
// write, what a live arrival reads again, and what it draws while the data is not there.
//
// The data layer is stubbed and its calls are counted, as the Profile's test does.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "viewer-1" } as { id: string } | null }));
const channel = vi.hoisted(() => ({
  status: "live" as "connecting" | "live" | "offline",
  arrive: null as null | ((row: { notification_type: string }) => void),
  userId: undefined as unknown,
}));

const getNotifications = vi.fn();
const getUnreadCount = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const resolveNotificationCovers = vi.fn();
const countPeople = vi.fn();
const getRuns = vi.fn();
const refreshUnread = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) } },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: Boolean(auth.user), loading: false }),
}));
vi.mock("@/hooks/useUnreadNotifications", () => ({ refreshUnreadNotifications: (...args: unknown[]) => refreshUnread(...args) }));
vi.mock("@/lib/build/runs", () => ({
  countPeopleWhoRanMyBuildsThisWeek: (...args: unknown[]) => countPeople(...args),
  getRunsOfMyBuilds: (...args: unknown[]) => getRuns(...args),
}));
vi.mock("@/lib/notifications/covers", () => ({ resolveNotificationCovers: (...args: unknown[]) => resolveNotificationCovers(...args) }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  getNotifications: (...args: unknown[]) => getNotifications(...args),
  getUnreadCount: (...args: unknown[]) => getUnreadCount(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args),
  useNotificationChannel: (userId: unknown, onArrive: (row: { notification_type: string }) => void) => {
    channel.userId = userId;
    channel.arrive = onArrive;
    return channel.status;
  },
}));

import type { Notification } from "@/lib/notifications";

import { ActivityPage } from "./ActivityPage";

function notification(n: number, over: Partial<Notification> = {}): Notification {
  return {
    id: `n-${n}`,
    recipient_id: "viewer-1",
    actor_id: "actor-1",
    notification_type: "reproduced",
    kind: "reproduced",
    body: "ran your build and it worked",
    target_type: "build",
    target_id: "build-1",
    metadata: { build_id: "build-1" },
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - (n + 1) * 60_000).toISOString(),
    actor: { id: "actor-1", username: "ada", display_name: "Ada Lovelace", avatar_url: null },
    target: null,
    build: { id: "build-1", slug: "invoice-triage-agent", title: "Invoice triage agent" },
    ...over,
  };
}

const page = (from: number, count: number) => ({
  notifications: Array.from({ length: count }, (_, i) => notification(from + i)),
  total: from + count,
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.hash}`}</div>;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/notifications"]}>
          <LocationProbe />
          <Routes>
            <Route path="*" element={<ActivityPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const rows = () => screen.getAllByTestId("activity-row");
const unreadRows = () => screen.queryAllByTestId("activity-row").filter((item) => item.getAttribute("data-unread") === "true");

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "viewer-1" };
  channel.status = "live";
  channel.arrive = null;
  channel.userId = undefined;
  getNotifications.mockResolvedValue({ notifications: [notification(1), notification(2, { is_read: true })], total: 2 });
  getUnreadCount.mockResolvedValue(1);
  markNotificationRead.mockResolvedValue(undefined);
  markAllNotificationsRead.mockResolvedValue(undefined);
  resolveNotificationCovers.mockResolvedValue(new Map([["build-1", null]]));
  countPeople.mockResolvedValue(4);
  getRuns.mockResolvedValue({ series: Array.from({ length: 90 }, (_, i) => i % 5), rebuildLiveIndex: 40 });
});

describe("ActivityPage loading", () => {
  it("loads the list, the count, the people and the runs through the data layer, and draws them", async () => {
    mount();
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(2);
    expect(await screen.findByText("1 unread · live")).toBeTruthy();
    expect(await screen.findByText("4")).toBeTruthy();
    expect(await screen.findByRole("img", { name: /runs of your builds in the last 90 days/ })).toBeTruthy();

    expect(getNotifications).toHaveBeenCalledWith({ userId: "viewer-1", limit: 50, offset: 0 });
    expect(getUnreadCount).toHaveBeenCalledWith("viewer-1");
    expect(countPeople).toHaveBeenCalledWith("viewer-1");
    expect(getRuns).toHaveBeenCalledWith("viewer-1", 90);
    expect(channel.userId).toBe("viewer-1");
  });

  it("reads the covers of every build in the list in one request, each build once", async () => {
    getNotifications.mockResolvedValue({
      notifications: [
        notification(1),
        notification(2, { build: { id: "build-2", slug: "second", title: "Second" }, metadata: { build_id: "build-2" } }),
        notification(3),
      ],
      total: 3,
    });
    mount();
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(3);
    await waitFor(() => expect(resolveNotificationCovers).toHaveBeenCalledTimes(1));
    expect(resolveNotificationCovers).toHaveBeenCalledWith(["build-1", "build-2"]);
  });

  it("does not hold the list back for a slow chart, and draws a refused count as nothing", async () => {
    getRuns.mockReturnValue(new Promise(() => undefined));
    getUnreadCount.mockRejectedValue(new Error("refused"));
    mount();
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(2);
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalled());
    expect(screen.queryByText(/unread/)).toBeNull();
    expect(screen.queryByRole("img", { name: /runs of your builds/ })).toBeNull();
  });

  it("asks for the next fifty when a page is full, and stops when one is not", async () => {
    getNotifications.mockResolvedValueOnce(page(0, 50)).mockResolvedValueOnce(page(50, 1));
    mount();
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.getAllByTestId("activity-row")).toHaveLength(51));
    expect(getNotifications).toHaveBeenNthCalledWith(2, { userId: "viewer-1", limit: 50, offset: 50 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("says it could not load the list, and tries again", async () => {
    getNotifications.mockRejectedValueOnce(new Error("down"));
    mount();
    expect(await screen.findByText("This could not be loaded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(2);
    expect(getNotifications).toHaveBeenCalledTimes(2);
  });

  it("draws the empty state, reads no covers, and leads to the gallery", async () => {
    getNotifications.mockResolvedValue({ notifications: [], total: 0 });
    getUnreadCount.mockResolvedValue(0);
    mount();
    expect(await screen.findByTestId("activity-empty")).toBeTruthy();
    expect(resolveNotificationCovers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enter the gallery" }));
    expect(screen.getByTestId("location").textContent).toBe("/gallery");
  });

  it("asks for nothing without a signed-in viewer", () => {
    auth.user = null;
    mount();
    expect(getNotifications).not.toHaveBeenCalled();
    expect(getUnreadCount).not.toHaveBeenCalled();
    expect(countPeople).not.toHaveBeenCalled();
    expect(getRuns).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Loading your activity")).toBeTruthy();
  });
});

describe("ActivityPage reading", () => {
  it("reads a row at once when it is followed, writes after, and tells the bell and the dock", async () => {
    const write = deferred();
    markNotificationRead.mockReturnValue(write.promise);
    mount();
    expect(await screen.findByText("1 unread · live")).toBeTruthy();
    const [first, second] = rows();
    expect(first.getAttribute("data-unread")).toBe("true");

    fireEvent.click(first);
    expect(screen.getByTestId("location").textContent).toBe("/b2/invoice-triage-agent");
    expect(markNotificationRead).toHaveBeenCalledTimes(1);
    expect(markNotificationRead).toHaveBeenCalledWith("n-1");
    await waitFor(() => expect(unreadRows()).toHaveLength(0));
    expect(screen.getByText("0 unread · live")).toBeTruthy();
    expect(refreshUnread).not.toHaveBeenCalled();

    await act(async () => write.resolve());
    await waitFor(() => expect(refreshUnread).toHaveBeenCalledTimes(1));

    fireEvent.click(second);
    expect(markNotificationRead).toHaveBeenCalledTimes(1);
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it("marks every row read at once with Mark all read, writes after, and tells the bell and the dock", async () => {
    const write = deferred();
    markAllNotificationsRead.mockReturnValue(write.promise);
    getNotifications.mockResolvedValue({ notifications: [notification(1), notification(2), notification(3)], total: 3 });
    getUnreadCount.mockResolvedValue(3);
    mount();
    expect(await screen.findByText("3 unread · live")).toBeTruthy();
    expect(unreadRows()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(markAllNotificationsRead).toHaveBeenCalledWith("viewer-1");
    await waitFor(() => expect(unreadRows()).toHaveLength(0));
    expect(screen.getByText("0 unread · live")).toBeTruthy();
    expect(refreshUnread).not.toHaveBeenCalled();

    await act(async () => write.resolve());
    await waitFor(() => expect(refreshUnread).toHaveBeenCalledTimes(1));
    expect(getNotifications).toHaveBeenCalledTimes(1);
  });

  it("reads everything again from the server when a write fails", async () => {
    markNotificationRead.mockRejectedValue(new Error("refused"));
    mount();
    expect(await screen.findByText("1 unread · live")).toBeTruthy();

    fireEvent.click(rows()[0]);
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refreshUnread).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(unreadRows()).toHaveLength(1));
    expect(screen.getByText("1 unread · live")).toBeTruthy();
  });
});

describe("ActivityPage live", () => {
  it("reads the list and the count again when a notification arrives, and the orb and the chart too for a run", async () => {
    mount();
    expect(await screen.findAllByTestId("activity-row")).toHaveLength(2);
    await waitFor(() => expect(getRuns).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(countPeople).toHaveBeenCalledTimes(1));
    expect(typeof channel.arrive).toBe("function");

    act(() => channel.arrive?.({ notification_type: "like" }));
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2));
    expect(countPeople).toHaveBeenCalledTimes(1);
    expect(getRuns).toHaveBeenCalledTimes(1);

    act(() => channel.arrive?.({ notification_type: "reproduced" }));
    await waitFor(() => expect(countPeople).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getRuns).toHaveBeenCalledTimes(2));
    expect(getNotifications).toHaveBeenCalledTimes(3);
  });

  it("says live and Listening only while the channel is up", async () => {
    for (const status of ["connecting", "offline"] as const) {
      channel.status = status;
      const { unmount } = mount();
      expect(await screen.findByText("1 unread")).toBeTruthy();
      expect(screen.queryByText("1 unread · live")).toBeNull();
      expect(screen.getByText("Reconnecting")).toBeTruthy();
      expect(screen.getByText("offline")).toBeTruthy();
      unmount();
    }
    channel.status = "live";
    mount();
    expect(await screen.findByText("1 unread · live")).toBeTruthy();
    expect(screen.getByText("Listening")).toBeTruthy();
  });
});
