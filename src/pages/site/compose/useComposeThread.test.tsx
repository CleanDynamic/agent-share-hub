// PT-05 — the thread's save: the composer's debounce, the hold, the first write, the cover.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAVE_DEBOUNCE_MS } from "@/hooks/useComposeBuild";
import type { ThreadBlock, ThreadDoc } from "@/lib/build/thread";
import type { Build } from "@/lib/build/types";

const { saveThread, getThreadMedia, syncThreadCover } = vi.hoisted(() => ({
  saveThread: vi.fn(),
  getThreadMedia: vi.fn(),
  syncThreadCover: vi.fn(),
}));

vi.mock("@/lib/build/thread", async (original) => ({ ...(await original<typeof import("@/lib/build/thread")>()), saveThread, getThreadMedia }));
vi.mock("@/lib/build/composeCover", () => ({ syncThreadCover }));

import { useComposeThread, type UseComposeThreadInput } from "./useComposeThread";

const p = (text: string): ThreadBlock => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const picture = (id: string): ThreadBlock => ({ type: "postMedia", attrs: { mediaId: id, width: 100, w: null, h: null, alt: "", caption: "" } });
const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const build = (over: Record<string, unknown> = {}) => ({ id: "b1", outcome: null, post_doc: null, ...over }) as unknown as Build;

function mount(input: Partial<UseComposeThreadInput> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const ensureBuild = vi.fn(async () => "b1");
  const hook = renderHook((props: UseComposeThreadInput) => useComposeThread(props), {
    wrapper,
    initialProps: { build: null, buildId: undefined, isOwner: false, ensureBuild, ...input } as UseComposeThreadInput,
  });
  return { ...hook, ensureBuild, client };
}

const quiet = () => act(async () => void (await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 10)));

beforeEach(() => {
  vi.useFakeTimers();
  saveThread.mockReset().mockResolvedValue({});
  getThreadMedia.mockReset().mockResolvedValue([]);
  syncThreadCover.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("opening", () => {
  it("opens on an empty thread at once when there is no build yet", () => {
    const { result } = mount();
    expect(result.current.status).toBe("ready");
    expect(result.current.posts).toBe(0);
    expect(result.current.readDoc()).toEqual(doc({ type: "paragraph" }));
    expect(result.current.save).toBe("idle");
  });

  it("opens on the build's post_doc", () => {
    const stored = doc(p("first"), { type: "postBreak" }, p("second"));
    const { result } = mount({ build: build({ post_doc: stored }), buildId: "b1", isOwner: true });
    expect(result.current.status).toBe("ready");
    expect(result.current.readDoc()).toEqual(stored);
    expect(result.current.posts).toBe(2);
    expect(getThreadMedia).not.toHaveBeenCalled();
  });

  it("waits for the build, then opens", () => {
    const { result, rerender } = mount({ buildId: "b1", isOwner: false, build: null });
    expect(result.current.status).toBe("loading");
    rerender({ build: build({ post_doc: doc(p("late")) }), buildId: "b1", isOwner: true, ensureBuild: vi.fn(async () => "b1") });
    expect(result.current.status).toBe("ready");
    expect(JSON.stringify(result.current.readDoc())).toContain("late");
  });

  it("opens an old post as a thread, reading its pictures, and writes nothing until something changes", async () => {
    getThreadMedia.mockResolvedValue([
      { id: "m1", post_position: 0, post_text: "Opening line", width: 800, height: 600 },
      { id: "m2", post_position: 1, post_text: null, width: 800, height: 600 },
    ]);
    const { result } = mount({ build: build(), buildId: "b1", isOwner: true });
    expect(result.current.status).toBe("loading");
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(result.current.status).toBe("ready");
    expect(getThreadMedia).toHaveBeenCalledWith("b1");
    const opened = result.current.readDoc();
    expect(opened.content.map((block) => block.type)).toEqual(["paragraph", "postMedia", "postBreak", "postMedia"]);
    expect(result.current.posts).toBe(2);

    // The editor handing back the same thread (with its trailing paragraph) is not an edit.
    act(() => result.current.onDoc({ ...opened, content: [...opened.content, { type: "paragraph" }] }));
    await quiet();
    expect(saveThread).not.toHaveBeenCalled();
  });

  it("says so when the old post's pictures could not be read", async () => {
    getThreadMedia.mockRejectedValue(new Error("down"));
    const { result } = mount({ build: build(), buildId: "b1", isOwner: true });
    // The read is tried once more after a second before it is given up on.
    await act(async () => void (await vi.advanceTimersByTimeAsync(2000)));
    expect(result.current.status).toBe("error");
  });
});

describe("saving", () => {
  it("writes the thread once, on the composer's debounce, and reports saving then saved", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("ab"))));
    act(() => result.current.onDoc(doc(p("abc"))));
    await act(async () => void (await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 50)));
    expect(saveThread).not.toHaveBeenCalled();
    await quiet();
    expect(saveThread).toHaveBeenCalledTimes(1);
    expect(saveThread).toHaveBeenCalledWith("b1", doc(p("abc")));
    expect(result.current.save).toBe("saved");
  });

  it("is saving while the write is open", async () => {
    let finish: (value: unknown) => void = () => undefined;
    saveThread.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("ab"))));
    await quiet();
    expect(result.current.save).toBe("saving");
    await act(async () => finish({}));
    expect(result.current.save).toBe("saved");
  });

  it("writes post_doc for the first time when an old post is edited", async () => {
    getThreadMedia.mockResolvedValue([{ id: "m1", post_position: 0, post_text: "Hello", width: 1, height: 1 }]);
    const { result } = mount({ build: build(), buildId: "b1", isOwner: true });
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    const opened = result.current.readDoc();
    act(() => result.current.onDoc({ ...opened, content: [...opened.content, p("added")] }));
    await quiet();
    expect(saveThread).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(saveThread.mock.calls[0][1])).toContain("added");
    expect(JSON.stringify(saveThread.mock.calls[0][1])).toContain('"mediaId":"m1"');
  });

  it("makes the draft first when there is no build, then writes to it", async () => {
    const { result, ensureBuild } = mount();
    act(() => result.current.onDoc(doc(p("my first words"))));
    expect(ensureBuild).not.toHaveBeenCalled();
    await quiet();
    expect(ensureBuild).toHaveBeenCalledTimes(1);
    expect(saveThread).toHaveBeenCalledWith("b1", doc(p("my first words")));
  });

  it("takes the empty paragraphs off the end, and the attributes that are only their defaults", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc({ type: "paragraph", attrs: { size: "body" }, content: [{ type: "text", text: "kept" }] }, { type: "paragraph" })));
    await quiet();
    expect(saveThread).toHaveBeenCalledWith("b1", doc(p("kept")));
  });

  it("does not write for a build its user does not own", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: false });
    act(() => result.current.onDoc(doc(p("ab"))));
    await quiet();
    expect(saveThread).not.toHaveBeenCalled();
  });

  it("writes now on flush, without waiting for the debounce", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("ab"))));
    await act(async () => result.current.flush());
    expect(saveThread).toHaveBeenCalledTimes(1);
  });

  it("reports a failure and writes again on retry", async () => {
    saveThread.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("ab"))));
    await quiet();
    expect(result.current.save).toBe("error");
    act(() => result.current.retry());
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(saveThread).toHaveBeenCalledTimes(2);
    expect(result.current.save).toBe("saved");
  });
});

describe("a post over 1,000 characters", () => {
  it("holds the save and says which post, then saves once it is short enough", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("short"), { type: "postBreak" }, p("also short"), { type: "postBreak" }, p("x".repeat(1001)))));
    expect(result.current.hold).toBe("Post 3 is over 1,000 characters");
    await act(async () => void (await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 5)));
    expect(saveThread).not.toHaveBeenCalled();
    expect(result.current.save).toBe("idle");

    act(() => result.current.onDoc(doc(p("short"), { type: "postBreak" }, p("also short"), { type: "postBreak" }, p("x".repeat(1000)))));
    expect(result.current.hold).toBeNull();
    await quiet();
    expect(saveThread).toHaveBeenCalledTimes(1);
    expect(result.current.save).toBe("saved");
  });

  it("does not write on flush either, so Publish never sends it", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(p("x".repeat(1200)))));
    await act(async () => result.current.flush());
    expect(saveThread).not.toHaveBeenCalled();
    expect(result.current.hold).toBe("Post 1 is over 1,000 characters");
  });
});

describe("the cover", () => {
  it("follows the thread's first picture when it changes", async () => {
    const { result, client } = mount({ build: build({ post_doc: doc(picture("m1"), p("a")) }), buildId: "b1", isOwner: true });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    act(() => result.current.onDoc(doc(picture("m2"), picture("m1"), p("a"))));
    await quiet();
    expect(saveThread).toHaveBeenCalledTimes(1);
    expect(syncThreadCover).toHaveBeenCalledWith("b1", "m2", "m1");
    expect(invalidate).toHaveBeenCalled();
  });

  it("leaves the cover alone when the first picture is the same", async () => {
    const { result } = mount({ build: build({ post_doc: doc(picture("m1"), p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(picture("m1"), p("a, and more"), picture("m2"))));
    await quiet();
    expect(saveThread).toHaveBeenCalledTimes(1);
    expect(syncThreadCover).not.toHaveBeenCalled();
  });

  it("is told about a first picture when a thread that had none gets one", async () => {
    const { result } = mount({ build: build({ post_doc: doc(p("a")) }), buildId: "b1", isOwner: true });
    act(() => result.current.onDoc(doc(picture("m9"), p("a"))));
    await quiet();
    expect(syncThreadCover).toHaveBeenCalledWith("b1", "m9", null);
  });
});
