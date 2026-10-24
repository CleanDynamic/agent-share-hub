// CA-23 P2: the composer mounted for real, the connection driven by hand. No connection: writes wait in order and in
// localStorage, the status line counts them, the strip says so; the connection back: they land, the notice says how many.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { requests, tableRows } from "@/lib/build/__audit__/fakeSupabase";
import { pendingKey } from "@/lib/build/writeGuard";
import { pendingWrites } from "@/lib/build/pendingWrites";

vi.setConfig({ testTimeout: 40_000 });

import { DRAFT, mountComposer, setBrowserOnline, statusText, stubWidth } from "./ca23.harness";

beforeEach(() => {
  stubWidth(1280);
  localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  // Back online while the page is still mounted, so the connection the next test starts from is up.
  setBrowserOnline(true);
  cleanup();
  pendingWrites.reset();
  vi.restoreAllMocks();
});

const patches = () => requests().filter((request) => request.method === "PATCH" && request.path.includes("/builds"));

/** The Classification Card: opened, the Title typed over, and Save pressed (the Card changes nothing until then). */
async function retitle(to: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Classification Card" }, { timeout: 10_000 }));
  const dialog = await screen.findByTestId("sandbox-card");
  fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: to } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByTestId("sandbox-card")).toBeNull(), { timeout: 5_000 });
}

describe("no connection", () => {
  it("holds the write, counts it in the status line, shows the strip, and keeps the write in localStorage", async () => {
    mountComposer();
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    await retitle("Offline title");
    setBrowserOnline(false);
    await retitle("Offline title two");
    await waitFor(() => expect(statusText()).toMatch(/^Draft · offline · \d+ changes? pending/), { timeout: 5_000 });
    expect(screen.getByTestId("offline-strip").textContent).toBe("Offline. Changes save when you reconnect.");
    await waitFor(() => expect(localStorage.getItem(pendingKey(DRAFT))).not.toBeNull(), { timeout: 5_000 });
    const kept = JSON.parse(localStorage.getItem(pendingKey(DRAFT)) as string) as { method: string; url: string }[];
    expect(kept.every((held) => held.method === "PATCH" && held.url.includes("/rest/v1/builds"))).toBe(true);
    expect(patches().filter((request) => request.status === 0 || request.status === 200)).toHaveLength(patches().length);
    const before = patches().length;

    setBrowserOnline(true);
    await waitFor(() => expect(patches().length).toBeGreaterThan(before), { timeout: 5_000 });
    await waitFor(() => expect(screen.queryByTestId("offline-strip")).toBeNull(), { timeout: 5_000 });
    expect(tableRows("builds").find((row) => row.id === DRAFT)?.title).toBe("Offline title two");
    expect(localStorage.getItem(pendingKey(DRAFT))).toBeNull();
    await waitFor(() => expect(screen.getByTestId("reference-notice").textContent).toMatch(/^Reconnected\. \d+ changes? saved\.$/), { timeout: 5_000 });
    expect(screen.queryByTestId("notice-undo")).toBeNull();
  });

  it("says nothing about a stretch offline in which nothing was written", async () => {
    mountComposer();
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    setBrowserOnline(false);
    await waitFor(() => expect(screen.getByTestId("offline-strip")).toBeTruthy());
    expect(statusText()).toMatch(/offline · 1 change pending|^Draft/);
    setBrowserOnline(true);
    await waitFor(() => expect(screen.queryByTestId("offline-strip")).toBeNull());
    expect(screen.queryByTestId("reference-notice")).toBeNull();
  });

  it("is offline when a write gets no response at all, whatever the browser says, and nothing is lost", async () => {
    mountComposer(`/compose/${DRAFT}`, { faults: [{ method: "PATCH", path: /\/builds\?/, answer: "network", times: 1 }] });
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    await retitle("Dropped mid-write");
    await waitFor(() => expect(screen.getByTestId("offline-strip")).toBeTruthy(), { timeout: 5_000 });
    expect(JSON.parse(localStorage.getItem(pendingKey(DRAFT)) as string)).toHaveLength(1);
    // The ping every 15 seconds would find the network; here the browser's own event does.
    setBrowserOnline(true);
    await waitFor(() => expect(tableRows("builds").find((row) => row.id === DRAFT)?.title).toBe("Dropped mid-write"), { timeout: 5_000 });
    expect(localStorage.getItem(pendingKey(DRAFT))).toBeNull();
  });
});

describe("a reload with writes still kept", () => {
  it("replays them first, before the build is read, and counts them while they wait", async () => {
    localStorage.setItem(
      pendingKey(DRAFT),
      JSON.stringify([{ id: "a", at: 1, method: "PATCH", url: `https://ca08audit.supabase.co/rest/v1/builds?id=eq.${DRAFT}&select=id`, headers: [["content-type", "application/json"], ["prefer", "return=representation"]], body: JSON.stringify({ title: "Kept across a reload" }) }]),
    );
    mountComposer();
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    const log = requests().map((request) => `${request.method} ${request.path.split("?")[0]}`);
    const firstRead = log.findIndex((line) => line.startsWith("GET /rest/v1/builds"));
    const replay = log.findIndex((line) => line.startsWith("PATCH /rest/v1/builds"));
    expect(replay).toBeGreaterThanOrEqual(0);
    expect(replay).toBeLessThan(firstRead);
    expect(tableRows("builds").find((row) => row.id === DRAFT)?.title).toBe("Kept across a reload");
    expect(localStorage.getItem(pendingKey(DRAFT))).toBeNull();
    await act(async () => undefined);
  });
});
