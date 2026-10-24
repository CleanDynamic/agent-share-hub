// CA-23 P3: on the composer itself. Changes waiting for a connection: a link asks, the tab's own warning is on; once they land both are off.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Link } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.setConfig({ testTimeout: 40_000 });

import { tableRows } from "@/lib/build/__audit__/fakeSupabase";
import { pendingWrites } from "@/lib/build/pendingWrites";

import { DRAFT, mountComposer, setBrowserOnline, stubWidth } from "./ca23.harness";

beforeEach(() => {
  stubWidth(1280);
  localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  setBrowserOnline(true);
  cleanup();
  pendingWrites.reset();
  vi.restoreAllMocks();
});

async function retitle(to: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Classification Card" }, { timeout: 10_000 }));
  const dialog = await screen.findByTestId("sandbox-card");
  fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: to } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByTestId("sandbox-card")).toBeNull(), { timeout: 5_000 });
}

const unload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("the composer", () => {
  it("asks before a link leaves while a change waits for the connection, and the tab warns too; both stop once it has landed", async () => {
    mountComposer(`/compose/${DRAFT}`, { extra: <Link to="/elsewhere">Away</Link> });
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    expect(unload()).toBe(false);

    setBrowserOnline(false);
    await retitle("Kept");
    await waitFor(() => expect(unload()).toBe(true), { timeout: 5_000 });

    fireEvent.click(screen.getByRole("link", { name: "Away" }));
    const asked = await screen.findByTestId("leave-window");
    expect(within(asked).getByText(/changes? (haven't|hasn't) saved\. Leaving may lose (them|it)\./)).toBeTruthy();
    expect(screen.queryByTestId("elsewhere")).toBeNull();
    fireEvent.click(screen.getByTestId("leave-stay"));
    expect(screen.queryByTestId("leave-window")).toBeNull();
    expect(screen.getByTestId("sandbox-status")).toBeTruthy();

    // Back online: the writes land, and the question and the warning are gone.
    setBrowserOnline(true);
    await waitFor(() => expect(tableRows("builds").find((row) => row.id === DRAFT)?.title).toBe("Kept"), { timeout: 5_000 });
    await waitFor(() => expect(unload()).toBe(false), { timeout: 5_000 });
    fireEvent.click(screen.getByRole("link", { name: "Away" }));
    expect(await screen.findByTestId("elsewhere")).toBeTruthy();
  });

  it("goes, when Leave is chosen", async () => {
    mountComposer(`/compose/${DRAFT}`, { extra: <Link to="/elsewhere">Away</Link> });
    await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
    setBrowserOnline(false);
    await retitle("Lost on purpose");
    await waitFor(() => expect(unload()).toBe(true), { timeout: 5_000 });
    fireEvent.click(screen.getByRole("link", { name: "Away" }));
    fireEvent.click(await screen.findByTestId("leave-leave"));
    expect(await screen.findByTestId("elsewhere")).toBeTruthy();
  });
});
