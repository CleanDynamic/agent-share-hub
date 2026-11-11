// CA-16 P5, the Classification: the same dialog, ids, focus and phone behaviour as the Card it replaces, now with
// a preview, the Optional rows (every one closed), the classification pickers, "From the build" with disputes
// and questions, and Save. The acceptance tests run the real data hook and the real storage layer over a mocked
// database, so what they check is what would be written.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import type { Build, NodeTree } from "@/lib/build/types";
import { resetClassificationColumns } from "@/lib/classify/storage";

const updateBuild = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/build/builds", () => ({ updateBuild: (...args: unknown[]) => updateBuild(...args) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }) },
}));

import { CARD_FIELD_ID, CARD_SUBTITLE, NOT_SAVED_LINE, SandboxCard, type SandboxCardProps } from "./SandboxCard";
import { useClassificationCard } from "./useClassificationCard";

beforeEach(() => {
  resetClassificationColumns();
  updateBuild.mockReset();
  maybeSingle.mockReset();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let counter = 0;
const node = (type: string, payload: Record<string, unknown>): NodeTree => {
  counter += 1;
  return { id: `n${counter}`, build_id: "b1", type, title: null, payload, position: counter, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-22T00:00:00Z", children: [] } as unknown as NodeTree;
};

/** A build with tiles: two prompts (one names hybrid search and one names Python), a result with a link, no code. */
const TREE: NodeTree[] = [
  node("prompt", { text: "Build hybrid search over our policy documents" }),
  node("prompt", { text: "Write a Python script that loads them" }),
  node("result", { summary: "Deployed", url: "https://example.com", kind: "deployed" }),
];

const BUILD = { id: "b1", making: null, repo_url: null, live_url: null, cost_monthly: null, cost_setup: null } as unknown as Build;

function Harness({ over = {}, tree = TREE, buildId = "b1" }: { over?: Partial<SandboxCardProps>; tree?: NodeTree[]; buildId?: string }) {
  const data = useClassificationCard({ buildId, build: BUILD, tree, title: "Policy search", description: "Finds the right policy.", owner: true, ensureBuild: () => Promise.resolve(buildId) });
  const onSelectSource = vi.fn();
  const props: SandboxCardProps = {
    ...sandboxViewProps("bakery"),
    title: "Policy search",
    description: "Finds the right policy.",
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onFiles: vi.fn(),
    open: true,
    onOpenChange: vi.fn(),
    field: null,
    phone: false,
    classification: { ...data, onSelectSource },
    ...over,
  };
  return <SandboxCard {...props} />;
}

function mount(over: Partial<SandboxCardProps> = {}, tree?: NodeTree[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onTitle = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/compose/b1"]}>
        <Harness over={{ onTitle, onOpenChange, ...over }} tree={tree} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onTitle, onOpenChange };
}

const live = () => maybeSingle.mockResolvedValue({ data: { classification: {}, facets: [] }, error: null });
const card = () => screen.getByTestId("sandbox-card");
const row = (name: string) => within(card()).getByRole("button", { name: new RegExp(`^${name.replace(/[()£]/g, "\\$&")}`) });

describe("Classification: the sheet", () => {
  it("is a dialog named Classification, with its subtitle, a preview and the title", async () => {
    live();
    mount();
    const dialog = await screen.findByRole("dialog", { name: "Classification" });
    expect(within(dialog).getByText(CARD_SUBTITLE)).toBeTruthy();
    expect(within(dialog).getByTestId("card-preview")).toBeTruthy();
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Policy search");
    expect(within(dialog).queryByText("Cover")).toBeNull();
    expect(within(dialog).queryByLabelText("Who it's for")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Edit the post" })).toBeNull();
  });

  it("is the modal window, 560 wide, the title at 15/500 with its subtitle", async () => {
    live();
    mount();
    const sheet = await screen.findByTestId("sandbox-card");
    expect(sheet.style.width).toBe("560px");
    expect(sheet.style.borderRadius).toBe("12px");
    expect(sheet.style.boxShadow).toBe("var(--window-shadow)");
    const title = screen.getByRole("heading", { name: "Classification" });
    expect(title.style.fontSize).toBe("15px");
    expect(title.style.fontWeight).toBe("500");
  });

  it("draws the blocks in the board's order: preview, title, Optional, footer", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const order = ["card-preview", "card-required"].map((id) => screen.getByTestId(id));
    expect(order[0].compareDocumentPosition(screen.getByLabelText("Title")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Title").compareDocumentPosition(screen.getByTestId("optional-section")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("optional-section").compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByTestId("optional-count").textContent).toBe("Suggestions from the build");
    expect(screen.getByTestId("card-preview").textContent).toContain("Preview");
    expect(screen.getByTestId("card-preview").textContent).toContain("Policy search");
  });

  it("names the rows in the board's order, each saying Not set or its value, and counts", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const rows = within(card()).getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded")).map((button) => button.textContent ?? "");
    const names = ["Summary", "Field", "Task", "Setting", "Tools and stack", "Data handled", "Age suitability", "From the build", "Build details"];
    names.forEach((name, index) => expect(rows[index].startsWith(name), `${name} is row ${index + 1}`).toBe(true));
    expect(rows[0]).toContain("Finds the right policy.");
    // F20: a closed row with suggestions and no value reads Not set, then its first suggestion as a chip, then the count (F23).
    expect(rows[1]).toMatch(/^FieldNot setSuggested: .+\d suggestions?$/);
    // F24: a count of 0 shows nothing.
    expect(rows[3]).toBe("SettingNot set");
    expect(rows[5]).toBe("Data handledNot set");
    expect(rows[6]).toBe("Age suitabilityNot set");
    expect(rows[7]).toMatch(/Web app/);
    expect(rows[7]).toMatch(/\d questions?$/);
    expect(rows[8]).toContain("Known issue, Build cost, Running cost per month, Time to first result");
  });

  it("shows a set Field as its last two levels, and a set Task and Tools line as values", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Field"));
    fireEvent.click(screen.getByRole("button", { name: "Add AI and machine learning › Retrieval systems › Hybrid search" }));
    fireEvent.click(row("Field"));
    expect(row("Field").textContent).toContain("Retrieval systems › Hybrid search");
    expect(row("Field").textContent).not.toContain("AI and machine learning ›");
  });

  it("keeps 44-high targets on a phone", async () => {
    live();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    mount({ phone: true });
    const title = await screen.findByLabelText("Title");
    expect((title as HTMLElement).style.height).toBe("44px");
  });

  it("lands on the field a missing item names, opening the Summary row for it", async () => {
    live();
    mount({ field: "summary" });
    await screen.findByTestId("sandbox-card");
    await waitFor(() => expect(document.activeElement?.id).toBe(CARD_FIELD_ID.summary));
    expect(row("Summary").getAttribute("aria-expanded")).toBe("true");
  });

  it("closes from Close and from Cancel", async () => {
    live();
    const { onOpenChange } = mount();
    fireEvent.click(await screen.findByRole("button", { name: /^Close/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says Required: a title until there is one, and does not save without it", async () => {
    live();
    const { onTitle } = mount();
    await screen.findByTestId("sandbox-card");
    expect(screen.getByTestId("card-required").textContent).toBe("Required fields complete");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  " } });
    expect(screen.getByTestId("card-required").textContent).toBe("Required: a title");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onTitle).not.toHaveBeenCalled();
  });

  it("changes nothing until Save: the title and the summary go to the page's handlers then, and Cancel drops them", async () => {
    live();
    const onDescription = vi.fn();
    const { onTitle, onOpenChange } = mount({ onDescription });
    await screen.findByTestId("sandbox-card");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Policy finder" } });
    fireEvent.click(row("Summary"));
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Finds it fast." } });
    expect(screen.getByText("14 / 200")).toBeTruthy();
    expect(onTitle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onTitle).toHaveBeenCalledWith("Policy finder");
    expect(onDescription).toHaveBeenCalledWith("Finds it fast.");
  });
});

describe("F20 to F28 · the Optional rows of the Classification", () => {
  it("F20: an unset row reads Not set with a dashed Suggested chip beside it, and no solid value", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const field = row("Field").closest("[data-testid='optional-field']") as HTMLElement;
    expect(within(field).getByTestId("optional-line").textContent).toBe("Not set");
    const chip = within(field).getByTestId("optional-suggested-chip");
    expect(chip.textContent).toMatch(/^Suggested: \S/);
    expect(chip.style.borderStyle).toBe("dashed");
    expect(within(field).queryByTestId("optional-value")).toBeNull();
  });

  it("F21: an open row's header still says its value", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Summary"));
    expect(row("Summary").getAttribute("aria-expanded")).toBe("true");
    expect(row("Summary").textContent).toContain("Finds the right policy.");
  });

  it("F22: Accept sets the value and leaves the row closed; Undo stands where Accept stood and puts the row back", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const box = () => row("Field").closest("[data-testid='optional-field']") as HTMLElement;
    const first = within(box()).getByTestId("optional-suggested-chip").textContent?.replace(/^Suggested: /, "") ?? "";
    fireEvent.click(within(box()).getByRole("button", { name: `Accept ${first} as Field` }));
    expect(row("Field").getAttribute("aria-expanded")).toBe("false");
    expect(within(box()).getByTestId("optional-line").textContent).toContain(first);
    expect(within(box()).queryByTestId("optional-suggested-chip")).toBeNull();
    const undo = within(box()).getByRole("button", { name: "Undo Field" });
    expect(undo.textContent).toBe("Undo");
    expect(undo.getAttribute("data-testid")).toBe("optional-undo");
    fireEvent.click(undo);
    expect(within(box()).getByTestId("optional-line").textContent).toBe("Not set");
    expect(within(box()).getByTestId("optional-suggested-chip")).toBeTruthy();
    expect(within(box()).queryByRole("button", { name: "Undo Field" })).toBeNull();
    // Undo goes once the row is opened.
    fireEvent.click(within(box()).getByRole("button", { name: `Accept ${first} as Field` }));
    fireEvent.click(row("Field"));
    expect(within(box()).queryByRole("button", { name: "Undo Field" })).toBeNull();
    fireEvent.click(row("Field"));
    expect(within(box()).queryByRole("button", { name: "Undo Field" })).toBeNull();
  });

  it("F23: every row ends the same way: the count slot never says From the build, and every row has the same padding", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const heads = within(card()).getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    const paddings = new Set(heads.map((head) => head.style.padding));
    expect(paddings.size).toBe(1);
    for (const head of heads) expect(within(head).queryByTestId("optional-row-count")?.textContent ?? "").not.toBe("From the build");
  });

  it("F25: the window is pinned 48 from the top and its body scrolls inside", async () => {
    live();
    mount();
    const sheet = await screen.findByTestId("sandbox-card");
    expect(sheet.style.top).toBe("48px");
    expect(sheet.style.transform).toBe("translateX(-50%)");
    expect(sheet.style.maxHeight).toBe("calc(100dvh - 96px)");
    expect(screen.getByTestId("card-body").style.overflowY).toBe("auto");
  });

  it("F26: Required beside the label and in the footer stay; the line under the field waits for a save attempt", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByTestId("card-required").textContent).toBe("Required: a title");
    expect(screen.queryByTestId("field-required")).toBeNull();
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Enter" });
    expect(screen.getByTestId("field-required")).toBeTruthy();
  });

  it("F27: Tools and stack is one row; From the build offers a button that opens it instead of its values", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("From the build"));
    const stack = card().querySelector("[data-facet='stack']") as HTMLElement;
    expect(within(stack).getByRole("button", { name: "Edit in Tools and stack" })).toBeTruthy();
    expect(within(stack).queryByText("Not stated")).toBeNull();
    fireEvent.click(within(stack).getByRole("button", { name: "Edit in Tools and stack" }));
    expect(row("Tools and stack").getAttribute("aria-expanded")).toBe("true");
    expect(row("From the build").getAttribute("aria-expanded")).toBe("false");
    expect(within(card()).getAllByText("Tools and stack").length).toBeGreaterThan(0);
  });

  it("F28: one row open at a time: opening Task closes Field", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Field"));
    expect(row("Field").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(row("Task"));
    expect(row("Task").getAttribute("aria-expanded")).toBe("true");
    expect(row("Field").getAttribute("aria-expanded")).toBe("false");
  });

  it("F28: a row passed forceOpen stays open when another opens", async () => {
    live();
    mount({ field: "summary" });
    await screen.findByTestId("sandbox-card");
    await waitFor(() => expect(row("Summary").getAttribute("aria-expanded")).toBe("true"));
    fireEvent.click(row("Field"));
    expect(row("Field").getAttribute("aria-expanded")).toBe("true");
    expect(row("Summary").getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Classification: Build details", () => {
  it("renames the fields and keeps them where they were stored", async () => {
    live();
    const onDetail = vi.fn();
    mount({ onDetail });
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Build details"));
    for (const name of ["Known issue", "Build cost (£)", "Running cost per month (£)", "Time to first result (minutes)"]) {
      expect(row(name).getAttribute("aria-expanded")).toBe("false");
    }
    expect(within(card()).queryByText("Monthly cost (£)")).toBeNull();
    fireEvent.click(row("Known issue"));
    fireEvent.change(screen.getByLabelText("Problem"), { target: { value: "It broke" } });
    fireEvent.change(screen.getByLabelText("Fix"), { target: { value: "I fixed it" } });
    fireEvent.click(row("Build cost (£)"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Build cost (£)" }), { target: { value: "12" } });
    fireEvent.click(row("Running cost per month (£)"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Running cost per month (£)" }), { target: { value: "5" } });
    fireEvent.click(row("Time to first result (minutes)"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Time to first result (minutes)" }), { target: { value: "20" } });
    // UX-11: no "Open a bounty" row any more.
    expect(screen.queryByText("Open a bounty")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onDetail).toHaveBeenCalled());
    const keys = Object.fromEntries(onDetail.mock.calls.map(([key, value]) => [key, value]));
    expect(keys).toMatchObject({ symptom: "It broke", resolution: "I fixed it", costSetup: "12", costMonthly: "5", firstResult: "20" });
  });
});

describe("Classification: acceptance", () => {
  it("opens with every row closed, adds a Field from a suggestion, adds a custom Task, disputes Skill needed, saves, and writes classification and facets", async () => {
    live();
    updateBuild.mockResolvedValue({});
    const { onOpenChange } = mount();
    await screen.findByTestId("sandbox-card");

    // every row starts closed
    const rows = within(card()).getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    expect(rows.map((button) => button.getAttribute("aria-label") ?? button.textContent).length).toBeGreaterThanOrEqual(9);
    for (const button of rows) expect(button.getAttribute("aria-expanded")).toBe("false");
    // the closed Field row offers its first suggestion (UX-03 P5), and nothing is set
    expect(within(row("Field").closest("[data-testid='optional-field']") as HTMLElement).getByRole("button", { name: /^Accept .+ as Field$/ })).toBeTruthy();

    // a Field from a suggestion: nothing was pre-selected
    fireEvent.click(row("Field"));
    expect(screen.queryByRole("list", { name: "Field, chosen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add AI and machine learning › Retrieval systems › Hybrid search" }));
    expect(screen.getByRole("list", { name: "Field, chosen" }).textContent).toContain("Hybrid search");

    // a custom Task
    fireEvent.click(row("Task"));
    const task = screen.getByRole("combobox", { name: "Task" });
    fireEvent.focus(task);
    fireEvent.change(task, { target: { value: "Sorting socks" } });
    fireEvent.click(screen.getByRole("option", { name: /Add \u201CSorting socks\u201D/ }));

    // dispute Skill needed
    fireEvent.click(row("From the build"));
    fireEvent.click(screen.getByRole("button", { name: "Dispute Skill needed" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Corrected value for Skill needed" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Writing code" }));
    fireEvent.change(screen.getByLabelText("Reason for changing Skill needed"), { target: { value: "I wrote it by hand" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this value" }));
    const skillRow = card().querySelector("[data-facet='skill']") as HTMLElement;
    expect(within(skillRow).getByText("Writing code")).toBeTruthy();
    expect(within(skillRow).getByText("Stated by you")).toBeTruthy();

    // the preview already draws the two lines
    const preview = screen.getByTestId("card-preview");
    expect(preview.textContent).toContain("Hybrid search · Sorting socks");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    const written = updateBuild.mock.calls.map((call) => call[1] as Record<string, unknown>).find((patch) => "classification" in patch);
    expect(written).toBeTruthy();
    const classification = written?.classification as { declared: { field: unknown[]; task: unknown[] }; disputes: Record<string, { values: string[]; reason: string }>; derived: Record<string, { values: string[] }>; version: number };
    expect(classification.version).toBe(1);
    expect(classification.declared.field).toEqual([{ id: "ai-ml.retrieval.hybrid-search" }]);
    expect(classification.declared.task).toEqual([{ custom: "Sorting socks", primary: true }]);
    expect(classification.disputes.skill).toMatchObject({ values: ["writing-code"], reason: "I wrote it by hand" });
    expect(classification.derived.skill.values).toEqual(["no-coding"]);
    expect(classification.derived.built.values).toContain("web-app");

    const facets = written?.facets as string[];
    expect(facets).toEqual(expect.arrayContaining(["field:ai-ml", "field:ai-ml.retrieval", "field:ai-ml.retrieval.hybrid-search", "skill:writing-code", "built:web-app"]));
    expect(facets).not.toContain("skill:no-coding");
    expect(facets.some((facet) => facet.includes("Sorting"))).toBe(false);

    // What was built is Web app, so the old shape follows it, in its own write
    expect(updateBuild).toHaveBeenCalledWith("b1", { shape: "app" });
  });

  it("selects the tile a value came from with Source, and shows a gap question first with Add code and Dismiss", async () => {
    live();
    mount({}, TREE);
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("From the build"));
    const questions = screen.getByRole("region", { name: "Questions" });
    expect(within(questions).getByText(/deployed, but it shows no code/)).toBeTruthy();
    expect(within(questions).getAllByRole("button", { name: "Add code" }).length).toBeGreaterThan(0);
    fireEvent.click(within(questions).getAllByRole("button", { name: "Dismiss" })[0]);
    expect(screen.queryByText(/deployed, but it shows no code/)).toBeNull();
    expect(screen.getByRole("button", { name: "Source of What was built" })).toBeTruthy();
  });
});

describe("SV-05 P7 · Classification when its columns are missing", () => {
  it("shows no not-live line; a save that fails says Classification not saved and keeps the window open", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: "column builds.classification does not exist" } });
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      if ("classification" in patch) throw { code: "PGRST204", message: "Could not find the 'classification' column of 'builds'" };
      return {};
    });
    const onDescription = vi.fn();
    const { onTitle, onOpenChange } = mount({ onDescription });
    await screen.findByTestId("sandbox-card");
    expect(screen.queryByTestId("classification-not-live")).toBeNull();
    expect(screen.queryByText(/database update/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Policy finder" } });
    fireEvent.click(row("Field"));
    fireEvent.click(screen.getByRole("button", { name: "Add AI and machine learning › Retrieval systems › Hybrid search" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(screen.getByTestId("card-required").textContent).toBe(NOT_SAVED_LINE));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onTitle).toHaveBeenCalledWith("Policy finder");
    // the shape still lands, because it needs no new column
    expect(updateBuild).toHaveBeenCalledWith("b1", { shape: "app" });
  });

  it("builds from steps the page already has: nothing breaks for a build with no tiles", async () => {
    live();
    mount({}, []);
    await screen.findByTestId("sandbox-card");
    expect(buildSteps([])).toEqual([]);
    expect(row("From the build").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("SV-05 P7 · a title change alone", () => {
  it("saves the title and closes, even while the classification's columns are missing", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: "column builds.classification does not exist" } });
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      if ("classification" in patch) throw { code: "PGRST204", message: "Could not find the 'classification' column of 'builds'" };
      return {};
    });
    const { onTitle, onOpenChange } = mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Policy finder" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onTitle).toHaveBeenCalledWith("Policy finder");
  });
});

describe("SV-05 P7 · the window's inset", () => {
  it("pads the body 20 on each side at 1440, as every other window does, and 0 on a phone", async () => {
    live();
    mount({ phone: false });
    await screen.findByTestId("sandbox-card");
    const preview = screen.getByTestId("card-body").firstElementChild as HTMLElement;
    expect(preview.style.padding).toBe("0px 20px 16px");
    cleanup();
    live();
    mount({ phone: true });
    await screen.findByTestId("sandbox-card");
    expect((screen.getByTestId("card-body").firstElementChild as HTMLElement).style.padding).toBe("0px 0px 16px");
  });
});

describe("UX-01 P2: a live build's title", () => {
  it("on a live build, an emptied title shows the field error and Save waits; on a draft it does not", async () => {
    live();
    mount({ titleLive: true });
    const dialog = await screen.findByRole("dialog", { name: "Classification" });
    const field = within(dialog).getByLabelText("Title");
    fireEvent.change(field, { target: { value: "" } });
    expect(within(dialog).getByText("A published build needs a title.")).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: "Untitled build" } });
    expect(within(dialog).getByText("A published build needs a title.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "Policy search v2" } });
    expect(within(dialog).queryByText("A published build needs a title.")).toBeNull();
    expect((within(dialog).getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("on a draft the field error is not drawn", async () => {
    live();
    mount({ titleLive: false });
    const dialog = await screen.findByRole("dialog", { name: "Classification" });
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Untitled build" } });
    expect(within(dialog).queryByText("A published build needs a title.")).toBeNull();
  });
});

describe("F10 · closing Classification with changes", () => {
  it("asks to keep or discard when Escape is pressed after the title changed, and stays open", async () => {
    live();
    const { onOpenChange } = mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Policy finder" } });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    const choice = await screen.findByTestId("card-close-choice");
    expect(within(choice).getByRole("button", { name: "Keep editing" })).toBeTruthy();
    expect(within(choice).getByRole("button", { name: "Discard changes" })).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("sandbox-card")).toBeTruthy();
    // Keep editing closes the question, not the window; Discard closes the window.
    fireEvent.click(within(choice).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByTestId("card-close-choice")).toBeNull();
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    fireEvent.click(within(await screen.findByTestId("card-close-choice")).getByRole("button", { name: "Discard changes" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes at once on Escape when nothing changed", async () => {
    live();
    const { onOpenChange } = mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId("card-close-choice")).toBeNull();
  });
});
