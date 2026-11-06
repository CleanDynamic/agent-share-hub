// UX-13 P4. Share and copy-link write the openbuilds.ai address, whichever address the reader is on.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

import { EngagementRow } from "@/components/social/EngagementRow";

afterEach(() => vi.unstubAllGlobals());

describe("UX-13 P4 · copy link", () => {
  it("writes https://openbuilds.ai/b2/<slug> to the clipboard", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <EngagementRow
            variant="page"
            build={{ id: "b1", slug: "inbox-triage", title: "Inbox triage agent", rebuild_count: 0 }}
            counts={{ likes: 0, comments: 0 }}
            liked={false}
            saved={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://openbuilds.ai/b2/inbox-triage"));
  });
});
