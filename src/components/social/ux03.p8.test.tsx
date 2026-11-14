// UX-03 P8: a count of zero is not printed. In the engagement row its slot keeps its width, and the accessible name carries
// the count when there is one. (The sign-in page's counts went with the page, into the sign-in dialog, which has none.)

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) }, storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}));

import { EngagementRow } from "@/components/social/EngagementRow";

const providers = (node: ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

const draw = (likes: number, comments: number, rebuilds: number) =>
  render(providers(<EngagementRow variant="card" withRebuild build={{ id: "b1", slug: "fox", title: "Fox poster", rebuild_count: rebuilds }} counts={{ likes, comments }} liked={false} saved={false} />));

const count = (action: string) => document.querySelector(`[data-engagement-action="${action}"] [data-engagement-count]`) as HTMLElement;

describe("UX-03 P8: the engagement row", () => {
  it("prints no zero, keeps each count's slot, and names each action without a count", () => {
    draw(0, 0, 0);
    for (const action of ["like", "comment", "rebuild"]) {
      expect(count(action).textContent).toBe("");
      expect(count(action).style.minWidth).toBe("2ch");
    }
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByRole("button", { name: "Like" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Rebuild" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("prints a count above zero, and says it in the action's name", () => {
    draw(2, 1, 3);
    expect(count("like").textContent).toBe("2");
    expect(screen.getByRole("button", { name: "Like, 2 likes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment, 1 comment" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Rebuild, 3 rebuilds" })).toBeTruthy();
    // The number is said once, in the name.
    expect(count("like").getAttribute("aria-hidden")).toBe("true");
  });
});
