import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxDetailsProps, type SandboxDetails } from "@/dev/fixtures/sandbox";

import { DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function panel(kind: SandboxDetails, which: "fox" | "bakery" = "bakery", over: Partial<DetailsPanelProps> = {}) {
  const props: DetailsPanelProps = {
    ...sandboxDetailsProps(kind, which),
    onRename: vi.fn(),
    onModel: vi.fn(),
    onAddUse: vi.fn(),
    onRemoveUse: vi.fn(),
    onRuns: vi.fn(),
    onRemoveInside: vi.fn(),
    onToggleSessionPrompt: vi.fn(),
    onDownload: vi.fn(),
    onFields: vi.fn(),
    onOpenPrompt: vi.fn(),
    onUseAsCover: vi.fn(),
    ...over,
  };
  render(<DetailsPanel {...props} />);
  return props;
}

describe("a prompt", () => {
  it("shows its eyebrow, title, lines, text and words", () => {
    panel("prompt");
    expect(screen.getByText("Prompt 3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Fix the mobile layout" })).toBeTruthy();
    expect(screen.getByText("Session 2 · Claude Code")).toBeTruthy();
    expect(screen.getByText("Sonnet 5.5 · 4 Mar · prompt 3 of 4")).toBeTruthy();
    expect(screen.getByText("19 words")).toBeTruthy();
  });

  it("renames in place: Enter saves, Esc cancels", () => {
    const props = panel("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Title of prompt 3");
    fireEvent.change(field, { target: { value: "Mobile fixes" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("p3", "Mobile fixes");

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Title of prompt 3"), { target: { value: "Nope" } });
    fireEvent.keyDown(screen.getByLabelText("Title of prompt 3"), { key: "Escape" });
    expect(props.onRename).toHaveBeenCalledTimes(1);
  });

  it("draws a default title quiet", () => {
    panel("prompt", "fox");
    const title = screen.getByRole("heading", { name: "Prompt 1" });
    // marked, and drawn at weight 500 in `--text2` (the colour itself is not readable in jsdom)
    expect(title.getAttribute("data-default-title")).toBe("true");
    expect(title.getAttribute("style")).toMatch(/font-weight:\s*500/);
  });

  it("removes an input, and adds one from the menu of what it may use", () => {
    const props = panel("prompt");
    expect(screen.getByText("Output of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove menu.pdf" }));
    expect(props.onRemoveUse).toHaveBeenCalledWith("p3", { kind: "file", node_id: "f1" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Add an input" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: "Add an input" }));
  });

  it("opens the full prompt through Read all of it, and says where its work goes", () => {
    const props = panel("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Read all of it" }));
    expect(props.onOpenPrompt).toHaveBeenCalledWith("p3");
    expect(screen.getByText("4 · Prompt 4")).toBeTruthy();
  });

  it("asks a typed prompt for its model, and says why it is empty", () => {
    const base = sandboxDetailsProps("prompt", "bakery");
    if (base.view?.kind !== "prompt") throw new Error("fixture");
    const props = panel("prompt", "bakery", { view: { ...base.view, typed: true, model: null } });
    expect(screen.getByText("Model is empty because there is no session to read it from.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "Opus 5.5" } });
    expect(props.onModel).toHaveBeenCalledWith("p3", "Opus 5.5");
  });
});

describe("a session", () => {
  it("lists tool, model and date, then a checklist that adds and removes prompts", () => {
    const props = panel("session");
    expect(screen.getByText("Prompts in the build")).toBeTruthy();
    expect(screen.getByText("2 of 3")).toBeTruthy();
    const boxes = within(screen.getByRole("group", { name: "Prompts in this session" })).getAllByRole("checkbox");
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, false]);
    fireEvent.click(boxes[2]);
    expect(props.onToggleSessionPrompt).toHaveBeenLastCalledWith(expect.objectContaining({ key: "s1" }), expect.objectContaining({ ordinal: 2 }), true);
    fireEvent.click(boxes[0]);
    expect(props.onToggleSessionPrompt).toHaveBeenLastCalledWith(expect.objectContaining({ key: "s1" }), expect.objectContaining({ stepId: "p1" }), false);
  });
});

describe("an agent", () => {
  it("is a real radio group of five, and the chosen one is checked", () => {
    panel("agent");
    const group = screen.getByRole("radiogroup", { name: "How it runs" });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.checked)).toEqual([false, false, true, false, false]);
    expect((screen.getByLabelText("The condition") as HTMLInputElement).value).toBe("every item has a price");
    expect(screen.getByText("22 / 80")).toBeTruthy();
  });

  it("sets Runs several at once to 3", () => {
    const props = panel("agent");
    fireEvent.click(screen.getByRole("radio", { name: "Runs several at once" }));
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 2 });
  });

  it("shows the count as '3 at once' and hands it over when the field is left", () => {
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    const props = panel("agent", "bakery", { view: { ...base.view, runs: { how: "parallel", count: 2 } } });
    const field = screen.getByLabelText("How many");
    fireEvent.change(field, { target: { value: "3" } });
    expect(screen.getByText("3 at once")).toBeTruthy();
    fireEvent.blur(field);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 3 });
    fireEvent.change(field, { target: { value: "99" } });
    fireEvent.blur(field);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 20 });
  });

  it("goes back to once with no field", () => {
    const props = panel("agent");
    fireEvent.click(screen.getByRole("radio", { name: "Runs once" }));
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", null);
  });

  it("renames and removes what is inside", () => {
    const props = panel("agent");
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Checker" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("a5", "Checker");
    fireEvent.click(screen.getByRole("button", { name: "Remove 5.2 · Prompt 5.2" }));
    expect(props.onRemoveInside).toHaveBeenCalledWith("a5:p");
  });
});

describe("an agent inside a team (UI-P69)", () => {
  const inTeam = () => {
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    return { ...base.view, id: "t3b", number: "3.2", name: "Writer", defaultName: "Agent 3.2", runs: null, parent: "Team 3 · Copy team" };
  };

  it("adds 'In: Team {n} · {title}' and words Runs once as 'each time work is sent to it'", () => {
    panel("agent", "bakery", { view: inTeam() });
    expect(screen.getByText("In")).toBeTruthy();
    expect(screen.getByText("Team 3 · Copy team")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Runs once · each time work is sent to it" })).toBeTruthy();
  });

  it("leaves both out for an agent that is not in a team", () => {
    panel("agent");
    expect(screen.queryByText("In")).toBeNull();
    expect(screen.getByRole("radio", { name: "Runs once" })).toBeTruthy();
  });

  it("edits the instructions and hands them over when the field is left", () => {
    const props = panel("agent", "bakery", { onInstructions: vi.fn() });
    const field = screen.getByLabelText("Instructions") as HTMLTextAreaElement;
    expect(field.value).toBe("Check the menu and reply with any item that has no price.");
    fireEvent.change(field, { target: { value: "Reply with any item over ten pounds." } });
    fireEvent.blur(field);
    expect(props.onInstructions).toHaveBeenCalledWith("a5", "Reply with any item over ten pounds.");
  });

  it("only shows the instructions when nothing can write them, and has none for a team", () => {
    panel("agent");
    expect(screen.queryByLabelText("Instructions")).toBeNull();
    expect(screen.getByText("Check the menu and reply with any item that has no price.")).toBeTruthy();
    cleanup();
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    panel("agent", "bakery", { onInstructions: vi.fn(), view: { ...base.view, kind: "team", instructions: "" } });
    expect(screen.queryByText("Instructions")).toBeNull();
  });
});

describe("a file, a tool, a result", () => {
  it("downloads a file and names who uses it", () => {
    const props = panel("file");
    expect(screen.getByText("212 KB")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(props.onDownload).toHaveBeenCalledWith("f1");
    expect(screen.getByText("3 · Fix the mobile layout")).toBeTruthy();
  });

  it("edits a tool's service and what it was used for", () => {
    const props = panel("tool");
    const scopes = screen.getByLabelText("What it was used for");
    fireEvent.change(scopes, { target: { value: "read" } });
    fireEvent.blur(scopes);
    expect(props.onFields).toHaveBeenCalledWith("t1", { scopes: "read" });
  });

  it("uses a picture as the cover", () => {
    const props = panel("result", "fox");
    fireEvent.click(screen.getByRole("button", { name: "Use as cover" }));
    expect(props.onUseAsCover).toHaveBeenCalledWith("m1");
  });
});

describe("nothing selected", () => {
  it("says what to select", () => {
    render(<DetailsPanel {...sandboxDetailsProps("prompt")} view={null} />);
    expect(screen.getByText("Select a prompt, session or file to see it here.")).toBeTruthy();
  });
});

describe("a manual step (UI-P70)", () => {
  const view = (over: Partial<Extract<NonNullable<DetailsPanelProps["view"]>, { kind: "manual" }>> = {}): DetailsPanelProps["view"] => ({
    kind: "manual",
    id: "m3",
    number: "3",
    title: null,
    defaultTitle: "Manual step 3",
    tool: "Figma",
    text: "Laid out the hero",
    picture: { id: "media-1", name: "hero.png" },
    uses: [],
    options: [],
    goesInto: [{ id: "p4", label: "4 · Prompt 4" }],
    ...over,
  });

  it("shows the eyebrow, the title with Rename, and says it was never detected", () => {
    panel("prompt", "bakery", { view: view(), onManual: vi.fn(), onManualPicture: vi.fn() });
    expect(screen.getByText("Manual step 3", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Added by you · never detected")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Title of manual step 3|Rename/ })).toBeTruthy();
    expect(screen.getByText("Goes into")).toBeTruthy();
    expect(screen.getByText("Uses")).toBeTruthy();
  });

  it("edits the tool and the line within their limits, and ignores a blank", () => {
    const props = panel("prompt", "bakery", { view: view(), onManual: vi.fn(), onManualPicture: vi.fn() });
    const tool = screen.getByLabelText("Tool") as HTMLInputElement;
    const line = screen.getByLabelText("What was done") as HTMLTextAreaElement;
    expect(tool.maxLength).toBe(40);
    expect(line.maxLength).toBe(140);
    fireEvent.change(tool, { target: { value: "Lovable" } });
    fireEvent.blur(tool);
    expect(props.onManual).toHaveBeenLastCalledWith("m3", { tool: "Lovable" });
    fireEvent.change(line, { target: { value: "  " } });
    fireEvent.blur(line);
    expect(props.onManual).toHaveBeenCalledTimes(1);
    fireEvent.change(line, { target: { value: "Deployed it" } });
    fireEvent.blur(line);
    expect(props.onManual).toHaveBeenLastCalledWith("m3", { text: "Deployed it" });
  });

  it("removes the picture with null, and replaces it from a file", () => {
    const props = panel("prompt", "bakery", { view: view(), onManual: vi.fn(), onManualPicture: vi.fn() });
    expect(screen.getByText("hero.png")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove the picture" }));
    expect(props.onManual).toHaveBeenLastCalledWith("m3", { media_id: null });
    expect(screen.getByRole("button", { name: "Replace the picture" })).toBeTruthy();
    const file = new File(["x"], "new.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("details-manual-picture"), { target: { files: [file] } });
    expect(props.onManualPicture).toHaveBeenCalledWith("m3", file);
  });

  it("offers Add a picture when it has none, and has no model and no Read all of it", () => {
    panel("prompt", "bakery", { view: view({ picture: null }), onManual: vi.fn(), onManualPicture: vi.fn() });
    expect(screen.getByRole("button", { name: "Add a picture" })).toBeTruthy();
    expect(screen.queryByLabelText("Model")).toBeNull();
    expect(screen.queryByRole("button", { name: "Read all of it" })).toBeNull();
  });
});
