// SV-03 P2: the Drafts page counts the empty drafts beside the list, and removes them behind the confirm window.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listDraftsWithSessions = vi.fn();
const listEmptyDraftIds = vi.fn();
const removeEmptyDrafts = vi.fn();
vi.mock("@/lib/build/drafts", () => ({
  listDraftsWithSessions: (...args: unknown[]) => listDraftsWithSessions(...args),
  listEmptyDraftIds: (...args: unknown[]) => listEmptyDraftIds(...args),
  removeEmptyDrafts: (...args: unknown[]) => removeEmptyDrafts(...args),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/components/connect/ConnectorDialog", () => ({ useConnectorDialog: () => ({ open: vi.fn() }) }));
vi.mock("@/hooks/useLibrarySessions", () => ({
  librarySessionsKey: ["build", "listLibrarySessions"],
  useLibrarySessions: () => ({ data: [], isError: false, isLoadingError: false, error: null, refetch: vi.fn(), hasMore: false, loadingMore: false, fetchMore: vi.fn(), unfinished: [] }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { DraftsPage } from "./DraftsPage";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("pointer: fine"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  listDraftsWithSessions.mockReset().mockResolvedValue([{ id: "d1", title: "One", updatedAt: "2026-10-01T00:00:00Z", sessionCount: 1 }]);
  listEmptyDraftIds.mockReset().mockResolvedValue(["e1", "e2"]);
  removeEmptyDrafts.mockReset().mockResolvedValue(2);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HelmetProvider>
        <MemoryRouter>
          <DraftsPage />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("DraftsPage · empty drafts", () => {
  it("lists the drafts for the signed-in maker with the id from the session, and counts the empty ones", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Remove empty drafts (2)" })).toBeInTheDocument();
    expect(listDraftsWithSessions).toHaveBeenCalledWith("u1");
    expect(listEmptyDraftIds).toHaveBeenCalledWith("u1");
  });

  it("removes them in one call after the window is confirmed, then reads the lists again", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Remove empty drafts (2)" }));
    expect(removeEmptyDrafts).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeEmptyDrafts).toHaveBeenCalledTimes(1));
    expect(removeEmptyDrafts).toHaveBeenCalledWith("u1");
    await waitFor(() => expect(listDraftsWithSessions.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows no such button when there are no empty drafts", async () => {
    listEmptyDraftIds.mockResolvedValue([]);
    mount();
    await screen.findByText("One");
    expect(screen.queryByRole("button", { name: /Remove empty drafts/ })).toBeNull();
  });
});
