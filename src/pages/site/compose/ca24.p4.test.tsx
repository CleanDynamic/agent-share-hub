// CA-24 P4 - a slow import on the real page: past a second the new session says Importing and fills its empty sockets with
// building blocks; a quick one shows nothing extra; when it finishes the tag and the blocks go. The import writes a session in
// one go, so there is no bar, no count and no Stop.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { DRAFT, field, harnessAfter, harnessBefore, mount, openRow } from "./ca20Harness";

vi.setConfig({ testTimeout: 40_000 });

beforeEach(harnessBefore);
afterEach(harnessAfter);

const line = () => screen.getByTestId("sessions-said").textContent;
const finished = () => waitFor(() => expect(line()).toMatch(/^Added Session/), { timeout: 20_000 });

async function addOnePromptSession(delayMs: number) {
  mount(`/compose/${DRAFT}`, { delays: delayMs > 0 ? [{ method: "POST", path: /^\/rest\/v1\/build_nodes/, delayMs }] : [] });
  await field();
  fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
}

describe("CA-24 P4 · a slow import", () => {
  it("says Importing after the app name and fills the empty socket with building blocks once it has taken a second", async () => {
    await addOnePromptSession(2500);
    const block = await screen.findByTestId("arriving-session", undefined, { timeout: 10_000 });
    expect(within(block).queryByTestId("importing-tag")).toBeNull();
    const tag = await within(block).findByTestId("importing-tag", undefined, { timeout: 5_000 });
    expect(tag.textContent).toBe("Importing");
    // After the app name in the session head.
    const head = within(block).getByTestId("arriving-head");
    expect(head.contains(tag)).toBe(true);
    expect(head.textContent).toMatch(/Claude.*Importing/);
    const places = within(block).getAllByTestId("arriving-place");
    expect(places).toHaveLength(1);
    // SV-05 P4: the blocks fill the socket's whole inner area.
    expect(within(places[0]).getByTestId("loading-blocks").style.height).toBe("100%");
    // SV-05 P4: the count follows the tiles as they are written; a session is never half-added, so there is no Stop.
    expect(within(block).getByTestId("import-progress").textContent).toMatch(/0 of 1 prompt/);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    await finished();
  });

  it("takes the tag and the blocks away when the session is in", async () => {
    await addOnePromptSession(2500);
    await within(await screen.findByTestId("arriving-session", undefined, { timeout: 10_000 })).findByTestId("importing-tag", undefined, { timeout: 5_000 });
    await finished();
    expect(screen.queryByTestId("importing-tag")).toBeNull();
    expect(screen.queryByTestId("socket-blocks")).toBeNull();
    expect(screen.queryByTestId("arriving-session")).toBeNull();
  });

  it("shows nothing extra for an import that takes under a second", async () => {
    await addOnePromptSession(0);
    await finished();
    expect(screen.queryByTestId("importing-tag")).toBeNull();
    expect(screen.queryByTestId("socket-blocks")).toBeNull();
  });
});
