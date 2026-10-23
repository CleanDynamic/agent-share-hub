// CA-17 P5 — the colour picker for a part: its head, "Also colour its sessions that have no colour" (off to start, and
// only the sessions with no colour of their own), and the live preview on the part's head, the map and the post's links.

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { previewColours, previewWorkstreams, uncolouredSessions } from "@/lib/build/colourPreview";
import type { SessionGroup } from "@/lib/build/graph";
import { useColourPicking } from "@/pages/site/compose/useColourPicking";

import { COLOUR_PICKER_COPY, ColourPicker } from "./ColourPicker";
import { configureSwatchSaving } from "./useColourSwatches";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: vi.fn() })) as never;
  configureSwatchSaving(null);
});
afterEach(cleanup);

const group = (key: string, number: number, colour?: string): SessionGroup =>
  ({ key, kind: "typed", sessionId: null, number, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers: [String(number)], ...(colour ? { colour } : null) }) as SessionGroup;

const groups = [group("typed-1", 1), group("typed-2", 2, "#7FA7D9"), group("typed-3", 3)];
const sessionsOfPart = (workstream: string) => (workstream === "ws-b" ? ["typed-2", "typed-3"] : ["typed-1"]);

describe("the part's picker", () => {
  it("reads 'Colour' and the part's title, and offers 'Also colour its sessions that have no colour', off to start", () => {
    render(<ColourPicker open anchor={document.body} what="Part B · Support agent" initial={null} part swatches={{ recent: [], favourites: [] }} onSwatches={vi.fn()} onPreview={vi.fn()} onDone={vi.fn()} onCancel={vi.fn()} phone={false} />);
    expect(screen.getByText(COLOUR_PICKER_COPY.head)).toBeTruthy();
    expect(screen.getByText("Part B · Support agent")).toBeTruthy();
    const box = screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoSessions }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoTiles })).toBeNull();
  });

  it("is a tile's or a session's as it was: no sessions checkbox", () => {
    render(<ColourPicker open anchor={document.body} what="Session 1" initial={null} session swatches={{ recent: [], favourites: [] }} onSwatches={vi.fn()} onPreview={vi.fn()} onDone={vi.fn()} onCancel={vi.fn()} phone={false} />);
    expect(screen.queryByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoSessions })).toBeNull();
    expect(screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoTiles })).toBeTruthy();
  });
});

describe("what Done writes", () => {
  it("is the part's colour alone, with the box off", () => {
    const write = vi.fn();
    const { result } = renderHook(() => useColourPicking({ preview: null, setPreview: vi.fn(), savedSteps: [], savedGroups: groups, write, phone: false, sessionsOfPart }));
    act(() => result.current.onColour("workstream:ws-b", document.body, "Part B", null));
    render(<>{result.current.picker}</>);
    fireEvent.click(screen.getByRole("button", { name: "#D98C8C" }));
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.done }));
    expect(write.mock.calls).toEqual([["workstream:ws-b", "#D98C8C"]]);
  });

  it("gives that colour to its sessions that have none with the box on, and touches nothing else", () => {
    const write = vi.fn();
    const { result } = renderHook(() => useColourPicking({ preview: null, setPreview: vi.fn(), savedSteps: [], savedGroups: groups, write, phone: false, sessionsOfPart }));
    act(() => result.current.onColour("workstream:ws-b", document.body, "Part B", null));
    render(<>{result.current.picker}</>);
    fireEvent.click(screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoSessions }));
    fireEvent.click(screen.getByRole("button", { name: "#D98C8C" }));
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.done }));
    // typed-2 has its own colour and keeps it; typed-1 is in another part and is not touched.
    expect(write.mock.calls).toEqual([
      ["workstream:ws-b", "#D98C8C"],
      ["session:typed-3", "#D98C8C"],
    ]);
  });

  it("previews on every change, and Cancel writes nothing and drops the preview", () => {
    const write = vi.fn();
    const setPreview = vi.fn();
    const { result } = renderHook(() => useColourPicking({ preview: null, setPreview, savedSteps: [], savedGroups: groups, write, phone: false, sessionsOfPart }));
    act(() => result.current.onColour("workstream:ws-b", document.body, "Part B", "#D98C8C"));
    render(<>{result.current.picker}</>);
    fireEvent.click(screen.getByRole("button", { name: "#8FBFB8" }));
    expect(setPreview).toHaveBeenLastCalledWith({ to: "workstream:ws-b", colour: "#8FBFB8", alsoTiles: false });
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.cancel }));
    expect(setPreview).toHaveBeenLastCalledWith(null);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("the preview", () => {
  const making = { workstreams: [{ key: "ws-a" }, { key: "ws-b", colour: "#D98C8C" }] };

  it("lays the colour over the part, and takes it off for none", () => {
    expect((previewWorkstreams(making, { to: "workstream:ws-a", colour: "#7FA7D9", alsoTiles: false }) as typeof making).workstreams[0]).toEqual({ key: "ws-a", colour: "#7FA7D9" });
    expect((previewWorkstreams(making, { to: "workstream:ws-b", colour: null, alsoTiles: false }) as typeof making).workstreams[1]).toEqual({ key: "ws-b" });
    expect(previewWorkstreams(making, null)).toBe(making);
    expect(previewWorkstreams(making, { to: "node:x", colour: "#7FA7D9", alsoTiles: false })).toBe(making);
    expect(making.workstreams[0]).toEqual({ key: "ws-a" });
  });

  it("colours only the part's uncoloured sessions when the box is on", () => {
    const shown = previewColours([], groups, { to: "workstream:ws-b", colour: "#D98C8C", alsoTiles: true }, sessionsOfPart);
    expect(shown.groups.map((entry) => entry.colour)).toEqual([undefined, "#7FA7D9", "#D98C8C"]);
    expect(previewColours([], groups, { to: "workstream:ws-b", colour: "#D98C8C", alsoTiles: false }, sessionsOfPart).groups).toBe(groups);
    expect(uncolouredSessions(groups, ["typed-1", "typed-2"])).toEqual(["typed-1"]);
  });
});
