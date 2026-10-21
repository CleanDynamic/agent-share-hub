import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
vi.mock("@/lib/build", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build")>()), getBuildBySlug: (...a: unknown[]) => getBuildBySlug(...a) }));
vi.mock("@/components/shell/useBreadcrumb", () => ({ useCrumbTitle: () => undefined }));

import { ComparePage } from "./ComparePage";

const record = (id: string, slug: string, root: string | null, title: string) => ({
  build: { id, slug, title, root_build_id: root, making: {} },
  tree: [{ id: `${id}-p`, build_id: id, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "hello there", build_cost: { ms: 2000, tokensIn: 100 } }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [] }],
  tray: [],
  events: [],
  nodeTypes: [],
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  getBuildBySlug.mockReset();
});
afterEach(() => cleanup());

function mount(path = "/b2/copy/compare/orig") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/b2/:slug/compare/:otherSlug" element={<ComparePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ComparePage (CA-13 P9)", () => {
  it("compares two builds that share a root", async () => {
    getBuildBySlug.mockImplementation(async (slug: string) => (slug === "orig" ? record("r", "orig", null, "Original") : record("c", "copy", "r", "The rebuild")));
    mount();
    expect(await screen.findByTestId("compare-view")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Original" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "The rebuild" })).toBeTruthy();
  });

  it("refuses two builds that do not share a root, in plain words", async () => {
    getBuildBySlug.mockImplementation(async (slug: string) => (slug === "orig" ? record("r", "orig", null, "Original") : record("c", "copy", "other", "Elsewhere")));
    mount();
    expect(await screen.findByText("These two are not builds of the same thing.")).toBeTruthy();
    expect(screen.queryByTestId("compare-view")).toBeNull();
  });

  it("says so when one of them is not here", async () => {
    getBuildBySlug.mockImplementation(async (slug: string) => (slug === "orig" ? record("r", "orig", null, "Original") : null));
    mount();
    expect(await screen.findByText("One of those builds is not here.")).toBeTruthy();
  });
});
