// UX-06 Part 6: the Line up steps table: real table markup with a caption and header cells, a changed step outlined with a
// visually hidden "changed", a still-open step as a dashed slot, an empty cell where a build has no step, and the one sentence.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LineUpTable, LineUpToggle } from "./LineUpSteps";
import type { LineUp } from "./postModel";

const person = (id: string) => ({ id, name: id, handle: id, avatarUrl: null });
const lineUp: LineUp = {
  steps: 3,
  rows: [
    { key: "post", name: "The post", author: person("sam"), cells: [{ title: "Take the CV", changed: false, open: false }, { title: "Rubric", changed: false, open: false }, null], finished: true },
    { key: "kit", name: "@kit", author: person("kit"), cells: [{ title: "Take the CV", changed: false, open: false }, { title: "Rubric", changed: true, open: false }, { title: "Email", changed: true, open: false }], finished: true },
    { key: "jo", name: "@jo", author: person("jo"), cells: [{ title: "Take the CV", changed: false, open: false }, { title: "Rubric", changed: false, open: true }, null], finished: false },
  ],
  sentence: "1 of 1 finished build changed Step 2.",
};

describe("Line up steps", () => {
  it("is a table with a caption, column headers for the build and each step, and row headers for each build", () => {
    render(<LineUpTable lineUp={lineUp} />);
    const table = screen.getByRole("table", { name: /Where the builds differ/ });
    expect(table.querySelector("caption")).not.toBeNull();
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Build", "Step 1", "Step 2", "Step 3"]);
    const rows = within(table).getAllByRole("rowheader");
    expect(rows).toHaveLength(3);
    ["The post", "@kit", "@jo"].forEach((name, at) => expect(rows[at]).toHaveTextContent(name));
    expect(screen.getByRole("heading", { name: "Where the builds differ" })).toBeInTheDocument();
    expect(screen.getByText("Each row is a build. Steps that changed are outlined.")).toBeInTheDocument();
  });

  it("outlines a changed step and says so to a screen reader, draws an open step dashed, and leaves a missing one empty", () => {
    render(<LineUpTable lineUp={lineUp} />);
    const [, kit, jo] = screen.getAllByRole("row").slice(1);
    const kitCells = within(kit).getAllByRole("cell");
    expect(kitCells[1].querySelector('[data-changed="true"]')).toHaveStyle({ border: "1px solid var(--selected-edge)", background: "var(--selected-fill)" });
    expect(kitCells[1]).toHaveTextContent("Rubric changed");
    expect(kitCells[0].querySelector('[data-changed="true"]')).toBeNull();
    const joCells = within(jo).getAllByRole("cell");
    expect(joCells[1].querySelector('[data-ui="dashed-slot"]')).not.toBeNull();
    expect(joCells[2]).toBeEmptyDOMElement();
  });

  it("states the one fact under the table", () => {
    render(<LineUpTable lineUp={lineUp} />);
    expect(screen.getByText("1 of 1 finished build changed Step 2.")).toBeInTheDocument();
  });

  it("is switched by a labelled checkbox", () => {
    const onChange = vi.fn();
    render(<LineUpToggle on={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Line up steps" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
