/* Synth 09: the editor's titled text boxes (kept on the node, drawn on the tile, opened in the notepad), the selection ring
   that a maker's colour never replaces, and the modal pieces the prompt adds (pills, choice cards, the footer's own line). */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BOX_TITLE_MAX, boxTitlesOf, withBoxTitles } from "@/lib/build/graph";
import { borderFor } from "@/lib/theme/partColour";
import { SELECT_RING } from "@/lib/theme/refinedControl";

import { ModalForm } from "./ModalFrame";
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
