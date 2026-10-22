// CA-16 P5 — the Classification Card: the same dialog, ids, focus and phone behaviour as the Card it replaces, now with
// a preview, the Optional rows (every one closed), the classification pickers, "Read from your build" with disputes
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

import { CARD_FIELD_ID, CARD_SUBTITLE, NOT_LIVE_LINE, SandboxCard, type SandboxCardProps } from "./SandboxCard";
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
const row = (name: string) => within(card()).getByRole("button", { name });

describe("Classification Card: the sheet", () => {
  it("is a dialog named Classification Card, with its subtitle, a preview and the title", async () => {
    live();
    mount();
    const dialog = await screen.findByRole("dialog", { name: "Classification Card" });
    expect(within(dialog).getByText(CARD_SUBTITLE)).toBeTruthy();
    expect(within(dialog).getByTestId("card-preview")).toBeTruthy();
    expect((within(dialog).getByLabelText("Title") as HTMLInputElement).value).toBe("Policy search");
    expect(within(dialog).queryByText("Cover")).toBeNull();
    expect(within(dialog).queryByLabelText("Who it's for")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Edit the post" })).toBeNull();
  });

  it("is a side sheet 472 wide, inset 6, radius 12, the window recipe with the sheet shadow", async () => {
    live();
    mount();
    const sheet = await screen.findByTestId("sandbox-card");
    expect(sheet.style.width).toBe("472px");
    expect([sheet.style.top, sheet.style.right, sheet.style.bottom]).toEqual(["6px", "6px", "6px"]);
    expect(sheet.style.borderRadius).toBe("12px");
    expect(sheet.style.boxShadow).toBe("var(--sheet-shadow)");
    const title = screen.getByRole("heading", { name: "Classification Card" });
    expect(title.style.fontSize).toBe("15px");
    expect(title.style.fontWeight).toBe("500");
  });

  it("keeps the full-height sheet and 44-high targets on a phone", async () => {
    live();
    mount({ phone: true });
    const sheet = await screen.findByTestId("sandbox-card");
    expect(sheet.style.width).toBe("100%");
    expect(sheet.style.top).toBe("0px");
    expect((screen.getByLabelText("Title") as HTMLElement).style.height).toBe("44px");
    expect(row("Field").style.minHeight).toBe("44px");
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
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says Required: a title until there is one, and does not save without it", async () => {
    live();
    const { onTitle } = mount();
    await screen.findByTestId("sandbox-card");
    expect(screen.getByTestId("card-required").textContent).toBe("All required fields complete");
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

describe("Classification Card: Build details", () => {
  it("renames the fields and keeps them where they were stored", async () => {
    live();
    const onDetail = vi.fn();
    const onGapSwitch = vi.fn();
    mount({ onDetail, onGapSwitch });
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Build details"));
    for (const name of ["Known issue", "Build cost (£)", "Running cost per month (£)", "Time to first result (minutes)", "Open a bounty"]) {
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
    fireEvent.click(row("Open a bounty"));
    fireEvent.click(screen.getByRole("switch", { name: "Open a bounty" }));
    fireEvent.change(screen.getByLabelText("What is left open"), { target: { value: "The login" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onGapSwitch).toHaveBeenCalled());
    const keys = Object.fromEntries(onDetail.mock.calls.map(([key, value]) => [key, value]));
    expect(keys).toMatchObject({ symptom: "It broke", resolution: "I fixed it", costSetup: "12", costMonthly: "5", firstResult: "20", gapProblem: "The login" });
    expect(onGapSwitch).toHaveBeenCalledWith(true);
  });
});

describe("Classification Card: acceptance", () => {
  it("opens with every row closed, adds a Field from a suggestion, adds a custom Task, disputes Skill needed, saves, and writes classification and facets", async () => {
    live();
    updateBuild.mockResolvedValue({});
    const { onOpenChange } = mount();
    await screen.findByTestId("sandbox-card");

    // every row starts closed
    const rows = within(card()).getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    expect(rows.map((button) => button.getAttribute("aria-label") ?? button.textContent).length).toBeGreaterThanOrEqual(9);
    for (const button of rows) expect(button.getAttribute("aria-expanded")).toBe("false");
    // the closed Field row says there are suggestions and that nothing is set
    const described = row("Field").getAttribute("aria-describedby") ?? "";
    expect(described.split(" ").map((id) => document.getElementById(id)?.textContent)).toEqual(["Not set", expect.stringMatching(/\d suggestions?$/)]);

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
    fireEvent.click(screen.getByRole("option", { name: /Add "Sorting socks" as your own entry/ }));

    // dispute Skill needed
    fireEvent.click(row("Read from your build"));
    fireEvent.click(screen.getByRole("button", { name: "Dispute Skill needed" }));
    fireEvent.change(screen.getByLabelText("Corrected value for Skill needed"), { target: { value: "writing-code" } });
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
    fireEvent.click(row("Read from your build"));
    const questions = screen.getByRole("region", { name: "Questions" });
    expect(within(questions).getByText(/deployed, but it shows no code/)).toBeTruthy();
    expect(within(questions).getAllByRole("button", { name: "Add code" }).length).toBeGreaterThan(0);
    fireEvent.click(within(questions).getAllByRole("button", { name: "Dismiss" })[0]);
    expect(screen.queryByText(/deployed, but it shows no code/)).toBeNull();
    expect(screen.getByRole("button", { name: "Source of What was built" })).toBeTruthy();
  });
});

describe("Classification Card: before the database update is applied", () => {
  it("shows the one line, still saves the title, and never throws", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: "column builds.classification does not exist" } });
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      if ("classification" in patch) throw { code: "PGRST204", message: "Could not find the 'classification' column of 'builds'" };
      return {};
    });
    const onDescription = vi.fn();
    const { onTitle, onOpenChange } = mount({ onDescription });
    expect(await screen.findByText(NOT_LIVE_LINE)).toBeTruthy();
    expect(screen.getAllByText(NOT_LIVE_LINE)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Policy finder" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onTitle).toHaveBeenCalledWith("Policy finder");
    // the shape still lands, because it needs no new column
    expect(updateBuild).toHaveBeenCalledWith("b1", { shape: "app" });
  });

  it("builds from steps the page already has: nothing breaks for a build with no tiles", async () => {
    live();
    mount({}, []);
    await screen.findByTestId("sandbox-card");
    expect(buildSteps([])).toEqual([]);
    expect(row("Read from your build").getAttribute("aria-expanded")).toBe("false");
  });
});
