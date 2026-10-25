// CA-06 P6 — Recent and Favourites follow the maker: what is read and what may be saved, the signed-in maker's own row
// only, the store reading once and saving after a moment, and the picker working with saving switched off.

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getUser = vi.fn();
const update = vi.fn();
const eqUpdate = vi.fn();
const select = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => getSession(), getUser: () => getUser() },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected table ${table}`);
      return {
        select: (columns: string) => {
          select(columns);
          return { eq: (_c: string, id: string) => ({ limit: () => ({ maybeSingle: async () => ({ data: { colour_swatches: { recent: ["#7fa7d9", "nope", "#7FA7D9"], favourites: ["#C9A86B"] }, id }, error: null }) }) }) };
        },
        update: (patch: unknown) => {
          update(patch);
          return { eq: async (column: string, id: string) => (eqUpdate(column, id), { error: null }) };
        },
      };
    },
  },
}));

import { COLOUR_PICKER_COPY, ColourPicker } from "@/components/brand/ColourPicker";
import { configureSwatchSaving, SAVE_DEBOUNCE_MS, useColourSwatches } from "@/components/brand/useColourSwatches";
import { FAVOURITES_MAX, RECENT_MAX } from "@/lib/theme/colourWheel";

import { getColourSwatches, saveColourSwatches, swatchesOf, swatchesRefusal } from "./colourSwatches";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

beforeEach(() => {
  // jsdom has no canvas: the wheel draws nothing, as on a browser without one.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  getUser.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: "me" } } } });
  update.mockReset();
  eqUpdate.mockReset();
  select.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const many = (n: number) => Array.from({ length: n }, (_, i) => `#0000${String(i).padStart(2, "0")}`);

describe("what is read", () => {
  it("keeps colours only, each once, in upper case, within the limits", () => {
    expect(swatchesOf({ recent: ["#7fa7d9", "blue", 3, "#7FA7D9", "abc"], favourites: "no" })).toEqual({ recent: ["#7FA7D9", "#AABBCC"], favourites: [] });
    expect(swatchesOf({ recent: many(12), favourites: many(30) })).toEqual({ recent: many(RECENT_MAX), favourites: many(FAVOURITES_MAX) });
    expect(swatchesOf(null)).toEqual({ recent: [], favourites: [] });
  });

  it("reads the signed-in maker's own row, and nothing when signed out", async () => {
    expect(await getColourSwatches()).toEqual({ recent: ["#7FA7D9"], favourites: ["#C9A86B"] });
    expect(select).toHaveBeenCalledWith("colour_swatches");
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await getColourSwatches()).toEqual({ recent: [], favourites: [] });
  });

  it("knows who is signed in from the stored session, never by asking the auth server (SV-03 P1)", async () => {
    await getColourSwatches();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe("what may be saved", () => {
  it("is two lists of #RRGGBB colours in upper case, at most 8 and 24", () => {
    expect(swatchesRefusal({ recent: ["#7FA7D9"], favourites: [] })).toBeNull();
    expect(swatchesRefusal({ recent: many(RECENT_MAX + 1), favourites: [] })).toBe("Recent holds at most 8 colours.");
    expect(swatchesRefusal({ recent: [], favourites: many(FAVOURITES_MAX + 1) })).toBe("Favourites hold at most 24 colours.");
    expect(swatchesRefusal({ recent: ["#7fa7d9"], favourites: [] })).toBe("A swatch is a colour written as #RRGGBB.");
    expect(swatchesRefusal({ recent: ["red"], favourites: [] })).toBe("A swatch is a colour written as #RRGGBB.");
  });

  it("writes the signed-in maker's row only", async () => {
    await saveColourSwatches({ recent: ["#7FA7D9"], favourites: ["#C9A86B"] });
    expect(update).toHaveBeenCalledWith({ colour_swatches: { recent: ["#7FA7D9"], favourites: ["#C9A86B"] } });
    expect(eqUpdate).toHaveBeenCalledWith("id", "me");
  });

  it("refuses a bad value before anything is sent", async () => {
    await expect(saveColourSwatches({ recent: ["teal"], favourites: [] })).rejects.toThrow("A swatch is a colour written as #RRGGBB.");
    await expect(saveColourSwatches({ recent: many(9), favourites: [] })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not save for a maker who is signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(saveColourSwatches({ recent: [], favourites: [] })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("the store", () => {
  it("reads once per visit, and saves 500ms after the last change", async () => {
    const load = vi.fn(async () => ({ recent: ["#7FA7D9"], favourites: [] }));
    const save = vi.fn(async () => undefined);
    configureSwatchSaving({ load, save });
    const first = renderHook(() => useColourSwatches());
    renderHook(() => useColourSwatches());
    await act(async () => undefined);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first.result.current[0].recent).toEqual(["#7FA7D9"]);

    vi.useFakeTimers();
    act(() => first.result.current[1]({ recent: ["#C9A86B", "#7FA7D9"], favourites: [] }));
    act(() => first.result.current[1]({ recent: ["#8FBFB8", "#C9A86B", "#7FA7D9"], favourites: [] }));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1));
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ recent: ["#8FBFB8", "#C9A86B", "#7FA7D9"], favourites: [] });
  });

  it("keeps working, quietly, when a save fails", async () => {
    const save = vi.fn(async () => {
      throw new Error("offline");
    });
    configureSwatchSaving({ load: async () => ({ recent: [], favourites: [] }), save });
    const { result } = renderHook(() => useColourSwatches());
    vi.useFakeTimers();
    act(() => result.current[1]({ recent: ["#7FA7D9"], favourites: [] }));
    await act(async () => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(save).toHaveBeenCalled();
    expect(result.current[0].recent).toEqual(["#7FA7D9"]);
  });
});

it("the picker works with saving switched off", () => {
  configureSwatchSaving(null, { recent: ["#7FA7D9"], favourites: ["#C9A86B"] });
  function Harness() {
    const [swatches, setSwatches] = useColourSwatches();
    return <ColourPicker open anchor={document.body} what="Prompt 1" initial={null} swatches={swatches} onSwatches={setSwatches} onPreview={() => undefined} onDone={() => undefined} onCancel={() => undefined} phone={false} />;
  }
  render(<Harness />);
  expect(screen.getByRole("group", { name: COLOUR_PICKER_COPY.recent })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "#8FBFB8" }));
  fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.saveThis }));
  expect(screen.getAllByRole("button", { name: "#8FBFB8" })).toHaveLength(2);
  expect(update).not.toHaveBeenCalled();
});
