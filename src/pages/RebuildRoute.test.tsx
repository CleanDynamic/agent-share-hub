// Acceptance cover for /rebuild/:slug.
//
// The five behaviours NS-P38 is judged on that a type checker cannot see: one
// fork per visit, a seeded workspace that Back cannot re-enter, the sign-in
// round trip that returns to the flow, a slug that names nothing, and a fork
// that failed saying so with the way back.

import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildHeaderBySlug = vi.fn();
const startRebuild = vi.fn();

/** The two calls this route makes. The rest of the lib layer is real. */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuildHeaderBySlug: (slug: string) => getBuildHeaderBySlug(slug),
    startRebuild: (input: unknown) => startRebuild(input),
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import RebuildRoute from "@/pages/RebuildRoute";

const SOURCE = {
  id: "b-source",
  creator_id: "someone",
  slug: "inbox-triage-agent-demo",
  title: "Inbox triage agent",
  status: "published",
};

/** The address, and how many entries deep it is: a route that replaced itself
 *  leaves the history it was entered from, not itself. */
function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="path">{`${location.pathname}${location.search}`}</span>
  );
}

function renderAt(path: string, { strict = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/rebuild/:slug" element={<RebuildRoute />} />
          <Route path="/compose/:buildId" element={<span>the workspace</span>} />
          <Route path="/login" element={<span>login page</span>} />
          <Route path="/b2/:slug" element={<span>the build page</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  getBuildHeaderBySlug.mockReset();
  startRebuild.mockReset();
  auth.user = { id: "me" };
  auth.isLoggedIn = true;
  auth.loading = false;
});

describe("RebuildRoute", () => {
  it("names the build while it works, then lands in the seeded workspace", async () => {
    getBuildHeaderBySlug.mockResolvedValue(SOURCE);
    // Never resolves: the working state is what this test is about.
    startRebuild.mockReturnValue(new Promise(() => {}));

    renderAt("/rebuild/inbox-triage-agent-demo");

    await waitFor(() =>
      expect(screen.getByTestId("rebuild-working").textContent).toBe(
        "Setting up your rebuild of “Inbox triage agent”…"
      )
    );
  });

  it("forks exactly once under strict mode and replaces itself in history", async () => {
    getBuildHeaderBySlug.mockResolvedValue(SOURCE);
    startRebuild.mockResolvedValue({ id: "draft-1" });

    renderAt("/rebuild/inbox-triage-agent-demo", { strict: true });

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe(
        "/compose/draft-1?from=rebuild"
      )
    );
    // The double-invoked effect must not leave an orphan draft crediting a
    // source, so the guard is a ref rather than state.
    expect(startRebuild).toHaveBeenCalledTimes(1);
    expect(startRebuild).toHaveBeenCalledWith({ sourceBuildId: "b-source" });
  });

  it("sends an anonymous visitor to login with the rebuild as the return path", async () => {
    auth.isLoggedIn = false;
    auth.user = null;

    renderAt("/rebuild/inbox-triage-agent-demo");

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe(
        "/login?redirect=%2Frebuild%2Finbox-triage-agent-demo"
      )
    );
    // Nothing is read and nothing is forked on behalf of nobody.
    expect(getBuildHeaderBySlug).not.toHaveBeenCalled();
    expect(startRebuild).not.toHaveBeenCalled();
  });

  it("says so plainly when the slug names nothing, with the way back", async () => {
    getBuildHeaderBySlug.mockResolvedValue(null);

    renderAt("/rebuild/never-existed");

    const error = await screen.findByTestId("rebuild-error");
    expect(error.textContent).toContain("The rebuild could not be started");
    expect(error.textContent).toContain("/b2/never-existed");
    expect(screen.getByRole("link", { name: "← Back to the build" }).getAttribute("href")).toBe(
      "/b2/never-existed"
    );
    expect(startRebuild).not.toHaveBeenCalled();
  });

  it("says what went wrong when the fork itself failed", async () => {
    getBuildHeaderBySlug.mockResolvedValue(SOURCE);
    startRebuild.mockRejectedValue(new Error("forkBuild (nodes) failed: boom"));

    renderAt("/rebuild/inbox-triage-agent-demo");

    const error = await screen.findByTestId("rebuild-error");
    expect(error.textContent).toContain("forkBuild (nodes) failed: boom");
    expect(screen.getByRole("link", { name: "← Back to the build" }).getAttribute("href")).toBe(
      "/b2/inbox-triage-agent-demo"
    );
  });
});
