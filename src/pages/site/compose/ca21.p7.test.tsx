// CA-21 P7 - adding a session: the lane opens, a place for each prompt, the head falls, then each prompt in turn, then the skeleton goes.
// The composer mounted for real (SandboxPage behind supabase-js, only the network faked); animations are recorded, not played.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { PG } from "@/lib/build/__audit__/fakeSupabase";
import { promptStart } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { DRAFT, field, harnessAfter, harnessBefore, mount, openRow, sessionsOf, stubWidth } from "./ca20Harness";

vi.setConfig({ testTimeout: 40_000 });

interface Played {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  element: Element;
}
let played: Played[] = [];
let scrolled: Element[] = [];

beforeEach(() => {
  harnessBefore();
  // A window wide enough for Sources to stand beside the build.
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1600 });
  stubWidth(1600);
  __resetMotionMediaCache();
  played = [];
  scrolled = [];
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    played.push({ keyframes, options, element: this });
    return { cancel: () => undefined } as unknown as Animation;
  }) as never;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});
afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  __resetMotionMediaCache();
  harnessAfter();
});

const falls = () => played.filter((entry) => String(entry.keyframes[0].transform) === "translateY(-20px)");
const line = () => screen.getByTestId("sessions-said").textContent;
/** Waits until the add is over, so nothing of it is still on its way when the next test begins. */
const finished = () => waitFor(() => expect(line()).toMatch(/^Added Session/), { timeout: 20_000 });

/** A slow write, so the lane is seen waiting for its prompts. */
const SLOW = [{ method: "POST", path: /^\/rest\/v1\/build_nodes/, delayMs: 1200 }];

async function startFromSources(label: RegExp = /1 prompt$/, delays: typeof SLOW = SLOW) {
  mount(`/compose/${DRAFT}`, { delays });
  await field();
  const panel = await screen.findByTestId("sources-panel", undefined, { timeout: 10_000 });
  const row = (await within(panel).findAllByText(label, undefined, { timeout: 10_000 }))[0].closest("div[style*='display: flex']") as HTMLElement;
  fireEvent.click(within(row.parentElement as HTMLElement).getAllByRole("button", { name: "Add session" })[0]);
}

describe("pressing a session in Sources", () => {
  it("turns its + into 'In this draft' at once, and says what is being added", async () => {
    await startFromSources();
    await screen.findByTestId("plus-to-words");
    expect(screen.getByTestId("plus-to-words").textContent).toContain("In this draft");
    await waitFor(() => expect(line()).toMatch(/^Adding .* as Session 1…$/));
    await finished();
  });

  it("opens a lane with one numbered place for the prompt, and lets the head fall 260 ms in, over 240 ms", async () => {
    await startFromSources();
    const block = await screen.findByTestId("arriving-session", undefined, { timeout: 10_000 });
    expect(within(block).getAllByTestId("arriving-place")).toHaveLength(1);
    const head = played.find((entry) => entry.element === within(block).getByTestId("arriving-head"));
    expect(head?.keyframes[0]).toMatchObject({ opacity: 0, transform: "translateY(-20px)" });
    expect(head?.options).toMatchObject({ delay: 260, duration: 240 });
    await finished();
  });

  it("then the real session is there, and its prompt falls into place after the head", async () => {
    await startFromSources();
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 15_000 });
    await waitFor(() => expect(falls().length).toBeGreaterThan(0), { timeout: 5000 });
    for (const entry of falls()) expect(entry.options.duration).toBe(240);
    expect(falls().every((entry) => (entry.options.delay as number) >= 0)).toBe(true);
    await finished();
  });

  it("ends by saying what was added, once the skeleton has faded", async () => {
    await startFromSources();
    await waitFor(() => expect(line()).toBe("Added Session 1 with 1 prompt."), { timeout: 15_000 });
    expect(screen.queryByTestId("skeleton-layer")).toBeNull();
    expect(screen.queryByTestId("arriving-session")).toBeNull();
  });

  it("is one step: Undo removes the session", async () => {
    await startFromSources();
    await waitFor(() => expect(sessionsOf()).toHaveLength(1), { timeout: 15_000 });
    const undo = await screen.findByTestId("title-undo");
    await waitFor(() => expect(undo.getAttribute("title")).toMatch(/^Undo: Added Session 1/), { timeout: 15_000 });
    fireEvent.click(undo);
    await waitFor(() => expect(sessionsOf()).toHaveLength(0), { timeout: 15_000 });
  });
});

describe("the same from Add a session", () => {
  it("opens the same lane, with the same place for the prompt", async () => {
    mount(`/compose/${DRAFT}`, { delays: SLOW });
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    const block = await screen.findByTestId("arriving-session", undefined, { timeout: 10_000 });
    expect(within(block).getAllByTestId("arriving-place")).toHaveLength(1);
    await waitFor(() => expect(line()).toBe("Added Session 1 with 1 prompt."), { timeout: 15_000 });
  });
});

describe("a long session", () => {
  it("lands 9 or more prompts with the 8th: the starts step by 110 ms for eight and then stop", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(promptStart)).toEqual([110, 220, 330, 440, 550, 660, 770, 880]);
    expect([8, 9, 20, 65].map(promptStart)).toEqual([880, 880, 880, 880]);
  });
});

describe("when it cannot be added", () => {
  it("closes the lane back, brings the + back and says so", async () => {
    mount(`/compose/${DRAFT}`, { faults: [{ path: /^\/rest\/v1\/build_nodes/, method: "POST", answer: PG.rlsInsert("build_nodes") }] });
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await waitFor(() => expect(line()).toBe("Couldn't add that session. Try again."), { timeout: 15_000 });
    await waitFor(() => expect(screen.queryByTestId("arriving-session")).toBeNull());
    expect(screen.queryByTestId("skeleton-layer")).toBeNull();
  });
});

describe("Start a new session", () => {
  it("opens the lane and drops the head in, with no places for prompts, and shows 'Drop a tile here' until it is done", async () => {
    mount(`/compose/${DRAFT}`, { delays: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, delayMs: 900 }] });
    await field();
    fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
    fireEvent.click(await screen.findByRole("button", { name: /Start a new session/ }));
    const block = await screen.findByTestId("arriving-session", undefined, { timeout: 10_000 });
    expect(within(block).queryAllByTestId("arriving-place")).toHaveLength(0);
    await waitFor(() => expect(screen.queryByTestId("arriving-session")).toBeNull(), { timeout: 15_000 });
    expect(screen.getAllByRole("group", { name: /No app chosen$/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByTestId("skeleton-layer")).toBeNull(), { timeout: 5000 });
  });
});

describe("the page is off screen", () => {
  it("scrolls to the place first", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return { x: 0, y: 5000, width: 100, height: 100, left: 0, top: 5000, right: 100, bottom: 5100, toJSON: () => ({}) } as DOMRect;
    });
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await waitFor(() => expect(scrolled.some((element) => element.getAttribute("data-testid") === "build-list" || element.hasAttribute("data-skel-kind"))).toBe(true), { timeout: 10_000 });
  });
});

describe("reduced motion", () => {
  it("shows the session complete, with nothing sliding or falling, and the same lines", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") || /min-width:\s*(\d+)px/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
    __resetMotionMediaCache();
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await waitFor(() => expect(line()).toBe("Added Session 1 with 1 prompt."), { timeout: 15_000 });
    expect(screen.queryByTestId("arriving-session")).toBeNull();
    expect(falls()).toHaveLength(0);
  });
});
