// Acceptance cover for the compose route.
//
// The five behaviours NS-P07 is judged on that a type checker cannot see: one
// build per visit to /compose/new, a return-to on the way to login, a forbidden
// state that writes nothing, a debounced title, and the single-column collapse.

import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const createBuild = vi.fn();
const getBuild = vi.fn();
const updateBuild = vi.fn();
vi.mock("@/lib/build", () => ({
  createBuild: (input: unknown) => createBuild(input),
  getBuild: (id: string) => getBuild(id),
  updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
}));

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";

const OWNED = {
  id: "b1",
  creator_id: "me",
  slug: "inbox-triage-agent-demo",
  title: "Untitled build",
  shape: "other",
  status: "draft",
};

const record = (build: Record<string, unknown>) => ({
  build,
  tree: [],
  tray: [],
  events: [],
  nodeTypes: [],
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
}

function renderAt(path: string, { strict = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/compose/new" element={<Compose />} />
            <Route path="/compose/:buildId" element={<Compose />} />
            <Route path="/login" element={<span>login page</span>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  createBuild.mockReset();
  getBuild.mockReset();
  updateBuild.mockReset();
  auth.user = { id: "me" };
  auth.isLoggedIn = true;
  auth.loading = false;
});

describe("Compose", () => {
  it("creates exactly one build under strict mode and replaces /compose/new", async () => {
    createBuild.mockResolvedValue(OWNED);
    getBuild.mockResolvedValue(record(OWNED));

    renderAt("/compose/new", { strict: true });

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe("/compose/b1")
    );
    // The double-invoked effect must not insert a second row.
    expect(createBuild).toHaveBeenCalledTimes(1);
    expect(createBuild).toHaveBeenCalledWith({ title: "Untitled build" });
  });

  it("sends an unauthenticated visitor to login with a return-to", async () => {
    auth.isLoggedIn = false;
    auth.user = null;

    renderAt("/compose/new");

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe(
        "/login?redirect=%2Fcompose%2Fnew"
      )
    );
    expect(createBuild).not.toHaveBeenCalled();
  });

  it("shows a forbidden state for another creator's build and issues no write", async () => {
    getBuild.mockResolvedValue(record({ ...OWNED, creator_id: "someone-else" }));

    renderAt("/compose/b1");

    expect(await screen.findByText("This build isn't yours")).toBeTruthy();
    expect(screen.queryByLabelText("Build title")).toBeNull();
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("debounces the title into one write and settles the save indicator", async () => {
    getBuild.mockResolvedValue(record(OWNED));
    updateBuild.mockResolvedValue({ ...OWNED, title: "Inbox triage" });

    renderAt("/compose/b1");

    const title = (await screen.findByLabelText("Build title")) as HTMLInputElement;
    // Scoped to the top bar: the workspace's drag layer keeps a live region of
    // its own, so an unscoped status role now matches more than one element.
    const bar = () => within(screen.getByRole("banner"));
    expect(bar().getByRole("status").textContent).toContain("Draft");

    for (const value of ["Inbox", "Inbox tri", "Inbox triage"]) {
      fireEvent.change(title, { target: { value } });
    }
    // Optimistic: the field shows the keystrokes before any response.
    expect(title.value).toBe("Inbox triage");

    await waitFor(
      () => expect(bar().getByRole("status").textContent).toContain("Saved"),
      { timeout: 3000 }
    );
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(updateBuild).toHaveBeenCalledWith("b1", { title: "Inbox triage" });
  });

  it("renders three panels wide and one column below the breakpoint", async () => {
    getBuild.mockResolvedValue(record(OWNED));

    const { container, unmount } = renderAt("/compose/b1");
    await screen.findByLabelText("Build title");

    for (const slot of ["compose-left", "compose-centre", "compose-right"]) {
      expect(container.querySelector(`[data-visual-slot="${slot}"]`)).toBeTruthy();
    }
    unmount();

    const wide = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...wide(query),
      matches: true,
    })) as typeof window.matchMedia;
    try {
      const narrow = renderAt("/compose/b1");
      await screen.findByLabelText("Build title");

      expect(narrow.container.querySelector('[data-visual-slot="compose-centre"]')).toBeTruthy();
      expect(narrow.container.querySelector('[data-visual-slot="compose-left"]')).toBeNull();
      expect(narrow.container.querySelector('[data-visual-slot="compose-right"]')).toBeNull();

      // Both rails stay reachable from the top bar: the tray behind its own
      // control, the inspector as a sheet. Asserted before the sheet opens —
      // an open Radix sheet aria-hides everything behind it, by design.
      expect(screen.getByRole("button", { name: "Tray" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Inspector" }));
      expect(await screen.findByText(/typed fields/)).toBeTruthy();
    } finally {
      window.matchMedia = wide;
    }
  });
});
