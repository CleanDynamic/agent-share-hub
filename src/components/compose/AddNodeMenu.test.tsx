// Acceptance cover for the Add-node menu's language (NS-P30 part four).
//
// The menu names what each type IS as well as what it is called, in the colour
// that means it. The label and the category both come off the registry row, so
// a type renamed or recategorised in node_types changes this menu with no code
// change. BG-P05 took the COLOUR off the row: it is resolved from the category
// through src/lib/theme/category.ts, so `node_types.colour` no longer reaches
// the screen and the six groups cannot drift into more than six hues.
//
// Radix opens its menu on a pointer event rather than a click, so the trigger
// is opened with the keyboard, which it also supports and which jsdom models
// honestly.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeType } from "@/lib/build";
import { AddNodeMenu } from "./AddNodeMenu";
import { categoryColour } from "@/lib/theme/category";

function makeType(key: string, label: string, category: string, colour: string, sort = 1): NodeType {
  return {
    key,
    label,
    category,
    colour,
    icon: null,
    renderer: category,
    copyable: false,
    is_active: true,
    sort,
    schema: { fields: [] },
  } as unknown as NodeType;
}

const TYPES = [
  makeType("prompt", "Prompt", "instruction", "#E8571A"),
  makeType("result", "Result", "evidence", "#2EC4B6"),
];

async function openMenu(nodeTypes: NodeType[] = TYPES, onAdd = vi.fn()) {
  render(<AddNodeMenu nodeTypes={nodeTypes} onAdd={onAdd} levelLabel="the build" />);
  const trigger = screen.getByRole("button", { name: /Add node/i });
  fireEvent.keyDown(trigger, { key: "Enter" });
  await waitFor(() => expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0));
  return { onAdd };
}

describe("AddNodeMenu", () => {
  it("says what each type is as well as what it is called", async () => {
    await openMenu();

    const prompt = screen.getByRole("menuitem", { name: /Prompt/ });
    expect(prompt).toHaveTextContent("Prompt");
    expect(prompt).toHaveTextContent("Instruction");

    const result = screen.getByRole("menuitem", { name: /Result/ });
    expect(result).toHaveTextContent("Evidence");
  });

  it("colours the category line from the category, not from the registry row", async () => {
    // BG-P05 reversed this. The menu used to paint each line with the row's own
    // `node_types.colour`; it now resolves the CATEGORY through the theme, so
    // the six groups are six hues and a row's stored hex is ignored. That the
    // resolver returns the right token is asserted in
    // src/lib/theme/category.test.ts; what is asserted here is that the stored
    // colour no longer reaches the DOM.
    await openMenu();

    const prompt = screen.getByRole("menuitem", { name: /Prompt/ });
    const line = within(prompt).getByText("Instruction");
    expect(line).not.toHaveStyle({ color: "#E8571A" });
    expect(categoryColour("instruction")).toBe("var(--cat-instruction)");

    const result = screen.getByRole("menuitem", { name: /Result/ });
    expect(within(result).getByText("Evidence")).not.toHaveStyle({ color: "#2EC4B6" });
    expect(categoryColour("evidence")).toBe("var(--cat-evidence)");
  });

  it("takes the label off the registry row and the colour off the category", async () => {
    // A type renamed in node_types renders as renamed, because nothing here
    // holds a second copy of the registry. A type RECOLOURED there does not
    // change colour: after BG-P05 the row's colour column is not read at all,
    // and two types in one category are one hue by construction.
    await openMenu([makeType("prompt", "The ask", "narrative", "#7C3AED")]);

    const item = screen.getByRole("menuitem", { name: /The ask/ });
    expect(item).toHaveTextContent("The ask");
    const line = within(item).getByText("Narrative");
    expect(line).not.toHaveStyle({ color: "#7C3AED" });
    expect(categoryColour("narrative")).toBe("var(--cat-narrative)");
  });

  it("still adds the type that was picked", async () => {
    const { onAdd } = await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /Result/ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("result"));
  });

  it("offers nothing for a registry with no active rows", () => {
    const retired = { ...makeType("prompt", "Prompt", "instruction", "#E8571A"), is_active: false };
    render(
      <AddNodeMenu nodeTypes={[retired as NodeType]} onAdd={vi.fn()} levelLabel="the build" />
    );
    expect(screen.getByText("No node types are available")).toBeInTheDocument();
  });
});
