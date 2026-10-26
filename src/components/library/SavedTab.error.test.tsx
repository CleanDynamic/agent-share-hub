// SV-03 P5: when Saved fails it says so in its own panel, with Retry, and never "Something went wrong".

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "reader-1" }, isLoggedIn: true }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) }, storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}));
const listMySavedBuilds = vi.fn();
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  listMySavedBuilds: (...args: unknown[]) => listMySavedBuilds(...args),
  getEngagementCounts: vi.fn(async () => ({})),
  getMyLikes: vi.fn(async () => new Set()),
  getMySaves: vi.fn(async () => new Set()),
}));

import { SavedTab } from "./LibraryBuilds";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SavedTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Library › Saved, when it fails", () => {
  it("says Saved didn't load, offers Retry, and Retry loads it", async () => {
    listMySavedBuilds.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ items: [], nextBefore: null });
    mount();
    expect(await screen.findByText("Saved didn't load.")).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("library-saved-empty")).toBeInTheDocument());
    expect(listMySavedBuilds).toHaveBeenCalledTimes(2);
  });
});
