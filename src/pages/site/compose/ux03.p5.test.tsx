// UX-03 P5: the Classification window, a closed row with suggestions offers the first one, and Accept takes it in one action.
// The same real data hook and storage layer over a mocked database as SandboxCard.test.tsx, so what is checked is what would be written.

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

/** The Optional row's own container, around its head button. */
const rowBox = (name: string) => row(name).closest("[data-testid='optional-field']") as HTMLElement;

/** What Save wrote as the classification, if anything. */
const written = () => updateBuild.mock.calls.map((call) => call[1] as Record<string, unknown>).find((patch) => "classification" in patch) ?? null;

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
  await waitFor(() => expect(written()).not.toBeNull());
  return written();
}

describe("UX-03 P5: accept a suggestion in one action", () => {
  it("shows a closed row with suggestions and no value its first suggestion and Accept", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const field = rowBox("Field");
    expect(row("Field").getAttribute("aria-expanded")).toBe("false");
    // F20: the suggestion is a chip beside Not set, never the look of a value.
    const first = within(field).getByTestId("optional-suggested-chip").textContent?.replace(/^Suggested: /, "") ?? "";
    expect(first).not.toBe("");
    expect(within(field).getByTestId("optional-line").textContent).toBe("Not set");
    expect(within(field).getByRole("button", { name: `Accept ${first} as Field` }).textContent).toBe("Accept");
    // Opened, the row's picker offers that same suggestion first.
    fireEvent.click(row("Field"));
    expect(within(screen.getByRole("list", { name: "Field, suggestions" })).getAllByRole("button")[0].textContent?.endsWith(first)).toBe(true);
    // A row with no suggestions has no Accept.
    expect(within(rowBox("Data handled")).queryByRole("button", { name: /^Accept/ })).toBeNull();
  });

  it("fills the row with that suggestion, and saves it as choosing it inside the row does", async () => {
    live();
    updateBuild.mockResolvedValue({});
    mount();
    await screen.findByTestId("sandbox-card");
    const first = within(rowBox("Field")).getByTestId("optional-suggested-chip").textContent?.replace(/^Suggested: /, "") ?? "";
    fireEvent.click(within(rowBox("Field")).getByRole("button", { name: `Accept ${first} as Field` }));
    expect(row("Field").getAttribute("aria-expanded")).toBe("false");
    expect(row("Field").textContent).toContain(first);
    expect(within(rowBox("Field")).queryByRole("button", { name: /^Accept/ })).toBeNull();
    const accepted = await save();
    cleanup();

    resetClassificationColumns();
    updateBuild.mockReset();
    updateBuild.mockResolvedValue({});
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Field"));
    fireEvent.click(within(screen.getByRole("list", { name: "Field, suggestions" })).getAllByRole("button")[0]);
    const chosen = await save();
    expect(accepted).toEqual(chosen);
  });

  it("still shows every suggestion when the row is opened", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    fireEvent.click(row("Field"));
    const offered = screen.getByRole("list", { name: "Field, suggestions" });
    expect(within(offered).getAllByRole("button").length).toBeGreaterThan(0);
    expect(within(rowBox("Field")).queryByRole("button", { name: /^Accept/ })).toBeNull();
  });

  it("keeps Summary directly under Title, as a row of the Optional rows", async () => {
    live();
    mount();
    await screen.findByTestId("sandbox-card");
    const rows = within(card()).getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    expect(rows[0].textContent?.startsWith("Summary")).toBe(true);
    const title = screen.getByTestId("card-title-block");
    expect(title.compareDocumentPosition(rows[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[0].closest("[data-testid='optional-field']")).not.toBeNull();
  });
});
