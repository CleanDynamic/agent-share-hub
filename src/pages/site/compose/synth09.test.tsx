/* Synth 09: the editor's titled text boxes (kept on the node, drawn on the tile, opened in the notepad), the selection ring
   that a maker's colour never replaces, and the modal pieces the prompt adds (pills, choice cards, the footer's own line). */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BOX_TITLE_MAX, boxTitlesOf, withBoxTitles } from "@/lib/build/graph";
import { borderFor } from "@/lib/theme/partColour";
import { SELECT_RING } from "@/lib/theme/refinedControl";

import { ModalForm, ModalShell } from "./ModalFrame";
import { OpenRequestDialog } from "./OpenRequestDialog";
import { ConfirmDialog } from "./referencePieces";
import { LAYER } from "./layers";
import { WINDOW_TOP } from "./modalRecipes";
import { BoxTitleSinkContext, ChoiceCards, FieldArea, SegmentedField } from "./modalRecipes";
import { BoxRow, NumberBadge, tileStyle } from "./tileRecipes";

describe("box titles on the node", () => {
  it("reads the titled boxes, trimmed, and leaves out blank and malformed ones", () => {
    expect(boxTitlesOf({ box_titles: { Instructions: "  Tone  ", Setup: "", Notes: 3 } })).toEqual([{ field: "Instructions", title: "Tone" }]);
    expect(boxTitlesOf({ box_titles: ["no"] })).toEqual([]);
    expect(boxTitlesOf({})).toEqual([]);
  });

  it("merges new titles over the old, takes a blank one off, and keeps the rest of the payload", () => {
    const payload = { colour: "#FF0000", box_titles: { Instructions: "Tone", Setup: "Keys" } };
    expect(withBoxTitles(payload, { Setup: "", Steps: "Order" })).toEqual({ colour: "#FF0000", box_titles: { Instructions: "Tone", Steps: "Order" } });
    expect(withBoxTitles({ box_titles: { Setup: "Keys" } }, { Setup: " " })).toEqual({});
  });

  it("keeps a title to its limit", () => {
    expect(withBoxTitles({}, { Text: "x".repeat(BOX_TITLE_MAX + 20) })).toEqual({ box_titles: { Text: "x".repeat(BOX_TITLE_MAX) } });
  });
});

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

  it("shows a titled box as a row on Raised that opens it", () => {
    const onOpen = vi.fn();
    render(<BoxRow title="Tone" field="Instructions" onOpen={onOpen} />);
    const row = screen.getByRole("button", { name: "Tone, Instructions: open in the notepad" });
    expect(row.textContent).toBe("Tone");
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<BoxRow title="Tone" field="Instructions" onOpen={onOpen} />)).toContain("background:var(--control)");
  });
});

describe("a window's box titles", () => {
  function Window({ commit, seed, expand, onSubmit = () => undefined }: { commit: (titles: Record<string, string>) => void; seed?: Record<string, string>; expand?: string; onSubmit?: () => void }) {
    return (
      <BoxTitleSinkContext.Provider value={{ commit, seed, expand }}>
        <ModalForm phone={false} missing={null} onSubmit={onSubmit} onCancel={() => undefined}>
          <FieldArea phone={false} rows={3} aria-label="Instructions" defaultValue="Be brief." />
        </ModalForm>
      </BoxTitleSinkContext.Provider>
    );
  }

  it("starts from the tile's title and hands every box's title over when it is saved", () => {
    const commit = vi.fn();
    const onSubmit = vi.fn();
    render(<Window commit={commit} onSubmit={onSubmit} seed={{ Instructions: "Tone" }} />);
    const title = screen.getByRole("textbox", { name: "Instructions title" });
    expect(title).toHaveValue("Tone");
    fireEvent.change(title, { target: { value: "Voice" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(commit).toHaveBeenCalledWith({ Instructions: "Voice" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hands nothing over when it is cancelled", () => {
    const commit = vi.fn();
    render(<Window commit={commit} seed={{ Instructions: "Tone" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(commit).not.toHaveBeenCalled();
  });

  it("opens the box the tile asked for in the notepad, and Done saves the window", async () => {
    const commit = vi.fn();
    const onSubmit = vi.fn();
    render(<Window commit={commit} onSubmit={onSubmit} seed={{ Instructions: "Tone" }} expand="Instructions" />);
    const pad = await screen.findByTestId("notepad");
    expect(within(pad).getByText("Instructions")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(pad).getByRole("button", { name: "Done" }));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(commit).toHaveBeenCalledWith({ Instructions: "Tone" });
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

describe("the status line's ready count and live titles", () => {
  it("says how many required items are done", async () => {
    const { readyLine } = await import("@/lib/build/publishChecklist");
    expect(readyLine({ required: [{}, {}, {}, {}] as never, openRequired: 2 })).toBe("2 of 4 ready to publish");
    expect(readyLine({ required: [], openRequired: 0 })).toBeNull();
  });

  it("in a window that saves as it goes, writes a box's title when its title field is left", () => {
    const onTitle = vi.fn();
    render(
      <BoxTitleSinkContext.Provider value={{ onTitle, seed: { Response: "Draft" } }}>
        <FieldArea phone={false} rows={3} aria-label="Response" defaultValue="Hello" />
      </BoxTitleSinkContext.Provider>,
    );
    const title = screen.getByRole("textbox", { name: "Response title" });
    expect(title).toHaveValue("Draft");
    fireEvent.change(title, { target: { value: "Final" } });
    fireEvent.blur(title);
    expect(onTitle).toHaveBeenCalledWith("Response", "Final");
  });

  it("there, Done in the notepad leaves the box so its own save runs", async () => {
    const onBlur = vi.fn();
    render(
      <BoxTitleSinkContext.Provider value={{ expand: "Response" }}>
        <FieldArea phone={false} rows={3} aria-label="Response" defaultValue="Hello" onBlur={onBlur} />
      </BoxTitleSinkContext.Provider>,
    );
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
