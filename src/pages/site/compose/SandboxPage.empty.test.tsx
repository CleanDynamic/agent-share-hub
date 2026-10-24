// CA-24 P2 - the empty build, on the real page (SandboxPage behind supabase-js, only the network faked).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend } from "@/lib/build/__audit__/fakeSupabase";

import { SandboxPage } from "./SandboxPage";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(path: string) {
  startAuditBackend({ schema: REPO_SCHEMA });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <AuthProvider>
            <ConnectorDialogProvider>
              <Routes>
                <Route path="/compose/new" element={<SandboxPage />} />
                <Route path="/compose/:buildId" element={<SandboxPage />} />
              </Routes>
            </ConnectorDialogProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("CA-24 P2 · a new post is an empty build", () => {
  it("shows Add your first session under the post, and neither the default Session 1 nor the add rows", async () => {
    mount("/compose/new");
    const panel = await screen.findByTestId("empty-build", undefined, { timeout: 10_000 });
    expect(within(panel).getByRole("heading", { name: "Add your first session" })).toBeTruthy();
    expect(within(panel).getByText("Import from connected chats")).toBeTruthy();
    expect(within(panel).getByText("New empty session")).toBeTruthy();
    expect(within(panel).getByText("Drop sessions or files")).toBeTruthy();
    // It stands in the Build column, after the post.
    const post = screen.getByTestId("sandbox-post");
    expect(post.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("add-session-row")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Add a prompt" })).toBeNull();
    expect(screen.queryByTestId("session-head")).toBeNull();
  });

  it("counts the library's sessions that are not in this build, as many as the list it opens offers", async () => {
    mount("/compose/new");
    const chats = await screen.findByTestId("empty-build-chats", undefined, { timeout: 10_000 });
    await waitFor(() => expect(/(\d+) available$/.exec(chats.textContent ?? "")?.[1]).not.toBe("0"), { timeout: 10_000 });
    const said = Number(/(\d+) available$/.exec(chats.textContent ?? "")?.[1]);
    expect(said).toBeGreaterThan(0);
    fireEvent.click(chats);
    const rows = within(await screen.findByTestId("add-session-picker")).getAllByTestId("library-row") as HTMLButtonElement[];
    expect(rows.filter((row) => !row.disabled)).toHaveLength(said);
  });

  it("New empty session starts Session 1, and the panel goes", async () => {
    mount("/compose/new");
    fireEvent.click(await screen.findByTestId("empty-build-new", undefined, { timeout: 10_000 }));
    await waitFor(() => expect(screen.queryByTestId("empty-build")).toBeNull(), { timeout: 10_000 });
    await waitFor(() => expect(screen.getAllByTestId("session-head").length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(screen.getByTestId("add-session-row")).toBeTruthy();
  });

  it("Add › Prompt writes the first prompt: the panel gives way to the prompt box", async () => {
    mount("/compose/new");
    await screen.findByTestId("empty-build", undefined, { timeout: 10_000 });
    fireEvent.keyDown(await screen.findByTestId("sandbox-add"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Prompt/ }));
    await screen.findByRole("textbox", { name: "Add a prompt" });
    expect(screen.queryByTestId("empty-build")).toBeNull();
  });
});
