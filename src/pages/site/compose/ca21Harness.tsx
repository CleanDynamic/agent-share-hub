// CA-21: the List mounted for dragging in jsdom, which has no layout: every element the page can find to measure is given a box.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps, type ListPart, type ListParts } from "./BuildList";
import type { SessionOps } from "./SessionHead";
import type { WorkstreamOps } from "./WorkstreamHead";

export const keys = () => [...sandboxListProps("bakery").dividers.values()].map((session) => session.key);

export function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

const box = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;

/** Every skeleton element stands in a column 400 wide, 100 apart, in document order: a session just before its tiles. */
export function stubLayout(left = 100) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const all = [...document.querySelectorAll("[data-skel-id]")];
    const at = all.indexOf(this);
    if (at >= 0) {
      // A session or a part reaches to the last thing inside it.
      const inside = all.filter((other) => other !== this && this.contains(other));
      const last = inside.length > 0 ? all.indexOf(inside[inside.length - 1]) : at;
      return box(left, at * 100, 400, (last - at) * 100 + 90);
    }
    if (this.getAttribute?.("data-testid") === "build-list") return box(0, 0, 600, all.length * 100);
    return box(0, 0, 0, 0);
  });
}

export const sessionOps = (): SessionOps => ({ onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMoveToPart: vi.fn(), onWithAbove: vi.fn() });
const partOps = (): WorkstreamOps => ({ onName: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onStartsAfter: vi.fn() });

const view = (key: string, label: string, sessions: number) => ({ key, label, nameColour: "var(--text)", sessions, collapsed: false });

/** Part 1 holds the first two sessions, Part 2 the third, or nothing when `empty`. */
export function partsOf(empty = false): ListParts {
  const [a, b, c] = keys();
  const parts: ListPart[] = [
    { title: "Part 1", sessions: empty ? [a, b, c] : [a, b], startsAfterChoices: [], view: view("ws-a", "Part 1", empty ? 3 : 2) },
    { title: "Part 2", sessions: empty ? [] : [c], startsAfterChoices: [], view: view("ws-b", "Part 2", empty ? 0 : 1) },
  ];
  return { parts, ops: partOps() };
}

export function mountList(over: Partial<BuildListProps> = {}) {
  const props: BuildListProps = {
    ...sandboxListProps("bakery"),
    onToggleCollapsed: vi.fn(),
    sessionOps: sessionOps(),
    onNest: vi.fn(() => Promise.resolve(true)),
    canNest: () => true,
    onMoveToSession: vi.fn(() => Promise.resolve(true)),
    onDropSession: vi.fn(() => Promise.resolve()),
    onDropOnWorkstream: vi.fn(() => Promise.resolve()),
    onDropWorkstream: vi.fn(() => Promise.resolve()),
    ...over,
  };
  const result = render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return { props, ...result };
}

export const said = () => screen.getByTestId("nest-said").textContent;

/** Picks up with Space on a grip, and waits for the page to show it is held. */
export async function pickUp(handle: HTMLElement) {
  await act(async () => {
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
  });
  await waitFor(() => expect(screen.getByTestId("held-copy")).toBeTruthy());
}
/** A key while something is held (Up and Down move its place, Space drops it, Escape puts it back). */
export async function press(code: string) {
  await act(async () => {
    fireEvent.keyDown(document, { code, key: code });
  });
}

export function done() {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}
