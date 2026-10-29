// SV-21 P3 — opening a session or a part as a request, in the composer: the session's menu, the ghost row at the end of a part,
// and the dialog that asks what the request is for.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { AskNextSessionRow } from "./AskNextSessionRow";
import { BuildList, type BuildListProps, type ListPart, type ListParts } from "./BuildList";
import { OPEN_REQUEST_COPY } from "./OpenRequestDialog";
import { SESSION_HEAD_COPY, type SessionOps } from "./SessionHead";
import type { WorkstreamHeadView, WorkstreamOps } from "./WorkstreamHead";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const keys = () => [...sandboxListProps("bakery").dividers.values()].map((session) => session.key);
const view = (key: string, label: string, over: Partial<WorkstreamHeadView> = {}): WorkstreamHeadView => ({ key, label, nameColour: "var(--text)", sessions: 0, collapsed: false, ...over });

function partsOf(onOpen: WorkstreamOps["onOpen"], over: Partial<WorkstreamHeadView> = {}): ListParts {
  const [a, b, c] = keys();
  const parts: ListPart[] = [
    { title: "Part A", sessions: [a, b], startsAfterChoices: [], view: view("ws-a", "Part A", { sessions: 2, ...over }) },
    { title: "Part B", sessions: [c], startsAfterChoices: [], view: view("ws-b", "Part B", { sessions: 1 }) },
  ];
  return { parts, ops: { onName: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onStartsAfter: vi.fn(), onOpen } };
}

function list(over: Partial<BuildListProps> = {}) {
  const sessionOps: SessionOps = { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onOpen: vi.fn() };
  const props: BuildListProps = { ...sandboxListProps("bakery"), onToggleCollapsed: vi.fn(), sessionOps, ...over };
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

const openMenu = (name: string) => {
  const trigger = screen.getByRole("button", { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.keyDown(trigger, { key: "Enter" });
};

describe("a session's menu", () => {
  it("opens the session as a request: the item asks what it is for, and the answer is passed with the session's key", async () => {
    const props = list();
    openMenu("Session 2 options");
    fireEvent.click(await screen.findByRole("menuitem", { name: SESSION_HEAD_COPY.openAsRequest }));
    const dialog = await screen.findByTestId("open-request-dialog");
    expect(within(dialog).getByRole("heading", { name: OPEN_REQUEST_COPY.openSession(2) })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(within(dialog).getByRole("alert").textContent).toBe(OPEN_REQUEST_COPY.empty);
    expect(props.sessionOps?.onOpen).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: OPEN_REQUEST_COPY.label }), { target: { value: "  Deploy the worker  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(props.sessionOps?.onOpen).toHaveBeenCalledWith(expect.any(String), "Deploy the worker");
    await waitFor(() => expect(screen.queryByTestId("open-request-dialog")).toBeNull());
  });

  it("shows an open session as one, and offers to take the request back instead", async () => {
    const base = sandboxListProps("bakery");
    const first = [...base.dividers.values()][0];
    const dividers = new Map(base.dividers);
    dividers.set([...base.dividers.keys()][0], { ...first, open: "Deploy the worker" });
    const props = list({ dividers });
    expect(within(screen.getAllByTestId("session-head")[0]).getByTestId("session-open-request").textContent).toBe(SESSION_HEAD_COPY.requested);
    openMenu("Session 1 options");
    expect(screen.queryByRole("menuitem", { name: SESSION_HEAD_COPY.openAsRequest })).toBeNull();
    fireEvent.click(await screen.findByRole("menuitem", { name: SESSION_HEAD_COPY.withdrawRequest }));
    expect(props.sessionOps?.onOpen).toHaveBeenCalledWith(first.key, null);
  });

  it("has no item when the head has no way to write it", async () => {
    list({ sessionOps: { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() } });
    openMenu("Session 1 options");
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(screen.queryByRole("menuitem", { name: SESSION_HEAD_COPY.openAsRequest })).toBeNull();
  });
});

describe("the ghost row at the end of a part", () => {
  it("is drawn in each part with a way to write it, as one slide, and asks before it marks the part", async () => {
    const onOpen = vi.fn();
    list({ parts: partsOf(onOpen) });
    const rows = screen.getAllByTestId("ask-next-session");
    expect(rows.map((row) => row.getAttribute("data-slide-id"))).toEqual(["ask:ws-a", "ask:ws-b"]);
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Ask for the next session in Part A" }));
    const dialog = await screen.findByTestId("open-request-dialog");
    expect(within(dialog).getByRole("heading", { name: OPEN_REQUEST_COPY.askNext("Part A") })).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: OPEN_REQUEST_COPY.label }), { target: { value: "Add the onboarding session" } });
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(onOpen).toHaveBeenCalledWith("ws-a", "Add the onboarding session");
  });

  it("says what is being asked once the part is marked, and takes it back", () => {
    const onOpen = vi.fn();
    list({ parts: partsOf(onOpen, { open: "Add the onboarding session" }) });
    const row = screen.getAllByTestId("ask-next-session")[0];
    expect(row.textContent).toContain("Asking for the next session: Add the onboarding session");
    expect(within(row).queryByRole("button", { name: /Ask for the next session/ })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Take it back: Part A" }));
    expect(onOpen).toHaveBeenCalledWith("ws-a", null);
  });

  it("is not drawn without a way to write it, and not in a build with one part", () => {
    list({ parts: partsOf(undefined) });
    expect(screen.queryByTestId("ask-next-session")).toBeNull();
    cleanup();
    list();
    expect(screen.queryByTestId("ask-next-session")).toBeNull();
  });

  it("stands alone: pressed, the dialog is the row's own", async () => {
    const onOpen = vi.fn();
    render(<AskNextSessionRow label="Part C" partKey="ws-c" phone={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask for the next session in Part C" }));
    fireEvent.change(await screen.findByRole("textbox", { name: OPEN_REQUEST_COPY.label }), { target: { value: "More" } });
    fireEvent.click(screen.getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(onOpen).toHaveBeenCalledWith("ws-c", "More");
  });
});
