// CA-17 P2 — parts in the List: heads, groups, menus, moves, "Add a part", and a build with one part drawn as it always was.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps, type ListPart, type ListParts } from "./BuildList";
import { SESSION_HEAD_COPY, type SessionOps } from "./SessionHead";
import { WORKSTREAM_HEAD_COPY, type WorkstreamHeadView, type WorkstreamOps } from "./WorkstreamHead";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const keys = () => [...sandboxListProps("bakery").dividers.values()].map((session) => session.key);

const view = (key: string, label: string, over: Partial<WorkstreamHeadView> = {}): WorkstreamHeadView => ({ key, label, nameColour: "var(--text)", sessions: 0, collapsed: false, ...over });

/** Part A holds the first two sessions, Part B the third; a third, empty part when asked. */
function partsOf(over: Partial<ListParts> = {}, empty = false): ListParts {
  const [a, b, c] = keys();
  const parts: ListPart[] = [
    { title: "Part A · Tenant portal", sessions: [a, b], startsAfterChoices: [{ key: c, label: "Session 3 · Triage agent" }], view: view("ws-a", "Part A", { name: "Tenant portal", sessions: 2 }) },
    { title: "Part B", sessions: [c], startsAfterChoices: [{ key: a, label: "Session 1" }, { key: b, label: "Session 2" }], view: view("ws-b", "Part B", { sessions: 1 }) },
    ...(empty ? [{ title: "Part C", sessions: [], startsAfterChoices: [], view: view("ws-c", "Part C") } satisfies ListPart] : []),
  ];
  return { parts, ops: ops(), ...over };
}

const ops = (): WorkstreamOps => ({ onName: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onStartsAfter: vi.fn() });
const sessionOps = (): SessionOps => ({ onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMoveToPart: vi.fn(), onWithAbove: vi.fn() });

function list(over: Partial<BuildListProps> = {}) {
  const props: BuildListProps = { ...sandboxListProps("bakery"), onToggleCollapsed: vi.fn(), sessionOps: sessionOps(), ...over };
  const view = render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return { props, view };
}

const openMenu = (name: string) => {
  const trigger = screen.getByRole("button", { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.keyDown(trigger, { key: "Enter" });
};

describe("one part", () => {
  it("draws no head and no group: the List is the same markup as without parts", () => {
    const same = (html: string) => html.replace(/(:r[0-9a-z]+:|radix-[:\w]+)/g, "id");
    const plain = same(list().view.container.innerHTML);
    cleanup();
    const [a] = keys();
    const one = same(list({ parts: { parts: [{ title: "Part A", sessions: keys(), startsAfterChoices: [], view: view("ws-a", "Part A", { sessions: 3 }) }], ops: ops() } }).view.container.innerHTML);
    expect(one).toBe(plain);
    expect(screen.queryByTestId("workstream-head")).toBeNull();
    expect(a).toBeTruthy();
  });
  it("draws no 'Add a part' row unless the page asks", () => {
    list();
    expect(screen.queryByTestId("add-part-row")).toBeNull();
  });
});

describe("two parts", () => {
  it("draw a head and a hairline group round each part's sessions", () => {
    list({ parts: partsOf() });
    const heads = screen.getAllByTestId("workstream-head");
    expect(heads).toHaveLength(2);
    const groups = screen.getAllByTestId("workstream-group");
    expect(groups).toHaveLength(2);
    const style = groups[0].getAttribute("style") ?? "";
    expect(style).toContain("border-radius: 14px");
    expect(style).toContain("padding: 10px");
    expect(style).toContain("gap: 8px");
    expect(within(groups[0]).getAllByTestId("session-head")).toHaveLength(2);
    expect(within(groups[1]).getAllByTestId("session-head")).toHaveLength(1);
  });
  it("show the label, the name, the count and no colour button without a colour", () => {
    list({ parts: partsOf() });
    const first = screen.getAllByTestId("workstream-head")[0];
    expect(within(first).getByTestId("workstream-label").textContent).toContain("Part A");
    expect((within(first).getByRole("textbox", { name: "Name of Part A" }) as HTMLInputElement).value).toBe("Tenant portal");
    expect(within(first).getByTestId("workstream-count").textContent).toBe("2 sessions");
    expect(within(screen.getAllByTestId("workstream-head")[1]).getByTestId("workstream-count").textContent).toBe("1 session");
    expect(within(first).queryByRole("button", { name: /^Colour for/ })).toBeNull();
  });
  it("name a part: placeholder, saved on Enter", () => {
    const parts = partsOf();
    list({ parts });
    const field = within(screen.getAllByTestId("workstream-head")[1]).getByRole("textbox", { name: "Name of Part B" }) as HTMLInputElement;
    expect(field.placeholder).toBe(WORKSTREAM_HEAD_COPY.namePlaceholder);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "  Support agent " } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.blur(field);
    expect(parts.ops?.onName).toHaveBeenCalledWith("ws-b", "Support agent");
  });
  it("fold a part to its head", () => {
    const onToggle = vi.fn();
    const closed = partsOf({ onToggle });
    closed.parts[1].view.collapsed = true;
    list({ parts: closed });
    const group = screen.getAllByTestId("workstream-group")[1];
    expect(within(group).queryAllByTestId("session-head")).toHaveLength(0);
    fireEvent.click(within(group).getByRole("button", { name: "Expand Part B" }));
    expect(onToggle).toHaveBeenCalledWith("ws-b", false);
    fireEvent.click(within(screen.getAllByTestId("workstream-group")[0]).getByRole("button", { name: "Collapse Part A" }));
    expect(onToggle).toHaveBeenCalledWith("ws-a", true);
  });
  it("draw a part with no sessions as 'No sessions yet' with a way to add one", () => {
    const onAddSession = vi.fn();
    list({ parts: partsOf({ onAddSession }, true), addSession: { library: [], adding: false, onAdd: vi.fn(), onStartNew: vi.fn() } });
    const empty = screen.getByTestId("workstream-empty");
    expect(empty.textContent).toContain("No sessions yet");
    fireEvent.click(within(empty).getByRole("button", { name: WORKSTREAM_HEAD_COPY.addHere }));
    expect(onAddSession).toHaveBeenCalledWith("ws-c");
    expect(screen.getByRole("dialog", { name: "Add a session" })).toBeTruthy();
  });
});

describe("a part's menu", () => {
  it("lists its rows in order and turns off the moves that cannot happen", async () => {
    const parts = partsOf({ onColour: vi.fn() });
    list({ parts });
    openMenu("Part A options");
    const rows = (await screen.findAllByRole("menuitem")).map((row) => row.textContent);
    expect(rows).toEqual(["Colour…", "Starts after…", "Move up", "Move down", "Remove part"]);
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(parts.ops?.onMove).toHaveBeenCalledWith("ws-a", 1);
  });
  it("turns Move down off for the last part", async () => {
    list({ parts: partsOf() });
    openMenu("Part B options");
    expect((await screen.findByRole("menuitem", { name: "Move down" })).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBeNull();
  });
  it("draws Remove part in the danger text colour", async () => {
    list({ parts: partsOf() });
    openMenu("Part A options");
    expect((await screen.findByRole("menuitem", { name: "Remove part" })).getAttribute("data-tone")).toBe("danger");
  });
  it("offers Starts after… with a tick on the current one and None", async () => {
    const parts = partsOf();
    parts.parts[1].view.startsAfter = keys()[1];
    list({ parts });
    openMenu("Part B options");
    const trigger = await screen.findByRole("menuitem", { name: "Starts after…" });
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    const choices = await screen.findAllByRole("menuitem", { name: /Session|None/ });
    expect(choices.map((row) => row.textContent)).toEqual(expect.arrayContaining(["Session 1", "Session 2", "None"]));
    const current = choices.find((row) => row.textContent === "Session 2") as HTMLElement;
    expect(current.querySelector("svg")).toBeTruthy();
    fireEvent.click(choices.find((row) => row.textContent === "None") as HTMLElement);
    expect(parts.ops?.onStartsAfter).toHaveBeenCalledWith("ws-b", null);
  });
  it("removes at once, with no window: nothing is lost, since its sessions join the part next to it (CA-20 P2)", async () => {
    const parts = partsOf();
    list({ parts });
    openMenu("Part B options");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove part" }));
    expect(parts.ops?.onRemove).toHaveBeenCalledWith("ws-b");
    expect(screen.queryByTestId("remove-workstream-dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("a session in a part", () => {
  it("offers Move to part… with the other parts", async () => {
    const props = list({ parts: partsOf() }).props;
    openMenu("Session 1 options");
    const trigger = await screen.findByRole("menuitem", { name: SESSION_HEAD_COPY.moveToPart });
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    const row = await screen.findByRole("menuitem", { name: "Part B" });
    fireEvent.click(row);
    expect(props.sessionOps?.onMoveToPart).toHaveBeenCalledWith(keys()[0], "ws-b");
  });
  it("offers Same stage as the session above, off for the first session of a part", async () => {
    const props = list({ parts: partsOf() }).props;
    openMenu("Session 1 options");
    const first = await screen.findByRole("menuitemcheckbox", { name: SESSION_HEAD_COPY.sameStage });
    expect(first.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    cleanup();
    const second = list({ parts: partsOf() }).props;
    openMenu("Session 2 options");
    const row = await screen.findByRole("menuitemcheckbox", { name: SESSION_HEAD_COPY.sameStage });
    expect(row.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(row);
    expect(second.sessionOps?.onWithAbove).toHaveBeenCalledWith(keys()[1], true);
    expect(props).toBeTruthy();
  });
  it("says 'Same stage as Session 1' under the head when it is set", () => {
    list({ parts: partsOf({ withAbove: new Set([keys()[1]]) }) });
    expect(screen.getByTestId("same-stage-line").textContent).toBe("Same stage as Session 1");
  });
  it("moves within its part only: Move up is off for the first session of a part, Move down for the last", async () => {
    list({ parts: partsOf() });
    openMenu("Session 1 options");
    expect((await screen.findByRole("menuitem", { name: "Move up" })).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    cleanup();
    list({ parts: partsOf() });
    openMenu("Session 2 options");
    expect((await screen.findByRole("menuitem", { name: "Move down" })).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    cleanup();
    list({ parts: partsOf() });
    openMenu("Session 3 options");
    expect((await screen.findByRole("menuitem", { name: "Move up" })).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Add a part", () => {
  it("is a row directly under Add a session", () => {
    const onAddPart = vi.fn();
    list({ onAddPart, addSession: { library: [], adding: false, onAdd: vi.fn(), onStartNew: vi.fn() } });
    const session = screen.getByTestId("add-session-row");
    const part = screen.getByTestId("add-part-row");
    expect(session.nextElementSibling).toBe(part);
    expect(part.textContent).toBe("Add a part");
    expect(part.getAttribute("style")).toBe(session.getAttribute("style"));
    fireEvent.click(part);
    expect(onAddPart).toHaveBeenCalledTimes(1);
  });
});

describe("moving by the handle", () => {
  it("each part has a handle named for it, and a reader's head has none and no menu", () => {
    list({ parts: partsOf() });
    expect(screen.getAllByTestId("workstream-drag-handle").map((handle) => handle.getAttribute("aria-label"))).toEqual(["Move Part A", "Move Part B"]);
    cleanup();
    list({ parts: partsOf({ ops: undefined }), sessionOps: undefined });
    expect(screen.queryByTestId("workstream-drag-handle")).toBeNull();
    expect(screen.queryByRole("button", { name: "Part A options" })).toBeNull();
    expect(screen.getAllByTestId("workstream-head")).toHaveLength(2);
    expect(screen.queryByRole("textbox", { name: "Name of Part A" })).toBeNull();
    expect(screen.getByTestId("workstream-name-text").textContent).toBe("Tenant portal");
  });
});

describe("a part's colour", () => {
  it("draws the colour button only when the part has a colour, and opens the picker from it and from Colour… in the menu", async () => {
    const onColour = vi.fn();
    const parts = partsOf({ onColour });
    parts.parts[0].view.colour = "#8FBFB8";
    list({ parts });
    const button = screen.getByRole("button", { name: "Colour for Part A: #8FBFB8" });
    expect(screen.queryByRole("button", { name: /^Colour for Part B/ })).toBeNull();
    fireEvent.click(button);
    expect(onColour).toHaveBeenLastCalledWith("ws-a", expect.any(HTMLElement), "Part A · Tenant portal", "#8FBFB8");
    openMenu("Part B options");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Colour…" }));
    expect(onColour).toHaveBeenLastCalledWith("ws-b", expect.any(HTMLElement), "Part B", null);
  });
  it("draws the label and name in the colour it is given, or --text", () => {
    const parts = partsOf();
    parts.parts[0].view.nameColour = "#457871";
    list({ parts });
    const [first, second] = screen.getAllByTestId("workstream-label");
    expect(first.getAttribute("style")).toContain("rgb(69, 120, 113)");
    expect(second.getAttribute("style")).not.toContain("rgb(");
  });
});
