// SV-07 P0: the screen recording, replayed on the real page (SandboxPage behind supabase-js, only the network faked). Writes are
// slow (100 to 800 ms) and come back out of order, and refetches of the build can answer with data older than the page holds. The
// List is sampled on every animation frame, and each sample is checked against the recording's faults: a key drawn twice, the
// empty Session 1 drawn beside another session, a layout that comes back with no maker action (A, B, A), and a session whose part
// or number changes with no maker action.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { workstreamKeyOf } from "@/lib/build/workstreams";

import { addChatTo, CHATS, draft, faultsIn, maker, making, mount, partKeys, pickChat, printLayouts, samples, settled, setUp, startSampling, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 240_000 });

beforeEach(setUp);
afterEach(tearDown);

describe("SV-07 P0 · the recorded sequence", () => {
  it("is steady: no key twice, no placeholder beside a session, no A-B-A, nothing moved or renumbered unasked", async () => {
    mount();
    startSampling();
    // 1, 2: a new draft, and a one-prompt chat imported from the empty build panel.
    maker("open the chats", () => fireEvent.click(screen.getByTestId("empty-build-chats")));
    await pickChat(CHATS[0].name);
    await settled(1);
    await waitFor(() => expect(draft()).toBeTruthy(), { timeout: 30_000 });

    // 3: Add a part, twice.
    maker("Add a part", () => fireEvent.click(screen.getByTestId("add-part-row")));
    await waitFor(() => expect(partKeys()).toHaveLength(2), { timeout: 30_000 });
    // The row is disabled while the part is written (SV-07 P3): the maker presses it again once it can be pressed.
    await waitFor(() => expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 30_000 });
    maker("Add a part", () => fireEvent.click(screen.getByTestId("add-part-row")));
    await waitFor(() => expect(partKeys()).toHaveLength(3), { timeout: 30_000 });

    // 4: Add a session › Start a new session (it goes to the last part).
    maker("open Add a session", () => fireEvent.click(screen.getByTestId("add-session-row")));
    maker("Start a new session", () => fireEvent.click(screen.getByRole("button", { name: /Start a new session/ })));
    await settled(2);

    // 5: a library chat into Part 2.
    await addChatTo("Part 2", CHATS[1].name);
    await settled(3);

    // 6: Part 2 closed, and another chat added to it.
    maker("Collapse Part 2", () => fireEvent.click(screen.getByRole("button", { name: "Collapse Part 2" })));
    await addChatTo("Part 2", CHATS[2].name);
    await settled(4);

    // 7: a chat into Part 3, and another straight after.
    await addChatTo("Part 3", CHATS[3].name);
    // Straight after: as soon as the row can be used again, while the first one's saves may still be going.
    await waitFor(() => expect((screen.getByTestId("add-session-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 30_000 });
    await addChatTo("Part 3", CHATS[4].name);
    await settled(6);

    // 8: the session list on, and a jump to a session in the closed Part 2.
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Session list/ }));
    const chips = await screen.findAllByRole("button", { name: /^\d+ / });
    maker("jump to Session 2", () => fireEvent.click(chips[1]));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    printLayouts();
    expect(faultsIn(samples)).toEqual([]);
    // Every session is saved in the part it was added to: Part 1 holds the import, Part 2 two chats, Part 3 the new session and two chats.
    const [first, second, third] = partKeys();
    // A session with no part of its own is in the first part.
    const inPart = (part: string) => ((making() as { session_order?: string[] }).session_order ?? []).filter((key) => workstreamKeyOf(sessionsMetaOf(making())[key], storedWorkstreamsOf(making())) === part).length;
    expect([inPart(first), inPart(second), inPart(third)]).toEqual([1, 2, 3]);
  });
});
