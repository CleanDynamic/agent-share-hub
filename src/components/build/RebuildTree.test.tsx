// A build's family of rebuilds, drawn (RC-P14): one row per build, each
// generation indented one step through a list with a connector on its leading
// side, the build being read marked and not linked, and a phone that stops
// indenting after depth 4. Plus the Rebuilds tab's THE FAMILY, above the list
// that was there before.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTree, flattenFamily, type RebuildTreeNode, type RebuildTreeRow } from "@/lib/build/lineage";
import type { RebuildSummary } from "@/lib/build";

const getBuildFamily = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getBuildFamily: (input: unknown) => getBuildFamily(input),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { RebuildFamily, RebuildTree } from "@/components/build/RebuildTree";
import { RebuildsTab } from "@/components/build/RebuildsTab";

function row(id: string, parent: string | null, depth: number, over: Partial<RebuildTreeRow> = {}): RebuildTreeRow {
  return {
    id,
    parent_build_id: parent,
    depth,
    slug: `slug-${id}`,
    title: `Build ${id}`,
    creator_id: `maker-${id}`,
    published_at: "2026-09-01T10:00:00.000Z",
    reproduction_count: 0,
    rebuild_note: null,
    maker: { id: `maker-${id}`, username: `handle-${id}`, display_name: `Maker ${id}`, avatar_url: null },
    ...over,
  };
}

/** root → a → a1, root → b: three generations. */
function family(): RebuildTreeNode {
  return buildTree([
    row("root", null, 0, { reproduction_count: 12 }),
    row("a", "root", 1, { rebuild_note: "Swapped the model\nand cut two steps" }),
    row("b", "root", 1),
    row("a1", "a", 2),
  ]) as RebuildTreeNode;
}

/** A chain six generations deep under the root. */
function deepChain(): RebuildTreeNode {
  const rows = [row("d0", null, 0)];
  for (let depth = 1; depth <= 6; depth += 1) rows.push(row(`d${depth}`, `d${depth - 1}`, depth));
  return buildTree(rows) as RebuildTreeNode;
}

function renderWith(ui: React.ReactElement, width = 1440) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** How many indenting lists (24 in, a --line rule) stand between a row and the tree's edge. */
function indentsAbove(element: HTMLElement): number {
  let count = 0;
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.getAttribute("data-testid") === "rebuild-tree") break;
    if (node.tagName === "OL" && node.style.paddingInlineStart === "24px") count += 1;
  }
  return count;
}

describe("RebuildTree", () => {
  beforeEach(() => vi.clearAllMocks());

  it("draws one row per build in the family, in reading order", () => {
    const root = family();
    renderWith(<RebuildTree root={root} currentId="b" />);

    const rows = screen.getAllByTestId("rebuild-tree-row");
    expect(rows).toHaveLength(flattenFamily(root).length);
    expect(rows.map((element) => element.getAttribute("data-depth"))).toEqual(["0", "1", "2", "1"]);
    expect(screen.getAllByTestId("rebuild-tree-title").map((element) => element.textContent)).toEqual([
      "Build root",
      "Build a",
      "Build a1",
      "Build b",
    ]);
  });

  it("indents each generation one step, through a list with a --line connector on its leading side", () => {
    renderWith(<RebuildTree root={family()} currentId="b" />);

    for (const element of screen.getAllByTestId("rebuild-tree-row")) {
      expect(indentsAbove(element)).toBe(Number(element.getAttribute("data-depth")));
    }
    const generation = screen.getAllByTestId("rebuild-tree-row")[1].parentElement as HTMLElement;
    expect(generation.tagName).toBe("OL");
    expect(generation.style.paddingInlineStart).toBe("24px");
    expect(generation.style.borderInlineStart).toBe("1px solid var(--line)");
  });

  it("marks the build being read, and does not link it", () => {
    renderWith(<RebuildTree root={family()} currentId="a" />);

    const current = screen.getAllByTestId("rebuild-tree-row")[1];
    const own = within(current).getAllByTestId("rebuild-tree-title")[0];
    expect(own.tagName).not.toBe("A");
    expect(own).toHaveAttribute("aria-current", "true");
    expect(within(current).getAllByTestId("rebuild-tree-here")[0]).toHaveTextContent("you are here");
    expect(screen.getAllByTestId("rebuild-tree-here")).toHaveLength(1);
  });

  it("links every other build's title to its page", () => {
    renderWith(<RebuildTree root={family()} currentId="a" />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/b2/slug-root",
      "/b2/slug-a1",
      "/b2/slug-b",
    ]);
  });

  it("names each maker and counts reproductions in DM Mono with tabular figures", () => {
    renderWith(<RebuildTree root={family()} currentId="b" />);

    const root = screen.getAllByTestId("rebuild-tree-row")[0];
    expect(root).toHaveTextContent("Maker root");
    const count = within(root).getAllByTestId("rebuild-tree-reproduced")[0];
    expect(count).toHaveTextContent("12 reproduced");
    expect(count.style.fontFamily).toContain("DM Mono");
    expect(count.style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("puts the rebuilder's note on one clamped DM Mono 12 line after a Δ, and only when there is one", () => {
    renderWith(<RebuildTree root={family()} currentId="b" />);

    const notes = screen.getAllByTestId("rebuild-tree-note");
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe("Δ Swapped the model and cut two steps");
    expect(notes[0].style.fontFamily).toContain("DM Mono");
    expect(notes[0].style.fontSize).toBe("12px");
    expect(notes[0].style.whiteSpace).toBe("nowrap");
    expect(notes[0].style.textOverflow).toBe("ellipsis");
  });

  it("keeps indenting past depth 4 on a wide screen, with no depth labels", () => {
    renderWith(<RebuildTree root={deepChain()} currentId="d0" />, 1440);

    const deepest = screen.getAllByTestId("rebuild-tree-row").at(-1) as HTMLElement;
    expect(indentsAbove(deepest)).toBe(6);
    expect(screen.queryAllByTestId("rebuild-tree-depth")).toHaveLength(0);
  });

  it("stops indenting after depth 4 below 768, and says the depth instead", () => {
    renderWith(<RebuildTree root={deepChain()} currentId="d0" />, 390);

    const rows = screen.getAllByTestId("rebuild-tree-row");
    for (const element of rows) {
      const depth = Number(element.getAttribute("data-depth"));
      expect(indentsAbove(element)).toBe(Math.min(depth, 4));
    }
    expect(screen.getAllByTestId("rebuild-tree-depth").map((element) => element.textContent)).toEqual([
      "depth 5",
      "depth 6",
    ]);
  });
});

describe("RebuildFamily", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for the family from its root, for the build being read", async () => {
    getBuildFamily.mockResolvedValue(family());
    renderWith(<RebuildFamily rootId="root" currentId="a" />);

    expect(await screen.findAllByTestId("rebuild-tree-row")).toHaveLength(4);
    expect(getBuildFamily).toHaveBeenCalledWith({ rootId: "root", currentId: "a" });
  });

  it("shows what it is given for empty when nobody has rebuilt anything in the family", async () => {
    getBuildFamily.mockResolvedValue(buildTree([row("root", null, 0)]));
    renderWith(<RebuildFamily rootId="root" currentId="root" empty={<p>No rebuilds yet.</p>} />);

    expect(await screen.findByText("No rebuilds yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("rebuild-tree")).toBeNull();
  });

  it("says a refusal is a refusal", async () => {
    getBuildFamily.mockRejectedValue(
      Object.assign(new Error("getRebuildTree failed"), { cause: { code: "42501" } }),
    );
    renderWith(<RebuildFamily rootId="root" currentId="a" />);

    const error = await screen.findByTestId("rebuild-family-error");
    expect(error).toHaveTextContent("You don't have access to this.");
    expect(within(error).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the Rebuilds tab's family", () => {
  beforeEach(() => vi.clearAllMocks());

  const direct: RebuildSummary = {
    id: "a",
    slug: "slug-a",
    title: "Build a",
    creator: { id: "maker-a", username: "handle-a", display_name: null, avatar_url: null },
    rebuild_note: null,
    created_at: "2026-09-01T10:00:00.000Z",
    forked_from_event_id: null,
    reproduction_count: 0,
  };

  it("draws THE FAMILY above the list of direct rebuilds, which is unchanged", async () => {
    getBuildFamily.mockResolvedValue(family());
    renderWith(<RebuildsTab rebuilds={[direct]} family={{ rootId: "root", currentId: "root" }} />);

    const heading = screen.getByRole("heading", { name: "The family" });
    expect(heading.style.fontFamily).toContain("DM Mono");
    expect(heading.style.fontSize).toBe("12px");
    expect(heading.style.textTransform).toBe("uppercase");

    const section = screen.getByTestId("rebuild-family");
    const list = screen.getByTestId("rebuilds-tab");
    expect(section.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await within(section).findAllByTestId("rebuild-tree-row")).toHaveLength(4);
    expect(within(list).getByTestId("rebuild-row")).toHaveAttribute("href", "/b2/slug-a");
  });

  it("draws no family, and asks for none, when it is not given one", () => {
    renderWith(<RebuildsTab rebuilds={[direct]} />);

    expect(screen.queryByTestId("rebuild-family")).toBeNull();
    expect(getBuildFamily).not.toHaveBeenCalled();
  });
});
