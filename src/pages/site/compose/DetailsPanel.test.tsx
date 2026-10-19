// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Runs } from "@/lib/build/graph";
import { sandboxDetailsProps, type SandboxDetails } from "@/dev/fixtures/sandbox";

import type { DetailsPanelProps, SessionView } from "./DetailsPanel";
import { DetailsPanel as DetailsPanel } from "./DetailsPanel";

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
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <DetailsPanel {...props} />
    </MemoryRouter>,
  );
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
    // CA-02 P8: the model menu follows the prompt's tool; with none named it offers every current text model.
    fireEvent.keyDown(screen.getByRole("button", { name: "Model" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5.5" }));
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

describe("a session whose client names no tool (TF-13)", () => {
  const withPicker = (value: string | null): Partial<DetailsPanelProps> => {
    const base = sandboxDetailsProps("session", "bakery");
    return { view: { ...(base.view as SessionView), pickTool: { value } }, onSessionTool: vi.fn() };
  };

  it("offers 'Pick its tool' with 'No tool' first, and hands the choice back", () => {
    const props = panel("session", "bakery", withPicker(null));
    fireEvent.click(screen.getByRole("button", { name: "Pick its tool" }));
    const rows = screen.getAllByRole("option");
    expect(rows[0].textContent).toBe("No tool");
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: "Perplexity" } });
    fireEvent.click(screen.getByRole("option", { name: "Perplexity" }));
    expect(props.onSessionTool).toHaveBeenLastCalledWith("s1", "perplexity");
  });

  it("gives null for 'No tool'", () => {
    const props = panel("session", "bakery", withPicker("perplexity"));
    fireEvent.click(screen.getByRole("button", { name: "Pick its tool" }));
    fireEvent.click(screen.getByRole("option", { name: "No tool" }));
    expect(props.onSessionTool).toHaveBeenLastCalledWith("s1", null);
  });

  it("shows no picker when the client names the tool", () => {
    panel("session", "bakery", { onSessionTool: vi.fn() });
    expect(screen.queryByRole("button", { name: "Pick its tool" })).toBeNull();
  });
});

describe("an agent", () => {
  it("is a real radio group of five, and the chosen one is checked", () => {
    panel("agent");
    const group = screen.getByRole("radiogroup", { name: "How did it run?" });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    // The fixture's agent repeats until a condition is met, so the two under More ways it ran show straight away.
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.checked)).toEqual([false, false, false, true, false]);
    expect((screen.getByLabelText("The condition") as HTMLInputElement).value).toBe("every item has a price");
    expect(screen.getByText("22 / 80")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More ways it ran" })).toBeNull();
  });

  it("sets Several at the same time to 2", () => {
    const props = panel("agent");
    fireEvent.click(screen.getByRole("radio", { name: "Several at the same time" }));
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 2 });
  });

  it("shows the count as '3 at the same time' and hands it over when the field is left", () => {
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    const props = panel("agent", "bakery", { view: { ...base.view, runs: { how: "parallel", count: 2 } } });
    const field = screen.getByLabelText("How many");
    fireEvent.change(field, { target: { value: "3" } });
    expect(screen.getByText("3 at the same time")).toBeTruthy();
    fireEvent.blur(field);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 3 });
    fireEvent.change(field, { target: { value: "99" } });
    fireEvent.blur(field);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "parallel", count: 20 });
  });

  it("goes back to When I asked with no field", () => {
    const props = panel("agent");
    fireEvent.click(screen.getByRole("radio", { name: "When I asked" }));
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", null);
  });

  /* CA-03 P3 */
  const withRuns = (runs: Runs | null) => {
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    return { ...base.view, runs };
  };

  it("shows three ways it ran, and the other two under More ways it ran", () => {
    panel("agent", "bakery", { view: withRuns(null) });
    const group = screen.getByRole("radiogroup", { name: "How did it run?" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["When I asked", "On a schedule", "When something happened"]);
    fireEvent.click(screen.getByRole("button", { name: "More ways it ran" }));
    expect(within(group).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
      "When I asked",
      "On a schedule",
      "When something happened",
      "Again until a condition was met",
      "Several at the same time",
    ]);
  });

  it("writes a schedule's preset and time into its detail, as text", () => {
    const props = panel("agent", "bakery", { view: withRuns({ how: "schedule" }) });
    const time = screen.getByLabelText("Time");
    fireEvent.change(time, { target: { value: "07:30" } });
    fireEvent.click(screen.getByRole("radio", { name: "Weekdays" }));
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "schedule", detail: "Weekdays 07:30" });
    expect((screen.getByRole("textbox", { name: "When" }) as HTMLInputElement).value).toBe("Weekdays 07:30");
  });

  it("lets what is typed in a schedule's field win over the presets", () => {
    const props = panel("agent", "bakery", { view: withRuns({ how: "schedule", detail: "Weekdays 07:30" }) });
    expect(screen.getByRole("radio", { name: "Weekdays" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("07:30");
    const when = screen.getByRole("textbox", { name: "When" });
    fireEvent.change(when, { target: { value: "the first Monday of the month" } });
    fireEvent.blur(when);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "schedule", detail: "the first Monday of the month" });
  });

  it("reads an old saved schedule back unchanged, with no preset chosen", () => {
    const props = panel("agent", "bakery", { view: withRuns({ how: "schedule", detail: "Mondays 07:00" }) });
    expect((screen.getByRole("textbox", { name: "When" }) as HTMLInputElement).value).toBe("Mondays 07:00");
    expect(screen.getAllByRole("radio", { name: /Every day|Weekdays|Weekly/ }).map((radio) => radio.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
    fireEvent.blur(screen.getByRole("textbox", { name: "When" }));
    expect(props.onRuns).not.toHaveBeenCalled();
  });

  it("writes At most into an until's detail, and reads an old detail back unchanged", () => {
    const props = panel("agent", "bakery", { view: withRuns({ how: "until", detail: "until the review has no changes" }) });
    expect((screen.getByLabelText("The condition") as HTMLInputElement).value).toBe("until the review has no changes");
    fireEvent.blur(screen.getByLabelText("The condition"));
    expect(props.onRuns).not.toHaveBeenCalled();
    const most = screen.getByRole("textbox", { name: "At most" });
    fireEvent.change(most, { target: { value: "3" } });
    fireEvent.blur(most);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "until", detail: "until the review has no changes · at most 3 times" });
    fireEvent.change(most, { target: { value: "40" } });
    fireEvent.blur(most);
    expect(props.onRuns).toHaveBeenLastCalledWith("a5", { how: "until", detail: "until the review has no changes · at most 20 times" });
  });

  it("reads a saved At most back into its field", () => {
    panel("agent", "bakery", { view: withRuns({ how: "until", detail: "until the review has no changes · at most 3 times" }) });
    expect((screen.getByLabelText("The condition") as HTMLInputElement).value).toBe("until the review has no changes");
    expect((screen.getByRole("textbox", { name: "At most" }) as HTMLInputElement).value).toBe("3");
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

  it("adds 'In: Team {n} · {title}' and words When I asked as 'each time work is sent to it'", () => {
    panel("agent", "bakery", { view: inTeam() });
    expect(screen.getByText("In")).toBeTruthy();
    expect(screen.getByText("Team 3 · Copy team")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "When I asked · each time work is sent to it" })).toBeTruthy();
  });

  it("calls a team's first agent its Lead agent (CA-03 P4)", () => {
    panel("agent", "bakery", { view: { ...inTeam(), id: "t3a", number: "3.1" } });
    expect(screen.getByTestId("details-eyebrow").textContent).toBe("Lead agent 3.1");
    cleanup();
    panel("agent", "bakery", { view: inTeam() });
    expect(screen.getByTestId("details-eyebrow").textContent).toBe("Agent 3.2");
  });

  it("leaves both out for an agent that is not in a team", () => {
    panel("agent");
    expect(screen.queryByText("In")).toBeNull();
    expect(screen.getByRole("radio", { name: "When I asked" })).toBeTruthy();
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
    makes: [],
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

  it("changes the tool through the picker, and edits the line within its limit, ignoring a blank", () => {
    const props = panel("prompt", "bakery", { view: view(), onManual: vi.fn(), onManualPicture: vi.fn() });
    const line = screen.getByLabelText("What was done") as HTMLTextAreaElement;
    expect(line.maxLength).toBe(140);
    fireEvent.click(screen.getByRole("button", { name: "Tool" }));
    const find = screen.getByRole("combobox", { name: "Find a tool" });
    fireEvent.change(find, { target: { value: "Lovable" } });
    fireEvent.keyDown(find, { key: "Enter" });
    expect(props.onManual).toHaveBeenLastCalledWith("m3", { tool: "lovable" });
    fireEvent.click(screen.getByRole("button", { name: "Tool" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: "Photoshop" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Find a tool" }), { key: "Enter" });
    expect(props.onManual).toHaveBeenLastCalledWith("m3", { tool: "Photoshop" });
    fireEvent.change(line, { target: { value: "  " } });
    fireEvent.blur(line);
    expect(props.onManual).toHaveBeenCalledTimes(2);
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

describe("the refined look (UI-P93)", () => {
  const markup = () =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <DetailsPanel {...sandboxDetailsProps("prompt", "bakery")} />
      </MemoryRouter>,
    );

  it("draws the title 18/500 with a ghost Rename, the tool's real mark at 24, and the text in a well", () => {
    panel("prompt");
    const title = screen.getByRole("heading", { name: "Fix the mobile layout" });
    expect(title.getAttribute("style")).toMatch(/font-size:\s*18px/);
    expect(screen.getByRole("button", { name: "Rename" }).getAttribute("style")).toMatch(/transparent/);
    expect(screen.getByTestId("details-panel").querySelector("[data-mark]")).toBeTruthy();
    expect(markup()).toContain("background:var(--well);border:1px solid var(--well-border)");
  });

  it("leads Uses with larr and Goes into with rarr, and Add an input is text with no icon", () => {
    panel("prompt");
    const add = screen.getByRole("button", { name: "Add an input" });
    expect(add.querySelector("svg")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Output of 2" })).toBeTruthy();
    const html = markup();
    expect(html.match(/data-glyph="larr"|M13 8H3.5/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it("leads Add an input with a file from your computer, which opens the picker for that step", async () => {
    const onAttach = vi.fn();
    panel("prompt", "bakery", { onAttach });
    fireEvent.keyDown(screen.getByRole("button", { name: "Add an input" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items[0].textContent).toBe("A file from your computer");
    fireEvent.click(items[0]);
    expect(onAttach).toHaveBeenCalledWith("p3");
  });
});

describe("Makes (TF-08)", () => {
  const makes = [
    { id: "f9", name: "brand-guide.md" },
    { id: "f10", name: "voice.md" },
  ];
  const withMakes = (kind: SandboxDetails, over: Partial<DetailsPanelProps> = {}) => {
    const base = sandboxDetailsProps(kind, "bakery");
    const view = { ...base.view, makes } as DetailsPanelProps["view"];
    return panel(kind, "bakery", { view, onAddMade: vi.fn(), onRemoveMade: vi.fn(), ...over });
  };
  const makesList = () => within(screen.getByRole("heading", { name: "Makes" }).closest("section") as HTMLElement);

  it("lists the files a prompt makes after Uses, in the same hairline rows, with a count", () => {
    withMakes("prompt");
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings.indexOf("Makes")).toBe(headings.indexOf("Uses") + 1);
    expect((screen.getByLabelText("Name of brand-guide.md") as HTMLInputElement).value).toBe("brand-guide.md");
    expect((screen.getByLabelText("Name of voice.md") as HTMLInputElement).value).toBe("voice.md");
    expect(screen.getByRole("button", { name: "Remove brand-guide.md" })).toBeTruthy();
  });

  it("is there for a manual step, and not for an agent or an agent's instructions", () => {
    const manual: DetailsPanelProps["view"] = { kind: "manual", id: "m3", number: "3", title: null, defaultTitle: "Manual step 3", tool: "Figma", text: "Laid out the hero", picture: null, makes, uses: [], options: [], goesInto: [] };
    panel("prompt", "bakery", { view: manual, onAddMade: vi.fn(), onRemoveMade: vi.fn() });
    expect(screen.getByRole("button", { name: "Name a file it makes" })).toBeTruthy();
    expect(screen.getByLabelText("Name of brand-guide.md")).toBeTruthy();
    cleanup();
    panel("agent", "bakery", { onAddMade: vi.fn(), onRemoveMade: vi.fn() });
    expect(screen.queryByRole("button", { name: "Name a file it makes" })).toBeNull();
    cleanup();
    const base = sandboxDetailsProps("prompt", "bakery");
    panel("prompt", "bakery", { view: { ...base.view, editable: false, makes: [] } as DetailsPanelProps["view"], onAddMade: vi.fn(), onRemoveMade: vi.fn() });
    expect(screen.queryByRole("button", { name: "Name a file it makes" })).toBeNull();
  });

  it("has no Makes list when the panel cannot write it", () => {
    panel("prompt");
    expect(screen.queryByRole("button", { name: "Name a file it makes" })).toBeNull();
  });

  it("opens a one-line field with the placeholder, adds on Enter and closes", () => {
    const props = withMakes("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Name a file it makes" }));
    const field = screen.getByLabelText("Name a file it makes") as HTMLInputElement;
    expect(field.placeholder).toBe("File name, such as brand-guide.md");
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "  checklist.md " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onAddMade).toHaveBeenCalledWith("p3", "checklist.md");
    expect(screen.queryByLabelText("Name a file it makes")).toBeNull();
  });

  it("closes the field on Esc without adding, and adds nothing for a blank name", () => {
    const props = withMakes("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Name a file it makes" }));
    fireEvent.keyDown(screen.getByLabelText("Name a file it makes"), { key: "Enter" });
    expect(props.onAddMade).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Name a file it makes"), { target: { value: "x.md" } });
    fireEvent.keyDown(screen.getByLabelText("Name a file it makes"), { key: "Escape" });
    expect(screen.queryByLabelText("Name a file it makes")).toBeNull();
    expect(props.onAddMade).not.toHaveBeenCalled();
  });

  it("keeps the field open and says so when the step already makes a file with that name", () => {
    const props = withMakes("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Name a file it makes" }));
    fireEvent.change(screen.getByLabelText("Name a file it makes"), { target: { value: "Brand-Guide.md" } });
    fireEvent.keyDown(screen.getByLabelText("Name a file it makes"), { key: "Enter" });
    expect(props.onAddMade).not.toHaveBeenCalled();
    expect(screen.getByText("This step already makes a file with that name.")).toBeTruthy();
    expect(screen.getByLabelText("Name a file it makes")).toBeTruthy();
  });

  it("renames in place through the file's title: Enter saves, Esc and a blank name go back", () => {
    const props = withMakes("prompt");
    const field = screen.getByLabelText("Name of brand-guide.md") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "style-guide.md" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onFields).toHaveBeenCalledWith("f9", { title: "style-guide.md" });

    const other = screen.getByLabelText("Name of voice.md") as HTMLInputElement;
    fireEvent.change(other, { target: { value: "nope.md" } });
    fireEvent.keyDown(other, { key: "Escape" });
    expect(other.value).toBe("voice.md");
    fireEvent.change(other, { target: { value: "   " } });
    fireEvent.keyDown(other, { key: "Enter" });
    expect(other.value).toBe("voice.md");
    expect(props.onFields).toHaveBeenCalledTimes(1);
  });

  it("removes a file with its x", () => {
    const props = withMakes("prompt");
    fireEvent.click(screen.getByRole("button", { name: "Remove voice.md" }));
    expect(props.onRemoveMade).toHaveBeenCalledWith("f10");
    expect(makesList().getAllByRole("textbox")).toHaveLength(2);
  });

  it("opens the field when the List asks for it, and puts the cursor back in it when it is open", () => {
    const base = sandboxDetailsProps("prompt", "bakery");
    const props = { ...base, view: { ...base.view, makes } as DetailsPanelProps["view"], onAddMade: vi.fn(), onRemoveMade: vi.fn(), onFields: vi.fn() } as DetailsPanelProps;
    const { rerender } = render(<MemoryRouter><DetailsPanel {...props} focusMakes={{ id: "p3", at: 1 }} /></MemoryRouter>);
    const field = screen.getByLabelText("Name a file it makes");
    expect(document.activeElement).toBe(field);
    (document.activeElement as HTMLElement).blur();
    rerender(<MemoryRouter><DetailsPanel {...props} focusMakes={{ id: "p3", at: 2 }} /></MemoryRouter>);
    expect(document.activeElement).toBe(screen.getByLabelText("Name a file it makes"));
  });

  it("ignores an ask made for another step", () => {
    const base = sandboxDetailsProps("prompt", "bakery");
    const props = { ...base, view: { ...base.view, makes } as DetailsPanelProps["view"], onAddMade: vi.fn(), onRemoveMade: vi.fn() } as DetailsPanelProps;
    render(<MemoryRouter><DetailsPanel {...props} focusMakes={{ id: "p1", at: 1 }} /></MemoryRouter>);
    expect(screen.queryByLabelText("Name a file it makes")).toBeNull();
  });
});

describe("an agent's harness, models and tools (CA-02 P5)", () => {
  const withSetup = () => {
    const base = sandboxDetailsProps("agent", "bakery").view;
    if (!base || base.kind !== "agent") throw new Error("expected an agent");
    return {
      ...base,
      setup: {
        harness: "Hermes Agent",
        models: [
          { model: "Opus 5.5", role: "main" },
          { model: "Haiku 5.5", role: "other" },
        ],
        tools: ["Gmail", "GitHub Copilot"],
      },
    };
  };

  it("shows Runs in, each model with its role and the tools, with the same controls as the dialog", () => {
    const onAgentSetup = vi.fn();
    panel("agent", "bakery", { view: withSetup(), onAgentSetup });
    expect(screen.getByRole("button", { name: "Runs in" }).textContent).toBe("Hermes Agent");
    expect(screen.getByRole("button", { name: "model Opus 5.5" })).toBeTruthy();
    // CA-03: the role is a menu showing the role alone.
    expect(screen.getByRole("button", { name: "Role of model 2" }).textContent).toBe("other");
    expect(screen.getByRole("button", { name: "model 2 Haiku 5.5" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Gmail", "GitHub Copilot"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Gmail" }));
    expect(onAgentSetup).toHaveBeenCalledWith("a5", {
      model: "Opus 5.5",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      harness: "Hermes Agent",
      tools: ["GitHub Copilot"],
    });
  });

  it("lists them as lines where it cannot write them", () => {
    panel("agent", "bakery", { view: withSetup() });
    expect(screen.getByText("Hermes Agent")).toBeTruthy();
    expect(screen.getByText("Haiku 5.5 · other")).toBeTruthy();
    expect(screen.getByText("Gmail · GitHub Copilot")).toBeTruthy();
  });

  it("shows an agent saved before CA-02 exactly as before", () => {
    panel("agent");
    expect(screen.queryByRole("button", { name: "Runs in" })).toBeNull();
    expect(screen.getByText("Opus 5.5")).toBeTruthy();
  });
});

describe("code (CA-02 P7)", () => {
  const code: DetailsPanelProps["view"] = {
    kind: "code",
    id: "c4",
    number: "4",
    title: null,
    defaultTitle: "Code 4",
    language: "ts",
    filename: "app.ts",
    source: "export const a = 1;\nexport const b = 2;\n",
    lines: 2,
    tool: "Cursor",
    model: "Opus 5",
    uses: [],
    options: [],
    goesInto: [],
    makes: [],
  };

  it("shows all of it in a mono well, what it was written with, and Copy", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    panel("prompt", "bakery", { view: code });
    expect(screen.getAllByText("Code 4").length).toBeGreaterThan(0);
    expect(screen.getByText("app.ts · ts · 2 lines")).toBeTruthy();
    expect(screen.getByText("Cursor · Opus 5")).toBeTruthy();
    const well = screen.getByTestId("details-code");
    expect(well.textContent).toBe("export const a = 1;\nexport const b = 2;\n");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("export const a = 1;\nexport const b = 2;\n");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});

describe("a saved pair that breaks the rules (CA-02 P8)", () => {
  const typed = (tool: string | null, model: string | null) => {
    const base = sandboxDetailsProps("prompt", "bakery");
    if (base.view?.kind !== "prompt") throw new Error("fixture");
    return { ...base.view, typed: true, tool, model };
  };

  it("says a tool doesn't offer the model, and Change the model opens the menu of the tool's own", async () => {
    const props = panel("prompt", "bakery", { view: typed("Claude", "Grok 4.7") });
    expect(screen.getByTestId("pair-note").textContent).toContain("Claude doesn't offer Grok 4.7.");
    // Nothing changes until the maker acts.
    expect(props.onModel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Change the model" }));
    const item = await screen.findByRole("menuitemradio", { name: "Opus 5.5" });
    expect(screen.queryByRole("menuitemradio", { name: "Grok 4.7" })).toBeNull();
    fireEvent.click(item);
    expect(props.onModel).toHaveBeenCalledWith("p3", "Opus 5.5");
  });

  it("says a tool doesn't run a model, or doesn't show it, and Remove the model clears it", () => {
    const props = panel("prompt", "bakery", { view: typed("Gmail", "Opus 5.5") });
    expect(screen.getByTestId("pair-note").textContent).toContain("Gmail doesn't run a model.");
    fireEvent.click(screen.getByRole("button", { name: "Remove the model" }));
    expect(props.onModel).toHaveBeenCalledWith("p3", null);
    cleanup();
    panel("prompt", "bakery", { view: typed("Lovable", "Opus 5.5") });
    expect(screen.getByTestId("pair-note").textContent).toContain("Lovable doesn't show which model it used.");
  });

  it("says nothing for a pair that keeps the rules, an unknown tool, or a prompt from a session", () => {
    panel("prompt", "bakery", { view: typed("Claude", "Opus 5.5") });
    expect(screen.queryByTestId("pair-note")).toBeNull();
    cleanup();
    panel("prompt", "bakery", { view: typed("My own script", "Grok 4.7") });
    expect(screen.queryByTestId("pair-note")).toBeNull();
    cleanup();
    panel("prompt");
    expect(screen.queryByTestId("pair-note")).toBeNull();
  });

  it("notes an agent whose harness doesn't offer its main model, and Change the model opens its menu", async () => {
    const base = sandboxDetailsProps("agent", "bakery").view;
    if (!base || base.kind !== "agent") throw new Error("fixture");
    const onAgentSetup = vi.fn();
    panel("agent", "bakery", { view: { ...base, setup: { harness: "Codex", models: [{ model: "Opus 5.5", role: "main" }], tools: [] } }, onAgentSetup });
    expect(screen.getByTestId("pair-note").textContent).toContain("Codex doesn't offer Opus 5.5.");
    expect(onAgentSetup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Change the model" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "GPT-6.1 Sol" }));
    expect(onAgentSetup).toHaveBeenCalledWith("a5", { model: "GPT-6.1 Sol", harness: "Codex", tools: [] });
  });

  it("puts a hidden harness's own name in place of a model it doesn't show", () => {
    const base = sandboxDetailsProps("agent", "bakery").view;
    if (!base || base.kind !== "agent") throw new Error("fixture");
    const onAgentSetup = vi.fn();
    panel("agent", "bakery", { view: { ...base, setup: { harness: "Manus", models: [{ model: "Opus 5.5", role: "main" }], tools: [] } }, onAgentSetup });
    expect(screen.getByTestId("pair-note").textContent).toContain("Manus doesn't show which model it used.");
    fireEvent.click(screen.getByRole("button", { name: "Remove the model" }));
    expect(onAgentSetup).toHaveBeenCalledWith("a5", { model: "Manus", harness: "Manus", tools: [] });
  });
});

describe("a check (CA-03 P5)", () => {
  const view = {
    kind: "check" as const,
    id: "k1",
    number: "9",
    title: null,
    defaultTitle: "Check 9",
    check: { tested: "Places a test order", passing: "The total shows £9.00", onFail: "It showed £8.99.", passed: 14, total: 14, runAt: "2026-10-12" },
    uses: [{ use: { kind: "output" as const, node_id: "c1" }, label: "Output of 3", sub: "order-form.tsx" }],
    options: [],
    goesInto: [],
  };

  it("shows its three answers label over value, its status and what it uses", () => {
    panel("agent", "bakery", { view });
    expect(screen.getByTestId("details-eyebrow").textContent).toBe("Check 9");
    expect(screen.getByTestId("check-status").textContent).toBe("Passed 14 of 14 runs · since 12 Oct");
    expect(screen.getAllByTestId("label-value").map((row) => [row.children[0].textContent, row.children[1].textContent])).toEqual([
      ["What it tested", "Places a test order"],
      ["What counts as passing", "The total shows £9.00"],
      ["When it failed", "It showed £8.99."],
    ]);
    expect(screen.getByText("Output of 3")).toBeTruthy();
    expect(screen.getByTestId("details-panel").textContent).not.toMatch(/verified|reproduc/i);
  });
});

describe("what an agent remembers, in Details (CA-03 P6)", () => {
  it("hands it over with the setup when the field is left, and only then", () => {
    const onAgentSetup = vi.fn();
    const base = sandboxDetailsProps("agent", "bakery");
    if (base.view?.kind !== "agent") throw new Error("fixture");
    panel("agent", "bakery", { view: { ...base.view, setup: { harness: null, models: [{ model: "Opus 5.5", role: "main" }], tools: [] } }, onAgentSetup });
    const field = screen.getByLabelText("What it remembers");
    fireEvent.change(field, { target: { value: "the dishes it featured" } });
    expect(onAgentSetup).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onAgentSetup).toHaveBeenCalledWith("a5", { model: "Opus 5.5", harness: null, tools: [], memory: "the dishes it featured" });
  });
});
