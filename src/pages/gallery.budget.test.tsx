// The gallery's choice budgets, counted in the rendered page (RC-P10)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// Every number here is a budget from hicks-law's table, and each is counted by
// role and accessible name in the DOM a reader gets, never read off a
// constant: a lens row of four, one lens checked, two facet groups, six
// options a group before "More", one filled button at most, and no sort
// control at all. A failing budget means the change is wrong, not the test;
// moving a budget needs the owner's decision in the diary first.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGallery = vi.fn();
const getGalleryFacets = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    listGallery: (options: unknown) => listGallery(options),
    getGalleryFacets: () => getGalleryFacets(),
  };
});
vi.mock("@/lib/profile/searchMakers", () => ({ searchMakers: async () => [] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import Gallery from "@/pages/Gallery";

/** Nine of each, so a group has more to hide than the budget shows. */
const facet = (value: string, count: number) => ({ value, count, label: null, logo_url: null });
const FACETS = {
  roles: ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((v, i) => facet(`role-${v}`, 20 - i)),
  tools: ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((v, i) => facet(`tool-${v}`, 30 - i)),
};

function build() {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "inbox-triage",
    title: "Inbox triage agent",
    outcome: "Triages an inbox in under a minute.",
    shape: "app",
    status: "published",
    made_for: ["role-a"],
    made_with: ["tool-a"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    completeness: 82,
    reproduction_count: 4,
    last_confirmed_at: "2026-08-20T00:00:00Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T00:00:00Z",
    nodes: [],
    media: [],
  };
}

function renderAt(entry: string, width = 1440) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Gallery />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

/** The chips of one facet group: the toggles, not the More control. */
const optionsIn = (group: HTMLElement) =>
  within(group)
    .getAllByRole("button")
    .filter((element) => element.hasAttribute("aria-pressed"));

describe("the gallery's choice budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGalleryFacets.mockResolvedValue(FACETS);
    listGallery.mockResolvedValue({ builds: [build()], total: 1 });
  });

  it("offers exactly four lenses, with exactly one checked, and All by default", async () => {
    renderAt("/gallery");
    await screen.findByText("Inbox triage agent");

    const lenses = within(screen.getByRole("radiogroup", { name: "Lens" })).getAllByRole("radio");
    expect(lenses.map((lens) => lens.textContent)).toEqual(["All", "Proven", "Rebuilt", "Unsolved"]);
    const checked = lenses.filter((lens) => lens.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent("All");
  });

  it("keeps exactly one lens checked whichever lens the address names", async () => {
    renderAt("/gallery?lens=unsolved");
    await screen.findByText("Inbox triage agent");

    const lenses = within(screen.getByRole("radiogroup", { name: "Lens" })).getAllByRole("radio");
    expect(lenses.filter((lens) => lens.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("has two facet groups, each showing at most six options before More", async () => {
    renderAt("/gallery");
    await screen.findByText("Inbox triage agent");

    const groups = within(screen.getByRole("region", { name: "Filters" })).getAllByRole("group");
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(optionsIn(group).length).toBeLessThanOrEqual(6);
      expect(within(group).getByRole("button", { name: "More" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
  });

  it("keeps a selected option visible even when it ranks below the six", async () => {
    renderAt("/gallery?for=role-i");
    await screen.findByText("Inbox triage agent");

    const [madeFor] = within(screen.getByRole("region", { name: "Filters" })).getAllByRole("group");
    expect(optionsIn(madeFor).length).toBeLessThanOrEqual(6);
    expect(within(madeFor).getByTestId("facet-made-for-role-i")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("has at most one filled button, and no sort control", async () => {
    renderAt("/gallery?q=inbox");
    await screen.findByText("Inbox triage agent");

    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]').length).toBeLessThanOrEqual(1);
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox", { name: /sort/i })).toHaveLength(0);
  });

  it("holds the same lens budget on a phone, where the facets fold into one control", async () => {
    renderAt("/gallery", 390);
    await screen.findByText("Inbox triage agent");

    expect(
      within(screen.getByRole("radiogroup", { name: "Lens" })).getAllByRole("radio"),
    ).toHaveLength(4);
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
  });
});
