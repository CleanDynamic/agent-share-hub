// Acceptance cover for the Add-node menu's language (NS-P30 part four).
//
// The menu names what each type IS as well as what it is called, in the colour
// that means it. Both halves come off the registry row — label and category —
// so a type renamed or recoloured in node_types changes this menu with no code
// change, exactly as the rest of the component already promises.
//
// Radix opens its menu on a pointer event rather than a click, so the trigger
// is opened with the keyboard, which it also supports and which jsdom models
// honestly.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NodeType } from "@/lib/build";
import { AddNodeMenu } from "./AddNodeMenu";

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

  it("colours the category line with the type's own colour", async () => {
    await openMenu();

    const prompt = screen.getByRole("menuitem", { name: /Prompt/ });
    const line = within(prompt).getByText("Instruction");
    expect(line).toHaveStyle({ color: "#E8571A" });

    const result = screen.getByRole("menuitem", { name: /Result/ });
    expect(within(result).getByText("Evidence")).toHaveStyle({ color: "#2EC4B6" });
  });

  it("takes both halves off the registry row and invents neither", async () => {
    // A type renamed and recoloured in node_types renders as renamed and
    // recoloured, because nothing here holds a second copy of the registry.
    await openMenu([makeType("prompt", "The ask", "narrative", "#9CA3AF")]);

    const item = screen.getByRole("menuitem", { name: /The ask/ });
    expect(item).toHaveTextContent("The ask");
    expect(within(item).getByText("Narrative")).toHaveStyle({ color: "#9CA3AF" });
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
