// UX-02 P6: the Add step tile menu, rendered: Prompt first, then every entry under the head of its node type's category (from the
// fallback table, and from a registry that differs), a group of one with no head, not-live entries left out, Check listed while it
// cannot be added, Deployment closed until opened, From Library last, and drawn before the registry has been read.

import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { everyEntry, openAddMenu } from "./addMenuTestSupport";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** F40: the menu with More types opened, so every type is listed. */
const openAll = (props: Parameters<typeof openAddMenu>[0]) => {
  const menu = openAddMenu(props);
  fireEvent.click(within(menu).getByTestId("add-more-types"));
  return menu;
};

const groupsOf = (menu: HTMLElement) =>
  Object.fromEntries(within(menu).getAllByTestId("add-group").map((group) => [group.getAttribute("data-head"), within(group).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)]));

describe("UX-02 P6 · the Add step tile menu", () => {
  it("F40: the first screen is Prompt, Agent, Tool, File, Dataset, then More types, then From Library", () => {
    const menu = openAddMenu(everyEntry());
    const items = within(menu).getAllByRole("menuitem").map((item) => item.firstChild?.textContent);
    expect(items).toEqual(["Prompt", "Agent", "Tool", "File", "Dataset", "More types", "From Library"]);
    expect(within(menu).queryByTestId("add-group")).toBeNull();
    expect(within(menu).getByTestId("add-more-types").getAttribute("aria-expanded")).toBe("false");
  });

  it("before the registry is read: More types opens in place on the fallback table's groups", () => {
    const menu = openAddMenu(everyEntry());
    fireEvent.click(within(menu).getByTestId("add-more-types"));
    expect(within(menu).getByTestId("add-more-types").getAttribute("aria-expanded")).toBe("true");
    const items = within(menu).getAllByRole("menuitem").map((item) => item.firstChild?.textContent);
    expect(items[0]).toBe("Prompt");
    expect(groupsOf(menu)).toEqual({
      Artefact: ["Code", "GitHub repository"],
      Evidence: ["Result", "Check"],
      Narrative: ["Manual step", "Approval"],
    });
    // F40: Decision sits with the ungrouped entries (no group holds both Check and Approval); Retrieval and System prompt are groups of one.
    expect(within(within(menu).getByTestId("add-loose")).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)).toEqual(["Retrieval", "Decision", "System prompt"]);
    expect(within(menu).queryByText("Instruction")).toBeNull();
    // From Library last.
    expect(items[items.length - 1]).toBe("From Library");
  });

  it("from a registry that differs: its categories win", () => {
    const menu = openAll({ ...everyEntry(), nodeCategories: { code: "data", result: "narrative" } });
    expect(groupsOf(menu).Data).toEqual(["Retrieval", "Code"]);
    expect(groupsOf(menu).Narrative).toEqual(["Result", "Manual step", "Approval"]);
    // F40: Decision stays with the ungrouped entries whatever the registry says; Artefact and Evidence are left with one each.
    expect(within(within(menu).getByTestId("add-loose")).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)).toEqual(["GitHub repository", "Check", "Decision", "System prompt"]);
  });

  it("leaves out entries that are not live, and a group with none", () => {
    const menu = openAll({ ...everyEntry(), retrievalAvailable: false, datasetAvailable: false, systemPromptAvailable: false, repoAvailable: false });
    expect(within(menu).queryByRole("menuitem", { name: /Retrieval|Dataset|System prompt|GitHub repository/ })).toBeNull();
    expect(within(menu).queryByText("Not available yet")).toBeNull();
    expect(Object.keys(groupsOf(menu))).not.toContain("Data");
  });

  it("keeps Check listed while it cannot be added, saying why", () => {
    const menu = openAll({ ...everyEntry(), checkable: false });
    const check = within(menu).getByRole("menuitem", { name: /^Check/ });
    expect(check.getAttribute("aria-disabled")).toBe("true");
    expect(check.textContent).toContain("Add an agent or code first");
  });

  it("Deployment is closed until opened, in place", () => {
    const menu = openAll(everyEntry());
    const head = within(menu).getByTestId("add-deployment-group");
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(within(menu).queryByRole("menuitem", { name: /^Host/ })).toBeNull();
    fireEvent.click(head);
    expect(screen.getByTestId("add-deployment-group").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitem", { name: /^Host/ })).toBeTruthy();
  });

  it("says step tile on its row", () => {
    openAddMenu(everyEntry());
    // F55: the word is step (F58's glossary).
    expect(screen.getByTestId("add-to-session").textContent).toBe("Add step");
  });

  it("has a field, focused as it opens, that finds entries by name and line at once", async () => {
    const props = everyEntry();
    const menu = openAddMenu(props);
    const field = within(menu).getByRole("searchbox", { name: "Find a step tile" });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "outside AI" } });
    // "Work done outside AI" is Manual step's line.
    expect(within(menu).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)).toEqual(["Manual step"]);
    fireEvent.change(field, { target: { value: "host" } });
    // Deployment's entries are found without opening it.
    expect(within(menu).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)).toContain("Host");
    fireEvent.change(field, { target: { value: "zzz" } });
    expect(within(menu).getByText("No step tile matches.")).toBeTruthy();
  });

  it("Down goes to the first entry; Enter runs the first one found", () => {
    const props = everyEntry();
    const menu = openAddMenu(props);
    const field = within(menu).getByRole("searchbox", { name: "Find a step tile" });
    fireEvent.change(field, { target: { value: "code" } });
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toMatch(/^Code/);
    fireEvent.change(field, { target: { value: "code" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onAddCode).toHaveBeenCalledTimes(1);
  });
});
