// CA-19 P7: the Colours window (board "References: groups and the Colours window", right): both lists and their order,
// the menu, merge with and without two links, the shared-code panel, saved colours and their menu, Clear all with its
// counts, and Undo after clearing.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureSwatchSaving } from "@/components/brand/useColourSwatches";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { REFS_LOGIN, REFS_PLUM, referencesMaking } from "@/dev/fixtures/references";
import { colourModelOf } from "@/lib/build/referenceGroups";
import ReferencesDemo from "@/pages/dev/ReferencesDemo";

import { andList, COLOURS_COPY, ColoursWindow, type ColoursWindowProps } from "./ColoursWindow";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

// jsdom has no DOMRect, which Radix's context menu asks for when it places itself at the pointer.
if (typeof globalThis.DOMRect === "undefined") {
  class Rect {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get top() { return this.y; }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get bottom() { return this.y + this.height; }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    static fromRect(rect: { x?: number; y?: number; width?: number; height?: number } = {}) { return new Rect(rect.x, rect.y, rect.width, rect.height); }
  }
  vi.stubGlobal("DOMRect", Rect);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined })) as never;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function inApp(children: ReactNode, url = "/dev/kit/pages/sandbox?build=references&swatches=filled") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function openColours() {
  inApp(<ReferencesDemo fit="content" viewport="desktop" />);
  fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
  fireEvent.click(await screen.findByTestId("view-colours"));
  return screen.getByTestId("colours-window");
}

const notice = () => screen.getByTestId("reference-notice").textContent ?? "";
const openMenu = (name: string) => fireEvent.keyDown(screen.getByRole("button", { name: `${name} options` }), { key: "Enter" });

describe("the lists", () => {
  it("opens from View › Colours…, with its head", async () => {
    const win = await openColours();
    expect(within(win).getByText("Colours")).toBeTruthy();
    expect(within(win).getByText("Every reference group and single colour in this build")).toBeTruthy();
  });

  it("lists the groups in the maker's order, then the single colours in the build's", async () => {
    const win = await openColours();
    const groups = within(win).getByTestId("colours-groups");
    expect(groups.textContent).toContain("2 · drag to set the order");
    expect([...groups.querySelectorAll("[data-colours-group]")].map((row) => row.textContent)).toEqual(["Login flow#7FB88A3 components · linked text", "No name#B79AD62 components"]);
    const singles = within(win).getByTestId("colours-singles");
    expect([...singles.querySelectorAll("[data-colours-single]")].map((row) => row.textContent)).toEqual([
      "APart A#8FBFB8",
      "2Data model#7FA7D9linked text",
      "6Landing page#7FA7D9",
      "BPart B#D98C8C",
      "S4Session 4#7FB88A",
      "S5Session 5#B79AD6",
    ]);
  });

  it("says when two single colours share a code, and makes them a group", async () => {
    const win = await openColours();
    const panel = within(win).getByTestId("colours-shared");
    expect(panel.textContent).toContain("Data model and Landing page share #7FA7D9 but are separate.");
    fireEvent.click(within(panel).getByRole("button", { name: "Make them a group" }));
    expect(notice()).toContain("Made a group of Manual step 2 and Manual step 6");
    await waitFor(() => expect(within(screen.getByTestId("colours-groups")).getByText("3 · drag to set the order")).toBeTruthy());
  });

  it("lists your saved colours, and removes one from its menu", async () => {
    const win = await openColours();
    const saved = within(win).getByTestId("colours-saved");
    expect(saved.textContent).toContain("On every build · right-click one to remove it");
    const before = saved.querySelectorAll("[data-saved-swatch]").length;
    fireEvent.contextMenu(saved.querySelector("[data-saved-swatch]") as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove from saved" }));
    expect(within(screen.getByTestId("colours-saved")).getAllByRole("button").length).toBe(before - 1);
  });
});

describe("a group's menu", () => {
  it("offers Open, Merge into… and Delete group…, and the row with its menu open is the tile", async () => {
    await openColours();
    openMenu("Login flow");
    expect(await screen.findByRole("menuitem", { name: "Open" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Merge into…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete group…" })).toBeTruthy();
    expect(document.querySelector(`[data-colours-group="${REFS_LOGIN}"]`)?.getAttribute("data-menu-open")).toBe("true");
  });

  it("deletes after asking", async () => {
    await openColours();
    openMenu("No name");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete group…" }));
    const confirm = screen.getByTestId("colours-delete-confirm");
    expect(within(confirm).getByText("Delete No name?")).toBeTruthy();
    act(() => void fireEvent.click(within(confirm).getByRole("button", { name: "Delete" })));
    expect(notice()).toContain("Deleted No name");
  });

  it("merges after asking, when only one has linked text", async () => {
    await openColours();
    openMenu("No name");
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Merge into…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Login flow" }));
    const confirm = screen.getByTestId("colours-merge-confirm");
    expect(within(confirm).getByText("Merge No name into Login flow?")).toBeTruthy();
    act(() => void fireEvent.click(within(confirm).getByRole("button", { name: "Merge" })));
    expect(notice()).toContain("Merged No name into Login flow");
    await waitFor(() => expect(within(screen.getByTestId("colours-groups")).getByText("1 · drag to set the order")).toBeTruthy());
  });
});

describe("merging two linked groups", () => {
  function windowWith(over: Partial<ColoursWindowProps>) {
    configureSwatchSaving(null);
    const props: ColoursWindowProps = {
      open: true,
      phone: false,
      model: colourModelOf(referencesMaking, []),
      refGroups: [],
      lookup: new Map(),
      isLinked: () => true,
      linkedWords: (to) => (to.endsWith(REFS_LOGIN) ? { words: "Signing in by email link", post: 2 } : { words: "the agent", post: 3 }),
      linkCount: 2,
      swatches: { recent: [], favourites: [] },
      onSwatches: vi.fn(),
      history: { canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn() },
      onOpenGroup: vi.fn(),
      onMerge: vi.fn(),
      onDelete: vi.fn(),
      onGroupThese: vi.fn(),
      onOrderGroups: vi.fn(),
      onOrderSingles: vi.fn(),
      onClearAll: vi.fn(),
      askKeep: vi.fn(),
      onClose: vi.fn(),
      ...over,
    };
    render(
      <ThemeProvider>
        <ColoursWindow {...props} />
      </ThemeProvider>,
    );
    return props;
  }

  it("asks which linked text to keep, with the words and their post", async () => {
    const props = windowWith({});
    openMenu("No name");
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Merge into…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Login flow" }));
    expect(props.askKeep).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Which linked text should Login flow keep?",
        action: "Merge",
        choices: [
          { key: "into", owner: "Login flow", words: "Signing in by email link", post: 2 },
          { key: "from", owner: "No name", words: "the agent", post: 3 },
        ],
      }),
    );
    const { run } = (props.askKeep as ReturnType<typeof vi.fn>).mock.calls[0][0] as { run: (key: string) => void };
    run("from");
    expect(props.onMerge).toHaveBeenCalledWith(REFS_PLUM, REFS_LOGIN, "from");
  });

  it("orders the groups by dragging", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const row = this.closest("[data-sortable]");
      const at = row ? [...(row.parentElement?.children ?? [])].indexOf(row) : 0;
      return { x: 0, y: at * 44, top: at * 44, left: 0, right: 560, bottom: at * 44 + 44, width: 560, height: 44, toJSON: () => ({}) } as DOMRect;
    });
    const props = windowWith({ isLinked: () => false });
    const grip = screen.getByRole("button", { name: "Move No name" });
    grip.focus();
    const settle = () => new Promise((done) => setTimeout(done, 20));
    for (const key of [" ", "ArrowUp", " "]) {
      await act(async () => {
        fireEvent.keyDown(grip, { key, code: key === " " ? "Space" : key });
        await settle();
      });
    }
    expect(props.onOrderGroups).toHaveBeenCalledWith([REFS_PLUM, REFS_LOGIN]);
  });
});

describe("clearing everything", () => {
  it("asks first with the counts, clears, and Undo puts it all back", async () => {
    const win = await openColours();
    fireEvent.click(within(win).getByTestId("colours-clear"));
    const confirm = screen.getByTestId("colours-clear-confirm");
    expect(within(confirm).getByText("Clear all colours and links?")).toBeTruthy();
    expect(confirm.textContent).toContain("Removes 2 groups, 6 single colours and 4 links. The words and components stay.");
    act(() => void fireEvent.click(within(confirm).getByRole("button", { name: "Clear all" })));
    expect(notice()).toContain("Cleared 4 links and 8 colours");
    await waitFor(() => expect(within(screen.getByTestId("colours-groups")).getByText(COLOURS_COPY.noGroups)).toBeTruthy());
    expect(document.querySelectorAll("[data-ref]").length).toBe(0);
    fireEvent.click(screen.getByTestId("notice-undo"));
    await waitFor(() => expect(within(screen.getByTestId("colours-groups")).getByText("2 · drag to set the order")).toBeTruthy());
    expect(document.querySelectorAll("span[data-ref]").length).toBeGreaterThan(0);
  });

  it("joins names in plain words", () => {
    expect(andList(["Data model"])).toBe("Data model");
    expect(andList(["Data model", "Landing page"])).toBe("Data model and Landing page");
    expect(andList(["A", "B", "C"])).toBe("A, B and C");
  });
});
