// CA-06 P5 — the colour picker: the wheel's numbers, lightness redrawing it, the hex field, Recent and Favourites,
// Cancel putting the colour back, and a session's "Also colour its tiles that have no colour".

import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LINKS_COLOURS, LINKS_S1, LINKS_S2, linksBuild } from "@/dev/fixtures/postLinks";
import { previewColours, uncolouredTiles } from "@/lib/build/colourPreview";
import { groupKey } from "@/lib/build/graph";
import {
  FAVOURITES_MAX,
  hexToHsl,
  hslToHex,
  LIGHTNESS_START,
  RECENT_MAX,
  SATURATION_MAX,
  toggleFavourite,
  wheelAt,
  wheelHex,
  wheelKey,
  wheelPoint,
  withRecent,
} from "@/lib/theme/colourWheel";
import { useColourPicking } from "@/pages/site/compose/useColourPicking";

import { COLOUR_PICKER_COPY, ColourPicker, recentAfterDone, type ColourPickerProps } from "./ColourPicker";
import { setSwatchStore } from "./useColourSwatches";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

/** jsdom has no canvas: a 2d context that records what is drawn. */
const putImageData = vi.fn();
beforeEach(() => {
  putImageData.mockReset();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData })) as never;
  setSwatchStore({ recent: [], favourites: [] });
});
afterEach(cleanup);

function picker(over: Partial<ColourPickerProps> = {}) {
  const props: ColourPickerProps = {
    open: true,
    anchor: document.body,
    what: "Prompt 7 · Launch email",
    initial: null,
    swatches: { recent: [], favourites: [] },
    onSwatches: vi.fn(),
    onPreview: vi.fn(),
    onDone: vi.fn(),
    onCancel: vi.fn(),
    phone: false,
    ...over,
  };
  render(<ColourPicker {...props} />);
  return props;
}

describe("the wheel's numbers", () => {
  it("turns a point on the wheel into a colour and back", () => {
    const radius = 84;
    for (const [h, s] of [
      [0, 70],
      [120, 35],
      [210, 50],
      [300, 10],
    ]) {
      const point = wheelPoint(h, s, radius);
      const back = wheelAt(point.x, point.y, radius);
      expect(back.h).toBeCloseTo(h, 5);
      expect(back.s).toBeCloseTo(s, 5);
      const hex = wheelHex(point.x, point.y, radius, 62);
      const hsl = hexToHsl(hex);
      expect(hslToHex({ h: hsl?.h ?? 0, s: hsl?.s ?? 0, l: hsl?.l ?? 0 })).toBe(hex);
    }
  });

  it("puts the centre at no saturation and anything past the rim on the rim", () => {
    expect(wheelAt(0, 0, 84).s).toBe(0);
    expect(wheelAt(500, 0, 84).s).toBe(SATURATION_MAX);
    expect(wheelPoint(30, 95, 84)).toEqual(wheelPoint(30, SATURATION_MAX, 84));
  });

  it("moves hue with left and right and saturation with up and down, by 2", () => {
    expect(wheelKey("ArrowRight", { h: 359, s: 10 })).toEqual({ h: 1, s: 10 });
    expect(wheelKey("ArrowLeft", { h: 0, s: 10 })).toEqual({ h: 358, s: 10 });
    expect(wheelKey("ArrowUp", { h: 0, s: 69 })).toEqual({ h: 0, s: 70 });
    expect(wheelKey("ArrowDown", { h: 0, s: 1 })).toEqual({ h: 0, s: 0 });
    expect(wheelKey("Enter", { h: 0, s: 1 })).toBeNull();
  });
});

describe("Recent and Favourites", () => {
  it("keeps Recent newest first, with no repeats, at most 8", () => {
    let recent: string[] = [];
    for (const hex of ["#111111", "#222222", "#111111"]) recent = withRecent(recent, hex);
    expect(recent).toEqual(["#111111", "#222222"]);
    for (let i = 0; i < 12; i += 1) recent = withRecent(recent, `#${String(i).padStart(2, "0")}0000`);
    expect(recent).toHaveLength(RECENT_MAX);
    expect(recent[0]).toBe("#110000");
    expect(recentAfterDone({ recent: ["#222222"], favourites: [] }, "#7fa7d9").recent).toEqual(["#7FA7D9", "#222222"]);
    expect(recentAfterDone({ recent: ["#222222"], favourites: [] }, null).recent).toEqual(["#222222"]);
  });

  it("adds a favourite, takes it away again, and stops at 24", () => {
    expect(toggleFavourite([], "#7fa7d9")).toEqual(["#7FA7D9"]);
    expect(toggleFavourite(["#7FA7D9"], "#7FA7D9")).toEqual([]);
    const full = Array.from({ length: FAVOURITES_MAX }, (_, i) => `#0000${String(i).padStart(2, "0")}`);
    expect(toggleFavourite(full, "#ABCDEF")).toEqual(full);
  });

  it("says Save as favourite, or Remove from favourites when it is one", () => {
    const onSwatches = vi.fn();
    picker({ initial: "#7FA7D9", onSwatches });
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.save }));
    expect(onSwatches).toHaveBeenCalledWith({ recent: [], favourites: ["#7FA7D9"] });
    cleanup();
    picker({ initial: "#7FA7D9", swatches: { recent: [], favourites: ["#7FA7D9"] } });
    expect(screen.getByRole("button", { name: COLOUR_PICKER_COPY.unsave })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: COLOUR_PICKER_COPY.favourites })).getByRole("button", { name: "#7FA7D9" })).toBeTruthy();
  });
});

describe("the picker", () => {
  it("heads itself with what it colours, and never chooses a colour for the maker", () => {
    const props = picker();
    expect(screen.getByText("Prompt 7 · Launch email")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: COLOUR_PICKER_COPY.hex }) as HTMLInputElement).value).toBe("");
    expect(props.onPreview).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  });

  it("draws the wheel pixel by pixel, and again when the lightness changes", () => {
    picker({ initial: "#7FA7D9" });
    const drawn = putImageData.mock.calls.length;
    expect(drawn).toBeGreaterThan(0);
    const slider = screen.getByRole("slider", { name: COLOUR_PICKER_COPY.lightness });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(putImageData.mock.calls.length).toBeGreaterThan(drawn);
    expect(LIGHTNESS_START).toBe(62);
  });

  it("moves on the wheel with the arrow keys, previewing each colour", () => {
    const props = picker({ initial: "#7FA7D9" });
    const wheel = screen.getByRole("slider", { name: COLOUR_PICKER_COPY.wheel });
    fireEvent.keyDown(wheel, { key: "ArrowRight" });
    const [colour] = (props.onPreview as ReturnType<typeof vi.fn>).mock.calls.at(-1) as [string];
    expect(colour).toMatch(/^#[0-9A-F]{6}$/);
    expect(hexToHsl(colour)?.h).toBeCloseTo((hexToHsl("#7FA7D9")?.h ?? 0) + 2, 0);
  });

  it("applies a typed code on Enter, and says how to write one when it is not a colour", () => {
    const props = picker();
    const field = screen.getByRole("textbox", { name: COLOUR_PICKER_COPY.hex });
    fireEvent.change(field, { target: { value: "7fa" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onPreview).toHaveBeenLastCalledWith("#77FFAA", false);
    fireEvent.change(field, { target: { value: "#12" } });
    fireEvent.blur(field);
    expect(screen.getByRole("alert").textContent).toBe("Use a code like #7FA7D9");
    expect(props.onPreview).toHaveBeenCalledTimes(1);
  });

  it("offers the six suggested colours, each named by its hex, ringed when it is the colour", () => {
    picker({ initial: LINKS_COLOURS.prompt });
    const row = screen.getByRole("group", { name: COLOUR_PICKER_COPY.suggested });
    expect(within(row).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["#C9A86B", "#7FB88A", "#7FA7D9", "#B79AD6", "#D98C8C", "#8FBFB8"]);
    expect(within(row).getByRole("button", { name: LINKS_COLOURS.prompt }).getAttribute("aria-pressed")).toBe("true");
  });

  it("moves along a row of swatches with the arrow keys", () => {
    picker();
    const row = screen.getByRole("group", { name: COLOUR_PICKER_COPY.suggested });
    const [first, second] = within(row).getAllByRole("button");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
  });

  it("puts the colour back on Cancel and on Escape, and keeps it on Done", () => {
    const props = picker({ initial: "#7FA7D9" });
    fireEvent.click(screen.getByRole("button", { name: "#D98C8C" }));
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.cancel }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("slider", { name: COLOUR_PICKER_COPY.wheel }), { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.done }));
    expect(props.onDone).toHaveBeenCalledWith("#D98C8C", false);
  });

  it("takes the colour off with No colour", () => {
    const props = picker({ initial: "#7FA7D9" });
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.none }));
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.done }));
    expect(props.onDone).toHaveBeenCalledWith(null, false);
  });

  it("offers Pick from the screen only where the browser can", () => {
    picker();
    expect(screen.queryByRole("button", { name: COLOUR_PICKER_COPY.screen })).toBeNull();
    cleanup();
    vi.stubGlobal("EyeDropper", class {
      open = async () => ({ sRGBHex: "#abcdef" });
    });
    picker();
    expect(screen.getByRole("button", { name: COLOUR_PICKER_COPY.screen })).toBeTruthy();
    vi.unstubAllGlobals();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  });

  it("asks a session whether to colour its tiles too, off to start", () => {
    const props = picker({ session: true });
    const box = screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoTiles }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(props.onPreview).toHaveBeenLastCalledWith(null, true);
    cleanup();
    picker();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("a session's tiles", () => {
  const build = linksBuild();
  const s2 = build.groups.find((group) => groupKey(group) === LINKS_S2);
  const s1 = build.groups.find((group) => groupKey(group) === LINKS_S1);

  it("are only the ones with no colour of their own", () => {
    expect(uncolouredTiles(build.steps, s1 ?? { stepNumbers: [] })).toEqual(["o-p1", "o-f1", "o-p3"]);
    expect(uncolouredTiles(build.steps, s2 ?? { stepNumbers: [] })).toEqual(["o-team", "o-lead", "o-build", "o-k1"]);
  });

  it("take the colour in the preview, and a coloured tile keeps its own", () => {
    const { steps, groups } = previewColours(build.steps, build.groups, { to: `session:${LINKS_S1}`, colour: "#8FBFB8", alsoTiles: true });
    expect(groups.find((group) => groupKey(group) === LINKS_S1)?.colour).toBe("#8FBFB8");
    expect(steps[0].colour).toBe("#8FBFB8");
    expect(steps[1].colour).toBe(LINKS_COLOURS.prompt);
    expect(steps[1].sentWith?.[0].colour).toBe(LINKS_COLOURS.code);
    expect(steps[1].sentWith?.[0].sentWith?.[0].colour).toBe("#8FBFB8");
  });

  it("are written on Done, each once, and no coloured one is touched", () => {
    const write = vi.fn();
    const setPreview = vi.fn();
    const { result } = renderHook(() => useColourPicking({ preview: null, setPreview, savedSteps: build.steps, savedGroups: build.groups, write, phone: false }));
    act(() => result.current.onColour(`session:${LINKS_S1}`, document.body, "Session 1", null));
    render(<>{result.current.picker}</>);
    fireEvent.click(screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoTiles }));
    fireEvent.click(screen.getByRole("button", { name: "#8FBFB8" }));
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.done }));
    expect(write.mock.calls).toEqual([
      [`session:${LINKS_S1}`, "#8FBFB8"],
      ["node:o-p1", "#8FBFB8"],
      ["node:o-f1", "#8FBFB8"],
      ["node:o-p3", "#8FBFB8"],
    ]);
  });

  it("Cancel writes nothing and drops the preview", () => {
    const write = vi.fn();
    const setPreview = vi.fn();
    const { result } = renderHook(() => useColourPicking({ preview: null, setPreview, savedSteps: build.steps, savedGroups: build.groups, write, phone: false }));
    act(() => result.current.onColour("node:o-p1", document.body, "Prompt 1", null));
    render(<>{result.current.picker}</>);
    fireEvent.click(screen.getByRole("button", { name: "#8FBFB8" }));
    expect(setPreview).toHaveBeenLastCalledWith({ to: "node:o-p1", colour: "#8FBFB8", alsoTiles: false });
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.cancel }));
    expect(setPreview).toHaveBeenLastCalledWith(null);
    expect(write).not.toHaveBeenCalled();
  });
});
