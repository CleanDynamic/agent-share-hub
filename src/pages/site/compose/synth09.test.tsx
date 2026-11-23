/* Synth 09: the editor's titled text boxes (kept on the node, drawn on the tile, opened in the notepad), the selection ring
   that a maker's colour never replaces, and the modal pieces the prompt adds (pills, choice cards, the footer's own line). */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ReadSection } from "@/lib/build/tileSections";
import { borderFor } from "@/lib/theme/partColour";
import { SELECT_RING } from "@/lib/theme/refinedControl";

import { ModalForm, ModalShell } from "./ModalFrame";
import { OpenRequestDialog } from "./OpenRequestDialog";
import { ConfirmDialog } from "./referencePieces";
import { LAYER } from "./layers";
import { WINDOW_TOP } from "./modalRecipes";
import { ChoiceCards, FieldArea, SegmentedField } from "./modalRecipes";
import { NumberBadge, tileStyle } from "./tileRecipes";

describe("the tile", () => {
  it("is a Card at radius 12, padded 12 14, with the Mint ring outside a gap when chosen", () => {
    expect(tileStyle(false)).toMatchObject({ padding: "12px 14px", borderRadius: "var(--r-panel)" });
    expect(tileStyle(false).boxShadow).toBeUndefined();
    expect(tileStyle(true).boxShadow).toBe(SELECT_RING);
    expect(SELECT_RING).toBe("0 0 0 2px var(--surface), 0 0 0 4px var(--brand-accent)");
  });

  it("draws a maker's colour as its border and a 35% inset, at the theme's edge width", () => {
    expect(borderFor("#3366FF")).toEqual({ borderColor: "#3366FF", borderWidth: "var(--maker-edge)", boxShadow: "inset 0 0 0 1px rgba(51,102,255,0.35)" });
  });

  it("fills the number box Mint while the tile is chosen", () => {
    const off = renderToStaticMarkup(<NumberBadge>3</NumberBadge>);
    const on = renderToStaticMarkup(<NumberBadge selected>3</NumberBadge>);
    expect(off).not.toContain("var(--brand-accent)");
    expect(on).toContain("background:var(--brand-accent)");
    expect(on).toContain("color:var(--on-brand-accent)");
  });

  it("draws no title rows under a tile's title (the first-draft rows are gone)", async () => {
    const { BuildList } = await import("./BuildList");
    const { sandboxListProps } = await import("@/dev/fixtures/sandbox");
    const { MemoryRouter } = await import("react-router-dom");
    const props = sandboxListProps("bakery");
    // An old build may still hold box titles in its payload: nothing reads them any more.
    const steps = props.steps.map((step, at) => (at === 0 ? ({ ...step, boxTitles: [{ field: "Response", title: "First draft" }] } as typeof step) : step));
    render(
      <MemoryRouter>
        <BuildList {...props} steps={steps} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("tile-box-rows")).toBeNull();
    expect(screen.queryByText("First draft")).toBeNull();
  });
});

describe("a window's text boxes (no titles)", () => {
  it("draws a box with its Expand button and no title field, and the notepad has no title either", async () => {
    render(<FieldArea phone={false} rows={3} aria-label="Response" defaultValue="Hello" />);
    expect(screen.queryByText("Title · optional")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Response title" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open in the notepad" }));
    const pad = await screen.findByTestId("notepad");
    expect(within(pad).queryByTestId("notepad-title")).toBeNull();
  });
});

describe("modal pieces", () => {
  it("draws a single choice as pills that wrap, the chosen one on the action fill", () => {
    render(<SegmentedField label="Permissions" phone={false} value="read" onChange={() => undefined} items={[{ value: "read", label: "Read only" }, { value: "write", label: "Read and write" }, { value: "delegated", label: "Acts as the maker" }]} />);
    const group = screen.getByRole("radiogroup", { name: "Permissions" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Read only", "Read and write", "Acts as the maker"]);
    expect(getComputedStyle(group).flexWrap).toBe("wrap");
    expect(within(group).getByRole("radio", { name: "Read only" })).toHaveAttribute("aria-checked", "true");
  });

  it("draws the agent's kinds as cards; one not available yet is disabled and says so", () => {
    render(<ChoiceCards label="Type" phone={false} value="agent" onChange={() => undefined} items={[{ value: "agent", label: "Single agent" }, { value: "team", label: "Multi-agent team", disabled: true, line: "Not available yet" }]} />);
    const team = screen.getByRole("radio", { name: /Multi-agent team/ });
    expect(team).toBeDisabled();
    expect(team).toHaveTextContent("Not available yet");
    expect(team.style.opacity).toBe("0.55");
    expect(screen.getByRole("radio", { name: "Single agent" })).toHaveAttribute("aria-checked", "true");
  });

  it("says the window's own footer line in place of the required list", () => {
    render(
      <ModalForm phone={false} missing="App" status="Required: an application" onSubmit={() => undefined} onCancel={() => undefined}>
        <span />
      </ModalForm>,
    );
    expect(screen.getByTestId("modal-status")).toHaveTextContent("Required: an application");
  });
});

describe("where every editor window stands", () => {
  const placed = (el: HTMLElement) => el.getAttribute("style") ?? "";

  it("puts a tile's window, Mark still open and a confirmation in one place, 440 wide, each on its layer", () => {
    render(
      <ModalShell open onOpenChange={() => undefined} title="Add a tool" subtitle="External app the model used" testId="tile-window">
        <span />
      </ModalShell>,
    );
    render(<OpenRequestDialog open title="Still open: Session 2" onClose={() => undefined} onSubmit={() => undefined} />);
    render(<ConfirmDialog open title="Clear all colours and links?" body="Removes them." action="Clear all" onConfirm={() => undefined} onCancel={() => undefined} testId="confirm-window" />);
    const windows: [string, number][] = [["tile-window", LAYER.window], ["open-request-dialog", LAYER.window], ["confirm-window", LAYER.confirm]];
    for (const [id, layer] of windows) {
      const style = placed(screen.getByTestId(id));
      expect(style, id).toContain(`top: ${WINDOW_TOP}px`);
      expect(style, id).toContain("transform: translateX(-50%)");
      expect(style, id).toContain("width: 440px");
      expect(style, id).toContain(`max-height: calc(100dvh - ${2 * WINDOW_TOP}px)`);
      expect(style, id).toContain(`z-index: ${layer}`);
    }
  });

  it("orders the layers: windows, the prompt window, confirmations, menus, the notepad, the notice", () => {
    const order = [LAYER.window, LAYER.promptWindow, LAYER.confirm, LAYER.floating, LAYER.floatingOver, LAYER.notepad, LAYER.notice];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("says nothing is missing until Mark still open is pressed empty, then says what to write", () => {
    const onSubmit = vi.fn();
    render(<OpenRequestDialog open title="Still open: Session 2" onClose={() => undefined} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark still open" }));
    expect(screen.getByRole("alert").textContent).toBe("Say what's missing.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "What's missing" }), { target: { value: "  Deploy the worker " } });
    fireEvent.click(screen.getByRole("button", { name: "Mark still open" }));
    expect(onSubmit).toHaveBeenCalledWith("Deploy the worker");
  });
});

describe("the status line's ready count, and the notepad's Done", () => {
  it("says how many required items are done", async () => {
    const { readyLine } = await import("@/lib/build/publishChecklist");
    expect(readyLine({ required: [{}, {}, {}, {}] as never, openRequired: 2 })).toBe("2 of 4 ready to publish");
    expect(readyLine({ required: [], openRequired: 0 })).toBeNull();
  });

  it("in a window that saves as it goes, Done in the notepad leaves the box so its own save runs", async () => {
    const onBlur = vi.fn();
    render(<FieldArea phone={false} rows={3} aria-label="Response" defaultValue="Hello" onBlur={onBlur} />);
    fireEvent.click(screen.getByRole("button", { name: "Open in the notepad" }));
    const pad = await screen.findByTestId("notepad");
    await act(async () => {
      fireEvent.click(within(pad).getByRole("button", { name: "Done" }));
    });
    await waitFor(() => expect(onBlur).toHaveBeenCalled());
  });
});

describe("the title row's Add", () => {
  it("is a secondary Add with a chevron that opens the same menu as a session's Add step, and adds to the current session", async () => {
    const { AddMenu } = await import("./SandboxView");
    const { everyEntry } = await import("./addMenuTestSupport");
    const props = everyEntry();
    render(<AddMenu phone={false} variant="title" {...props} />);
    const add = screen.getByTestId("title-add");
    expect(add.textContent).toBe("Add");
    expect(screen.queryByTestId("add-to-session")).toBeNull();
    expect(screen.queryByTestId("sandbox-add")).toBeNull();
    fireEvent.keyDown(add, { key: "Enter" });
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /^Tool/ }));
    expect(props.onAddTool).toHaveBeenCalledTimes(1);
  });
});

describe("a step tile's content, on the notepad's tone", () => {
  it("leaves out what the tile's body draws and the reverse links, and keeps the window's order", async () => {
    const { tileSectionsOf } = await import("./tileContent");
    const section = (key: string) => ({ key, label: key, value: { type: "prose" as const, text: key, count: "" } });
    const sections = ["prompt", "response", "model", "uses", "goesInto", "settings", "variables"].map(section);
    expect(tileSectionsOf("prompt", sections).map((s) => s.key)).toEqual(["model", "settings", "variables"]);
    expect(tileSectionsOf("tool", ["tool", "connected", "did", "permissions", "plan", "usedBy"].map(section)).map((s) => s.key)).toEqual(["permissions", "plan"]);
  });

  it("draws every other section the window holds on the layer, under the tile's own body", async () => {
    const { BuildList } = await import("./BuildList");
    const { sandboxListProps } = await import("@/dev/fixtures/sandbox");
    const { MemoryRouter } = await import("react-router-dom");
    const props = sandboxListProps("bakery");
    const first = props.steps[0];
    const sectionsOf = (id: string): ReadSection[] =>
      id === first.id
        ? [
            { key: "prompt", label: "Prompt", value: { type: "prose" as const, text: first.text, count: "" } },
            { key: "settings", label: "Model settings", value: { type: "rows" as const, rows: [{ label: "Reasoning effort", value: "High" }], count: "" } },
            { key: "goesInto", label: "Used by", value: { type: "prose" as const, text: "Prompt 2", count: "" } },
          ]
        : [];
    render(
      <MemoryRouter>
        <BuildList {...props} sectionsOf={sectionsOf} />
      </MemoryRouter>,
    );
    const tile = screen.getAllByTestId("step-card").find((card) => card.querySelector('[data-testid="prompt-tile-text"]'))!;
    const layer = within(tile).getByTestId("tile-content");
    // jsdom drops a var() colour from a rendered style: the layer's fill is read from its recipe.
    const { CONTENT_WELL } = await import("./tileContent");
    expect(CONTENT_WELL.background).toBe("var(--notepad)");
    expect(layer).toBeTruthy();
    // The prompt's words are on the layer, then the section the body does not draw; "Used by" is left to Details.
    expect(within(layer).getByTestId("prompt-tile-text").textContent).toContain(first.text.slice(0, 20));
    expect(within(layer).getAllByTestId("tile-section").map((el) => el.getAttribute("data-section"))).toEqual(["settings"]);
    expect(within(layer).getByTestId("tile-row").textContent).toBe("Reasoning effortHigh");
  });

  it("draws no layer on a tile with nothing to show", async () => {
    const { ContentWell } = await import("./tileContent");
    const { container } = render(<ContentWell watch={1}><span /></ContentWell>);
    expect(container.querySelector('[data-testid="tile-content"]')).toBeNull();
  });
});
