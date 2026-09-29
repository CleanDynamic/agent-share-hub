// /b2/:slug/lineage and the old /b/:slug/lineage, rendered (RC-P14): the page
// resolves its slug to a build and draws the build's family; with nobody's
// rebuild in it, it says so and offers the one next step; the old address
// moves to the new one when its slug names a build.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTree, type RebuildTreeRow } from "@/lib/build/lineage";

const getBuildHeaderBySlug = vi.fn();
const getBuildFamily = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getBuildHeaderBySlug: (slug: string) => getBuildHeaderBySlug(slug),
  getBuildFamily: (input: unknown) => getBuildFamily(input),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import Lineage from "@/pages/Lineage";

const BUILD = {
  id: "build-a",
  slug: "inbox-triage-gmail",
  title: "Inbox triage, Gmail only",
  root_build_id: "build-root",
  status: "published",
};

function row(id: string, parent: string | null, depth: number): RebuildTreeRow {
  return {
    id,
    parent_build_id: parent,
    depth,
    slug: `slug-${id}`,
    title: `Build ${id}`,
    creator_id: "maker",
    published_at: "2026-09-01T10:00:00.000Z",
    reproduction_count: 0,
    rebuild_note: null,
    maker: null,
  };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/b2/:slug/lineage" element={<><Lineage /><Where /></>} />
            <Route path="/b/:slug/lineage" element={<><Lineage legacy /><Where /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("the lineage page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    getBuildHeaderBySlug.mockResolvedValue(BUILD);
    getBuildFamily.mockResolvedValue(
      buildTree([row("build-root", null, 0), row("build-a", "build-root", 1), row("build-a1", "build-a", 2)]),
    );
  });

  it("says what it is: Rebuilds of this, every published rebuild in this family", async () => {
    renderAt("/b2/inbox-triage-gmail/lineage");

    expect(screen.getByRole("heading", { level: 1, name: "Rebuilds of this" })).toBeInTheDocument();
    expect(screen.getByText("Every published rebuild in this family.")).toBeInTheDocument();
    await screen.findByTestId("rebuild-tree");
  });

  it("resolves the slug and draws the family from its root, with this build marked", async () => {
    renderAt("/b2/inbox-triage-gmail/lineage");

    expect(await screen.findAllByTestId("rebuild-tree-row")).toHaveLength(3);
    expect(getBuildHeaderBySlug).toHaveBeenCalledWith("inbox-triage-gmail");
    expect(getBuildFamily).toHaveBeenCalledWith({ rootId: "build-root", currentId: "build-a" });
    const current = screen.getAllByTestId("rebuild-tree-row")[1];
    expect(within(current).getAllByTestId("rebuild-tree-here")[0]).toHaveTextContent("you are here");
  });

  it("draws from the build itself when it has no root", async () => {
    getBuildHeaderBySlug.mockResolvedValue({ ...BUILD, root_build_id: null });
    renderAt("/b2/inbox-triage-gmail/lineage");

    await screen.findByTestId("rebuild-tree");
    expect(getBuildFamily).toHaveBeenCalledWith({ rootId: "build-a", currentId: "build-a" });
  });

  it("says so in one sentence, with Rebuild this, when nobody has rebuilt anything in the family", async () => {
    getBuildHeaderBySlug.mockResolvedValue({ ...BUILD, root_build_id: null });
    getBuildFamily.mockResolvedValue(buildTree([row("build-a", null, 0)]));
    renderAt("/b2/inbox-triage-gmail/lineage");

    const empty = await screen.findByTestId("lineage-empty");
    expect(empty).toHaveTextContent("No rebuilds yet.");
    const links = within(empty).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Rebuild this");
    expect(links[0]).toHaveAttribute("href", "/rebuild/inbox-triage-gmail");
    expect(screen.queryByTestId("rebuild-tree")).toBeNull();
  });

  it("says there is no build at an address that names none", async () => {
    getBuildHeaderBySlug.mockResolvedValue(null);
    renderAt("/b2/nothing-here/lineage");

    expect(await screen.findByTestId("lineage-not-found")).toHaveTextContent("No build at this address.");
    expect(getBuildFamily).not.toHaveBeenCalled();
  });

  it("moves the old address to the new one when its slug names a build", async () => {
    renderAt("/b/inbox-triage-gmail/lineage");

    expect(await screen.findByText("/b2/inbox-triage-gmail/lineage")).toHaveAttribute("data-testid", "where");
    expect(await screen.findAllByTestId("rebuild-tree-row")).toHaveLength(3);
  });

  it("keeps the old address, saying there is no build at it, when its slug names none", async () => {
    getBuildHeaderBySlug.mockResolvedValue(null);
    renderAt("/b/an-old-post/lineage");

    expect(await screen.findByTestId("lineage-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/b/an-old-post/lineage");
  });
});
