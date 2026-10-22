// CA-14 P2, P3, P6 — what a reader sees of sessions: the maker's titles, their order, the ones left folded, a session list
// once there are three, and none of the maker's controls.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import { buildCounts, readerSteps } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";

import type { BuildStepsView } from "./buildModel";
import { StepsList } from "./BuildSteps";

afterEach(cleanup);

const prompt = (id: string, position: number, session: string): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: `Prompt ${id} text`, session }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [] }) as unknown as NodeTree;

const KEYS = ["typed-a", "typed-b", "typed-c"];
const meta = {
  "typed-a": { tool: "claude", date: "2026-10-12", title: "Planning" },
  "typed-b": { tool: "chatgpt", date: "2026-10-13", title: "Router" },
  "typed-c": { tool: "cursor", date: "2026-10-14" },
};

function view(keys: string[], extra: Record<string, unknown> = {}): BuildStepsView {
  const tree = keys.flatMap((key, at) => [prompt(`${key}-1`, at * 2, key), prompt(`${key}-2`, at * 2 + 1, key)]);
  const making = { excluded_models: [], sessions: [], session_tools: {}, sessions_meta: Object.fromEntries(keys.map((key) => [key, meta[key as keyof typeof meta]])), ...extra };
  const steps = readerSteps(tree, making as never, new Map());
  const { title: _t, outcome: _o, ...rest } = buildStepsFixture("list");
  return { ...rest, steps, counts: buildCounts(steps) };
}

const mount = (v: BuildStepsView, phone = false) =>
  render(
    <MemoryRouter>
      <StepsList view={v} phone={phone} announce={vi.fn()} />
    </MemoryRouter>,
  );

describe("a reader's session head", () => {
  it("shows the maker's title as plain text, the app, the date, and no field or menu", () => {
    mount(view(KEYS.slice(0, 2)));
    const head = screen.getAllByTestId("reader-session-head")[0];
    expect(head.getAttribute("aria-label")).toBe("Session 1 · Claude");
    expect(within(head).getByTestId("session-title-text").textContent).toBe("Planning");
    expect(within(head).getByText("12 Oct")).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /options$/ })).toBeNull();
    expect(screen.queryByTestId("session-drag-handle")).toBeNull();
    expect(screen.queryByPlaceholderText("Add a title")).toBeNull();
  });

  it("shows nothing where there is no title", () => {
    mount(view(KEYS));
    const heads = screen.getAllByTestId("reader-session-head");
    expect(within(heads[2]).queryByTestId("session-title-text")).toBeNull();
  });

  it("follows the maker's order", () => {
    // The maker moved Session 2 up: its tiles were stacked first, and the order says the same.
    mount(view(["typed-b", "typed-a"], { session_order: ["typed-b", "typed-a"] }));
    expect(screen.getAllByTestId("reader-session-head").map((head) => head.getAttribute("aria-label"))).toEqual(["Session 1 · ChatGPT", "Session 2 · Claude"]);
  });
});

describe("folding", () => {
  it("starts folded for the sessions the maker left folded, with the count before the date and nothing under the head", () => {
    mount(view(KEYS.slice(0, 2), { sessions_collapsed: ["typed-b"] }));
    const heads = screen.getAllByTestId("reader-session-head");
    expect(within(heads[1]).getByRole("button", { name: "Expand Session 2" }).getAttribute("aria-expanded")).toBe("false");
    expect(within(heads[1]).getByTestId("session-count").textContent).toBe("2 tiles");
    expect(within(heads[0]).queryByTestId("session-count")).toBeNull();
    const folded = document.querySelector('[data-reader-session="typed-b"]') as HTMLElement;
    expect(within(folded).queryAllByTestId("step-card")).toHaveLength(0);
    expect(within(document.querySelector('[data-reader-session="typed-a"]') as HTMLElement).getAllByTestId("step-card")).toHaveLength(2);
  });

  it("lets a reader fold and open any session, for this visit", () => {
    mount(view(KEYS.slice(0, 2)));
    fireEvent.click(screen.getByRole("button", { name: "Collapse Session 1" }));
    expect(screen.getByRole("button", { name: "Expand Session 1" })).toBeTruthy();
    expect(within(document.querySelector('[data-reader-session="typed-a"]') as HTMLElement).queryAllByTestId("step-card")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 1" }));
    expect(within(document.querySelector('[data-reader-session="typed-a"]') as HTMLElement).getAllByTestId("step-card")).toHaveLength(2);
  });

  it("draws a 2px line down a session's tiles", () => {
    mount(view(KEYS.slice(0, 2)));
    expect(screen.getAllByTestId("session-line")).toHaveLength(2);
  });
});

describe("the session list", () => {
  it("is not drawn for two sessions, and is for three, whether or not the maker switched anything", () => {
    mount(view(KEYS.slice(0, 2)));
    expect(screen.queryByTestId("session-list")).toBeNull();
    cleanup();
    mount(view(KEYS));
    const nav = screen.getByRole("navigation", { name: "Sessions" });
    expect(within(nav).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["1Planning", "2Router", "3Cursor"]);
  });

  it("is one menu on a phone", () => {
    mount(view(KEYS), true);
    expect(screen.getByTestId("session-list").tagName).toBe("BUTTON");
  });
});
