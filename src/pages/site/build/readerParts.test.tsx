// CA-17 P6 — the reader's List with parts: each part's head, label, name and colour as in the composer, without its
// controls; the session list grouped by part; a link to a part, and the map offered only when the maker shows it.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import { groupKey, shownGroups } from "@/lib/build/graph";
import { jumpGroups } from "@/components/build/SessionJump";

import type { BuildStepsView } from "./buildModel";
import { StepsList } from "./BuildSteps";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(cleanup);

function view(over: Partial<BuildStepsView> = {}): BuildStepsView {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  void title;
  void outcome;
  return { ...steps, ...over };
}

/** The fixture's sessions, the first in Part A, the rest in Part B. */
function withParts(base: BuildStepsView, extra: Record<string, unknown> = {}): BuildStepsView {
  const keys = shownGroups(base.groups ?? []).map((group) => groupKey(group));
  const meta = Object.fromEntries(keys.map((key, at) => [key, { tool: null, date: "", ...(at > 0 ? { workstream: "ws-b" } : null) }]));
  return { ...base, making: { part_labels: "letters", workstreams: [{ key: "ws-a", name: "Tenant portal", colour: "#8FBFB8" }, { key: "ws-b", name: "Support agent" }], sessions_meta: meta, ...extra } };
}

function mount(v: BuildStepsView, phone = false) {
  render(
    <MemoryRouter>
      <StepsList view={v} phone={phone} announce={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("the reader's List with parts", () => {
  it("is as it was with one part, or none", () => {
    mount(view());
    expect(screen.queryByTestId("workstream-group")).toBeNull();
    cleanup();
    mount({ ...view(), making: { workstreams: [{ key: "ws-a" }] } });
    expect(screen.queryByTestId("workstream-head")).toBeNull();
  });

  it("draws each part's head with its label, name and count, and its sessions inside, with none of the maker's controls", () => {
    const v = withParts(view());
    mount(v);
    const heads = screen.getAllByTestId("workstream-head");
    expect(heads).toHaveLength(2);
    expect(within(heads[0]).getByTestId("workstream-label").textContent).toContain("Part A");
    expect(within(heads[0]).getByTestId("workstream-name-text").textContent).toBe("Tenant portal");
    expect(within(heads[0]).getByTestId("workstream-count").textContent).toMatch(/^1 session$/);
    expect(screen.queryByRole("button", { name: /options$/ })).toBeNull();
    expect(screen.queryByTestId("workstream-drag-handle")).toBeNull();
    expect(screen.queryByRole("textbox", { name: /^Name of/ })).toBeNull();
    const groups = screen.getAllByTestId("workstream-group");
    expect(within(groups[0]).getAllByTestId("reader-session-head")).toHaveLength(1);
    expect(within(groups[1]).getAllByTestId("reader-session-head").length).toBe(shownGroups(v.groups ?? []).length - 1);
  });

  it("lets a reader fold a part to its head", () => {
    mount(withParts(view()));
    const first = screen.getAllByTestId("workstream-group")[0];
    fireEvent.click(within(first).getByRole("button", { name: "Collapse Part A" }));
    expect(within(first).queryAllByTestId("reader-session-head")).toHaveLength(0);
    fireEvent.click(within(first).getByRole("button", { name: "Expand Part A" }));
    expect(within(first).getAllByTestId("reader-session-head")).toHaveLength(1);
  });

  it("groups the session list by part, with each part's title before its chips", () => {
    mount(withParts(view()));
    const nav = screen.getByTestId("session-list");
    expect(within(nav).getAllByTestId("session-list-part").map((label) => label.textContent)).toEqual(["Part A · Tenant portal", "Part B · Support agent"]);
  });

  it("does not group the session list without parts", () => {
    mount(view());
    expect(screen.queryByTestId("session-list-part")).toBeNull();
  });
});

describe("jumpGroups", () => {
  it("runs the items by part, in order, and is one run with no part", () => {
    const item = (key: string, group?: string) => ({ key, number: 1, label: key, ...(group ? { group } : null) });
    expect(jumpGroups([item("a", "A"), item("b", "A"), item("c", "B")]).map((run) => [run.group, run.items.map((entry) => entry.key)])).toEqual([["A", ["a", "b"]], ["B", ["c"]]]);
    expect(jumpGroups([item("a"), item("b")]).map((run) => run.group)).toEqual([null]);
  });
});

describe("the map for a reader", () => {
  it("is offered only when the maker has put it on the build page (the view says so); a build from before the map has it on", async () => {
    mount({ ...view(), mapAvailable: true });
    expect(screen.getByRole("button", { name: "Map" })).toBeTruthy();
    cleanup();
    mount({ ...view(), mapAvailable: false });
    expect(screen.queryByRole("button", { name: "Map" })).toBeNull();
  });
});
