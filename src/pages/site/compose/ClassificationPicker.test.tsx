import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { valueOf, type TaxonomyValue } from "@/lib/classify/taxonomy";
import type { Entry } from "@/lib/classify/types";

import { AT_LIMIT, ClassificationPicker, OWN_ENTRY_NOTE, withPrimary, type ClassificationPickerProps } from "./ClassificationPicker";

afterEach(cleanup);

function Harness(props: Partial<ClassificationPickerProps> & { initial?: Entry[]; onEntries?: (entries: Entry[]) => void }) {
  const [entries, setEntries] = useState<Entry[]>(props.initial ?? []);
  return (
    <ClassificationPicker
      id="pick"
      facet="field"
      label="Field"
      phone={false}
      {...props}
      entries={entries}
      onChange={(next) => {
        setEntries(next);
        props.onEntries?.(next);
      }}
    />
  );
}

const suggestion = (facet: "field" | "task", id: string) => valueOf(facet, id) as TaxonomyValue;
const input = () => screen.getByRole("combobox", { name: "Field" }) as HTMLInputElement;
const type = (value: string) => {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value } });
};

describe("ClassificationPicker: combobox", () => {
  it("is a combobox that opens a listbox of at most 8 options, with the matching part in weight 600 and a path in mono", () => {
    render(<Harness />);
    expect(input().getAttribute("aria-expanded")).toBe("false");
    type("e");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("listbox");
    expect(input().getAttribute("aria-controls")).toBe(list.id);
    expect(within(list).getAllByRole("option").length).toBeLessThanOrEqual(9);
    type("hybrid");
    const first = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(first.textContent).toContain("Hybrid search");
    expect(first.textContent).toContain("AI and machine learning › Retrieval systems › Hybrid search");
    const bold = first.querySelector("span[style*='font-weight: 600']");
    expect(bold?.textContent?.toLowerCase()).toBe("hybrid");
  });

  it("moves with the arrow keys, announces the active option and picks with Enter", () => {
    const onEntries = vi.fn();
    render(<Harness onEntries={onEntries} />);
    type("retr");
    const options = screen.getAllByRole("option");
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0].id);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option").at(-1)?.id);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onEntries).toHaveBeenCalledTimes(1);
    expect((onEntries.mock.calls[0][0] as Entry[])[0]).toHaveProperty("id");
    expect(input().value).toBe("");
  });

  it("clears the text and closes on Escape", () => {
    render(<Harness />);
    type("retr");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("offers the maker's own entry last, with its note, and stores it trimmed to 60 characters", () => {
    const onEntries = vi.fn();
    render(<Harness onEntries={onEntries} />);
    const long = `${"Bee keeping ".repeat(8)}end`;
    type(long);
    const options = screen.getAllByRole("option");
    const last = options[options.length - 1];
    expect(last.textContent).toContain("Add \u201C");
    expect(last.textContent).toContain("as your own entry");
    expect(last.textContent).toContain(OWN_ENTRY_NOTE);
    fireEvent.click(last);
    const stored = (onEntries.mock.calls[0][0] as Entry[])[0] as { custom: string };
    expect(stored.custom.length).toBe(60);
    expect(stored.custom).toBe(long.trim().slice(0, 60));
  });

  it("offers no own entry when the text is an exact label", () => {
    render(<Harness />);
    type("Dentistry");
    expect(screen.getAllByRole("option").some((o) => o.textContent?.includes("as your own entry"))).toBe(false);
  });
});

describe("ClassificationPicker: chips, suggestions and limits", () => {
  it("shows chosen Field values as their full path with a remove button, and a custom one with a dashed edge", () => {
    const onEntries = vi.fn();
    render(<Harness initial={[{ id: "ai-ml.retrieval.hybrid-search" }, { custom: "Bee keeping" }]} onEntries={onEntries} />);
    const chosen = screen.getByRole("list", { name: "Field, chosen" });
    expect(within(chosen).getByText("AI and machine learning › Retrieval systems › Hybrid search")).toBeTruthy();
    const custom = within(chosen).getByText("Bee keeping").closest("li") as HTMLElement;
    expect(custom.style.borderStyle).toBe("dashed");
    fireEvent.click(within(chosen).getByRole("button", { name: "Remove Bee keeping" }));
    expect(onEntries).toHaveBeenCalledWith([{ id: "ai-ml.retrieval.hybrid-search" }]);
  });

  it("shows up to three suggestions as dashed chips, pre-selects nothing, and adds one on press", () => {
    const onEntries = vi.fn();
    const suggestions = ["law", "education", "medicine", "social"].map((id) => suggestion("field", id));
    render(<Harness suggestions={suggestions} onEntries={onEntries} />);
    const list = screen.getByRole("list", { name: "Field, suggestions" });
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Field, chosen" })).toBeNull();
    fireEvent.click(within(list).getByRole("button", { name: "Add Law" }));
    expect(onEntries).toHaveBeenCalledWith([{ id: "law" }]);
    expect(within(screen.getByRole("list", { name: "Field, suggestions" })).queryByRole("button", { name: "Add Law" })).toBeNull();
  });

  it("stops at the limit and says how to add another", () => {
    render(<Harness max={2} initial={[{ id: "law" }, { id: "education" }]} suggestions={[suggestion("field", "medicine")]} />);
    expect(input().disabled).toBe(true);
    expect(input().placeholder).toBe(AT_LIMIT);
    expect(screen.queryByRole("list", { name: "Field, suggestions" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove Law" }));
    expect(input().disabled).toBe(false);
  });

  it("makes the first Task primary, and a chip menu changes it", () => {
    const onEntries = vi.fn();
    render(<Harness facet="task" label="Task" primary max={3} initial={withPrimary([{ id: "create.writing" }, { id: "find.literature-review" }])} onEntries={onEntries} />);
    expect(screen.getAllByText("Primary")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Options for Literature review" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Make primary" }));
    expect(onEntries).toHaveBeenCalledWith([{ id: "find.literature-review", primary: true }, { id: "create.writing" }]);
  });

  it("gives chips and options 44 high targets on a phone", () => {
    render(<Harness phone initial={[{ id: "law" }]} />);
    expect((screen.getByRole("button", { name: "Remove Law" }) as HTMLElement).style.minHeight).toBe("44px");
    expect(input().style.height).toBe("44px");
  });
});
