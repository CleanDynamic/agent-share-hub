// SV-07 P5: what the page says. No status line is drawn under the List (the announcer speaks each step); the notice is the one
// thing seen, always in one place, and the page keeps room for it at its foot. On the real page. (The first import on a new post
// shows no notice: the page moves from /compose/new to the draft's address and its history starts there, as before SV-07.)

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { NOTICE_BOTTOM, NOTICE_ROOM } from "./referencePieces";
import { addChatTo, CHATS, mount, partKeys, pickChat, settled, setUp, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 120_000 });

beforeEach(setUp);
afterEach(tearDown);

/** Text a sighted maker can see in the List: what is not hidden from view. */
function seenText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let out = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[aria-hidden="true"]') || parent.closest('[style*="clip"]')) continue;
    out += `${node.textContent} `;
  }
  return out;
}

/** Where the notice stands, as its style says: the same for every action. */
const place = () => {
  const notice = screen.getByTestId("reference-notice");
  const { position, left, right, bottom, marginInline, transform } = notice.style;
  return { parent: notice.parentElement === document.body, position, left, right, bottom, marginInline, transform };
};

describe("SV-07 P5 · one notice, no stray text", () => {
  it("prints no status line in the List, speaks each step, and shows the notice in one place for every action", async () => {
    const announced: string[] = [];
    /** Each notice as it showed: its words, where it stood, and the room the Build column kept for it. */
    const notices = new Map<string, { place: ReturnType<typeof place>; room: string | undefined }>();
    const observer = new MutationObserver(() => {
      const text = screen.queryByTestId("build-announcer")?.textContent;
      if (text) announced.push(text);
      const notice = screen.queryByTestId("reference-notice");
      const words = notice?.textContent ?? "";
      if (notice && !notices.has(words)) {
        const column = screen.queryByTestId("build-list")?.parentElement?.closest<HTMLElement>('[style*="padding-bottom"]');
        notices.set(words, { place: place(), room: column?.style.paddingBottom });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    mount([]);
    fireEvent.click(screen.getByTestId("empty-build-chats"));
    await pickChat(CHATS[0].name);
    const list = await screen.findByTestId("build-list");
    // While it is on its way: no "Adding …" anywhere a maker can see.
    expect(seenText(list)).not.toMatch(/Adding|Added/);
    await settled(1);
    await waitFor(() => expect(announced.some((text) => /^Added Session 1/.test(text))).toBe(true), { timeout: 15_000 });
    expect(seenText(screen.getByTestId("build-list"))).not.toMatch(/Adding|Added Session|Added a part/);

    act(() => fireEvent.click(screen.getByTestId("add-part-row")));
    await waitFor(() => expect(partKeys()).toHaveLength(2), { timeout: 15_000 });
    await waitFor(() => expect([...notices.keys()].some((words) => /Added a part/.test(words))).toBe(true), { timeout: 15_000 });
    expect(seenText(screen.getByTestId("build-list"))).not.toMatch(/Added a part/);
    await waitFor(() => expect(announced.some((text) => /Added a part/.test(text))).toBe(true), { timeout: 15_000 });

    // A second chat, into Part 2: its notice stands where Add a part's did.
    await waitFor(() => expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
    await addChatTo("Part 2", CHATS[1].name);
    await settled(2);
    await waitFor(() => expect([...notices.keys()].some((words) => /Added Session 2/.test(words))).toBe(true), { timeout: 15_000 });
    expect(seenText(screen.getByTestId("build-list"))).not.toMatch(/Adding|Added Session/);
    observer.disconnect();

    const shown = [...notices.values()];
    expect(shown.length).toBeGreaterThanOrEqual(2);
    for (const notice of shown) {
      expect(notice.place).toEqual({ parent: true, position: "fixed", left: "0px", right: "0px", bottom: `${NOTICE_BOTTOM}px`, marginInline: "auto", transform: "" });
      // The page keeps room for it at its foot, so it never covers the last row.
      expect(notice.room).toBe(`${NOTICE_ROOM}px`);
    }
  });
});
