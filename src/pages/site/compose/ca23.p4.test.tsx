// CA-23 P4: two tabs on one build. The composer is mounted for real on CA-20's draft (SandboxPage behind supabase-js, only the network
// faked); "the other tab" is a second BroadcastChannel for the same build, and what it changed is written to the fake database
// directly. What this tab does is what its panels do: a write through the data layer, which is all the page ever does.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.setConfig({ testTimeout: 40_000 });

import { requests, tableRows, type Row } from "@/lib/build/__audit__/fakeSupabase";
import { updateBuild } from "@/lib/build/builds";
import { patchMaking } from "@/lib/build/making";
import { pendingWrites } from "@/lib/build/pendingWrites";
import { writeNodeRows } from "@/lib/build/sessionEdit";
import { openBuildChannel, type TabMessage } from "@/lib/build/tabSync";
import { pendingKey } from "@/lib/build/writeGuard";
import type { BuildNode, BuildPatch } from "@/lib/build/types";

import { draftRow, harnessAfter, harnessBefore, DRAFT, mountCa20 } from "./ca20Harness";
import { IDS, KEY_B, seedCa20 } from "./ca20Fixture";

/** BroadcastChannel in miniature: every instance of a name hears the others. */
class Fake {
  static all = new Map<string, Set<Fake>>();
  private listeners = new Set<(event: MessageEvent) => void>();
  constructor(readonly name: string) {
    Fake.all.set(name, (Fake.all.get(name) ?? new Set()).add(this));
  }
  postMessage(data: unknown) {
    for (const other of Fake.all.get(this.name) ?? []) if (other !== this) for (const listener of other.listeners) listener({ data } as MessageEvent);
  }
  addEventListener(_: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  close() {
    Fake.all.get(this.name)?.delete(this);
  }
}

let otherTab: ReturnType<typeof openBuildChannel>;
const heard: TabMessage[] = [];

beforeEach(() => {
  harnessBefore();
  Fake.all.clear();
  heard.length = 0;
  vi.stubGlobal("BroadcastChannel", Fake);
  otherTab = openBuildChannel(DRAFT, (name) => new Fake(name) as unknown as BroadcastChannel, "tab-other");
  otherTab.subscribe((message) => heard.push(message));
});
afterEach(() => {
  otherTab.close();
  harnessAfter();
  pendingWrites.reset();
});

const mine = () => tableRows("build_nodes").find((row) => row.id === IDS.p2) as Row;
const build = () => draftRow() as Row;
const stamp = () => new Date(Date.now() + 5_000).toISOString();
const clash = () => screen.findByTestId("clash-window", undefined, { timeout: 10_000 });
const rowOf = (row: Row): BuildNode => ({ ...row }) as unknown as BuildNode;
const tell = (...rows: string[]) => act(() => void otherTab.announce(rows));

async function openRemoved() {
  fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
  fireEvent.click(await screen.findByTestId("build-options-removed"));
  return screen.findByTestId("recently-removed-window");
}

describe("hearing the other tab", () => {
  it("shows the strip 'Changed in another tab' with Show changes, and not before", async () => {
    await mountCa20(seedCa20);
    expect(screen.queryByTestId("other-tab-strip")).toBeNull();
    tell(IDS.p1);
    const strip = await screen.findByTestId("other-tab-strip");
    expect(within(strip).getByText("Changed in another tab")).toBeTruthy();
    expect(within(strip).getByRole("button", { name: "Show changes" })).toBeTruthy();
    expect(screen.queryByTestId("offline-strip")).toBeNull();
  });

  it("reads the build again on Show changes, shows what the other tab wrote, and the strip goes", async () => {
    await mountCa20(seedCa20);
    Object.assign(build(), { title: "Written in the other tab", updated_at: stamp() });
    tell(DRAFT);
    fireEvent.click(await screen.findByRole("button", { name: "Show changes" }));
    await waitFor(() => expect(screen.queryByTestId("other-tab-strip")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("sandbox-heading").textContent).toBe("Written in the other tab"), { timeout: 10_000 });
  });

  it("announces what this tab writes, with the ids of the rows it changed", async () => {
    await mountCa20(seedCa20);
    await updateBuild(DRAFT, { outcome: "Said in this tab" } as BuildPatch);
    await waitFor(() => expect(heard.some((message) => message.rows.includes(DRAFT))).toBe(true));
    await writeNodeRows([{ ...rowOf(mine()), payload: { text: "Typed here", session: "typed-ca20-a" } as BuildNode["payload"] }]);
    await waitFor(() => expect(heard.some((message) => message.rows.includes(IDS.p2))).toBe(true));
    expect(heard.every((message) => message.tab !== "tab-other" && message.buildId === DRAFT)).toBe(true);
  });
});

describe("a clash", () => {
  it("on a tile: names it, shows both versions with the time of each edit, and Keep this tab's writes this tab's", async () => {
    await mountCa20(seedCa20);
    const before = rowOf(mine());
    mine().payload = { ...(mine().payload as object), text: "The other tab's words" };
    tell(IDS.p2);
    await writeNodeRows([{ ...before, payload: { ...(before.payload as object), text: "This tab's words" } as BuildNode["payload"] }]);

    const window_ = await clash();
    expect(within(window_).getByText("Prompt 2 changed in another tab")).toBeTruthy();
    expect(within(window_).getByText("The version you don't keep goes to Recently removed.")).toBeTruthy();
    expect(window_.style.width).toBe("560px");
    const thisTab = within(window_).getByTestId("clash-mine");
    const otherTabPanel = within(window_).getByTestId("clash-theirs");
    expect(within(thisTab).getByText(/^This tab · \d\d:\d\d$/)).toBeTruthy();
    expect(within(otherTabPanel).getByText(/^Other tab · \d\d:\d\d$/)).toBeTruthy();
    expect(within(thisTab).getByText("This tab's words")).toBeTruthy();
    expect(within(otherTabPanel).getByText("The other tab's words")).toBeTruthy();
    expect(within(window_).getAllByRole("button").map((button) => button.textContent)).toEqual(["Use other tab's", "Keep this tab's"]);
    // Nothing of this tab's was written over the other tab's.
    expect(mine().payload).toMatchObject({ text: "The other tab's words" });

    fireEvent.click(within(window_).getByRole("button", { name: "Keep this tab's" }));
    await waitFor(() => expect(mine().payload).toMatchObject({ text: "This tab's words" }), { timeout: 10_000 });
    await waitFor(() => expect(screen.queryByTestId("clash-window")).toBeNull());

    // The version not kept is in Recently removed, with Restore.
    const list = await openRemoved();
    expect(within(list).getByText("Prompt 2 · other tab's version")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: "Restore Prompt 2 · other tab's version" }));
    await waitFor(() => expect(mine().payload).toMatchObject({ text: "The other tab's words" }), { timeout: 10_000 });
    await waitFor(() => expect(screen.queryAllByTestId("removed-row")).toHaveLength(0));
  });

  it("on a tile: Use other tab's keeps the other tab's, drops this tab's edit, and files this tab's version", async () => {
    await mountCa20(seedCa20);
    const before = rowOf(mine());
    mine().payload = { ...(mine().payload as object), text: "The other tab's words" };
    await writeNodeRows([{ ...before, payload: { ...(before.payload as object), text: "This tab's words" } as BuildNode["payload"] }]);
    const window_ = await clash();
    fireEvent.click(within(window_).getByRole("button", { name: "Use other tab's" }));
    await waitFor(() => expect(screen.queryByTestId("clash-window")).toBeNull());
    expect(mine().payload).toMatchObject({ text: "The other tab's words" });
    const list = await openRemoved();
    expect(within(list).getByText("Prompt 2 · this tab's version")).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: "Restore Prompt 2 · this tab's version" }));
    await waitFor(() => expect(mine().payload).toMatchObject({ text: "This tab's words" }), { timeout: 10_000 });
  });

  it("on a session's title", async () => {
    await mountCa20(seedCa20);
    const making = build().making as { sessions_meta: Record<string, Record<string, unknown>> };
    Object.assign(build(), { making: { ...making, sessions_meta: { ...making.sessions_meta, [KEY_B]: { ...making.sessions_meta[KEY_B], title: "Billing" } } }, updated_at: stamp() });
    tell(DRAFT);
    await patchMaking(DRAFT, { sessions_meta: { ...making.sessions_meta, [KEY_B]: { ...making.sessions_meta[KEY_B], title: "Support, renamed here" } } });
    const window_ = await clash();
    expect(within(window_).getByText("Session 2 changed in another tab")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-mine")).getByText("Support, renamed here")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-theirs")).getByText("Billing")).toBeTruthy();
    fireEvent.click(within(window_).getByRole("button", { name: "Keep this tab's" }));
    await waitFor(() => expect((build().making as { sessions_meta: Record<string, { title: string }> }).sessions_meta[KEY_B].title).toBe("Support, renamed here"), { timeout: 10_000 });
    const list = await openRemoved();
    expect(within(list).getByText("Session 2 · other tab's version")).toBeTruthy();
  });

  it("on the post", async () => {
    await mountCa20(seedCa20);
    const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    Object.assign(build(), { post_doc: doc("The other tab's post"), updated_at: stamp() });
    await updateBuild(DRAFT, { post_doc: doc("This tab's post") } as unknown as BuildPatch);
    const window_ = await clash();
    expect(within(window_).getByText("Post changed in another tab")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-mine")).getByText("This tab's post")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-theirs")).getByText("The other tab's post")).toBeTruthy();
    fireEvent.click(within(window_).getByRole("button", { name: "Use other tab's" }));
    await waitFor(() => expect(screen.queryByTestId("clash-window")).toBeNull());
    expect(build().post_doc).toEqual(doc("The other tab's post"));
    const list = await openRemoved();
    expect(within(list).getByText("Post · this tab's version")).toBeTruthy();
  });

  it("with several at once, opens them one at a time in build order: the post, then Prompt 2 (in Session 1), then Session 2", async () => {
    await mountCa20(seedCa20);
    const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
    const before = rowOf(mine());
    const making = build().making as { sessions_meta: Record<string, Record<string, unknown>> };
    mine().payload = { ...(mine().payload as object), text: "Theirs tile" };
    Object.assign(build(), { post_doc: doc("Theirs post"), making: { ...making, sessions_meta: { ...making.sessions_meta, [KEY_B]: { ...making.sessions_meta[KEY_B], title: "Theirs session" } } }, updated_at: stamp() });
    // This tab's three writes go in the opposite order to the build's.
    await writeNodeRows([{ ...before, payload: { ...(before.payload as object), text: "Mine tile" } as BuildNode["payload"] }]);
    await patchMaking(DRAFT, { sessions_meta: { ...making.sessions_meta, [KEY_B]: { ...making.sessions_meta[KEY_B], title: "Mine session" } } });
    await updateBuild(DRAFT, { post_doc: doc("Mine post") } as unknown as BuildPatch);

    const titles: string[] = [];
    for (let n = 0; n < 3; n += 1) {
      const window_ = await clash();
      const title = within(window_).getByText(/ changed in another tab$/).textContent as string;
      titles.push(title);
      fireEvent.click(within(window_).getByRole("button", { name: "Use other tab's" }));
      await waitFor(() => expect(screen.queryByTestId("clash-window") === null || within(screen.getByTestId("clash-window")).queryByText(title) === null).toBe(true), { timeout: 10_000 });
    }
    expect(titles).toEqual(["Post changed in another tab", "Prompt 2 changed in another tab", "Session 2 changed in another tab"]);
    await waitFor(() => expect(screen.queryByTestId("clash-window")).toBeNull());
  });
});

describe("a queued write that conflicts on replay", () => {
  it("is not forced over the other tab's change: it goes through the clash window", async () => {
    // A write kept across a reload, made when the title was "CA-20 draft"; meanwhile another tab retitled the build.
    window.localStorage.setItem(
      pendingKey(DRAFT),
      JSON.stringify([
        {
          id: "kept-1",
          at: 1,
          method: "PATCH",
          url: `https://ca08audit.supabase.co/rest/v1/builds?id=eq.${DRAFT}&updated_at=eq.2026-10-20T10%3A00%3A00.000Z&select=id`,
          headers: [["content-type", "application/json"], ["prefer", "return=representation"], ["accept", "application/vnd.pgrst.object+json"]],
          body: JSON.stringify({ title: "Queued title" }),
          base: { title: "CA-20 draft" },
        },
      ]),
    );
    await mountCa20((rows) => {
      seedCa20(rows);
      Object.assign(rows.builds.find((row) => row.id === DRAFT) as Row, { title: "Their title", updated_at: new Date().toISOString() });
    });
    const window_ = await clash();
    expect(within(window_).getByText("Title changed in another tab")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-mine")).getByText("Queued title")).toBeTruthy();
    expect(within(within(window_).getByTestId("clash-theirs")).getByText("Their title")).toBeTruthy();
    // Nothing was forced over theirs, and nothing is left queued.
    expect(build().title).toBe("Their title");
    expect(window.localStorage.getItem(pendingKey(DRAFT))).toBeNull();
    fireEvent.click(within(window_).getByRole("button", { name: "Keep this tab's" }));
    await waitFor(() => expect(build().title).toBe("Queued title"), { timeout: 10_000 });
  });
});

describe("a stale write", () => {
  it("is refused by the database: it changes no rows", async () => {
    await mountCa20(seedCa20);
    Object.assign(build(), { title: "Theirs", updated_at: stamp() });
    await updateBuild(DRAFT, { title: "Mine" } as BuildPatch);
    expect(build().title).toBe("Theirs");
    expect(requests().some((request) => request.method === "PATCH" && request.path.includes("updated_at=eq.") && request.status === 406)).toBe(true);
    const window_ = await clash();
    expect(within(window_).getByText("Title changed in another tab")).toBeTruthy();
  });
});
