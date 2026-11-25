// Mobile prompt 28 Parts D and E on a phone: the rules' numbered list, not found centred over a still dot field, the progress
// builds as Cards, and the admin's reports as Panel modules whose detail is a pushed page.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/useMinWidth", async (original) => ({
  ...(await original<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => true,
  useMinWidth: () => false,
}));
vi.mock("@/lib/moderation", async (original) => ({
  ...(await original<typeof import("@/lib/moderation")>()),
  listOpenReports: vi.fn(async () => ({
    reports: [
      {
        id: "r1",
        reason: "spam",
        targetType: "openbuild_post",
        targetId: "p1",
        postKind: "topic",
        summary: { text: "How to get 1000 followers", href: "/openbuilds/topics/p1" },
        note: null,
        reporter: { displayName: null, username: "newuser1" },
        createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
    ],
    nextBefore: null,
  })),
  listSiteHiddenPosts: vi.fn(async () => []),
}));

import { rules } from "@/content/legal/rules";
import { AdminLayout } from "@/components/admin/AdminFrame";
import { YourBuilds } from "@/components/analytics/BuildAnalytics";
import { ReportsQueue } from "@/components/moderation/ReportsQueue";

import { FooterPageView } from "./legal/FooterPageView";
import { NotFoundView } from "./notfound/NotFoundView";

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

describe("community rules on a phone", () => {
  it("numbers the rules in a box and hides the h1 the top bar already shows", () => {
    wrap(<FooterPageView text={rules} path="/rules" />);
    const number = screen.getAllByTestId("footer-number")[0];
    expect(number.textContent).toBe("1");
    expect(number.style.width).toBe("28px");
    expect(number.style.borderRadius).toBe("8px");
    expect(screen.getByRole("heading", { level: 1 }).className).toBe("sr-only");
    expect(screen.getByRole("navigation", { name: "Related pages" })).toBeTruthy();
  });
});

describe("not found on a phone", () => {
  it("is centred over a still dot field, with Go to Home as the main button", () => {
    const home = vi.fn();
    wrap(<NotFoundView path="/nowhere" onHome={home} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.style.fontSize).toBe("20px");
    expect(document.activeElement).toBe(heading);
    const go = screen.getByRole("button", { name: "Go to Home" });
    expect(go.getAttribute("data-variant")).toBe("main");
    fireEvent.click(go);
    expect(home).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Browse builds" })).toBeTruthy();
    expect(screen.getByTestId("not-found-path").textContent).toBe("/nowhere");
    const dots = screen.getByTestId("not-found-dots");
    expect(dots.style.opacity).toBe("0.4");
    expect(dots.querySelector("pattern")?.getAttribute("width")).toBe("6");
  });
});

describe("progress on a phone", () => {
  it("draws each build as a Card with its numbers in a grid, no run numbers", () => {
    const build = { id: "b1", slug: "a", title: "Invoice triage", reproduction_count: 9, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-11-01T00:00:00Z", rebuild_count: 3, like_count: 12, comment_count: 1, save_count: 4, view_count: 1530, runs: 7, worked: 5, failed_last_30_days: 0, still_open: 0 };
    wrap(<YourBuilds stats={{ builds: [build] } as never} loading={false} error={null} onRetry={() => undefined} />);
    expect(screen.getByRole("heading", { name: "1 build" })).toBeTruthy();
    const card = screen.getByTestId("build-stats-row");
    expect(within(card).getByRole("link", { name: "Invoice triage" })).toBeTruthy();
    expect([...card.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Views", "Rebuilds", "Likes", "Saved"]);
    expect([...card.querySelectorAll("dd")].map((dd) => dd.textContent)).toEqual(["1,530", "3", "12", "4"]);
    expect(card.textContent).not.toMatch(/run|reproduc|confirmed/i);
    expect(screen.queryByTestId("build-stats-table")).toBeNull();
  });
});

describe("admin reports on a phone", () => {
  it("draws each report as a Panel module and pushes its detail page on a tap", async () => {
    wrap(
      <AdminLayout head={null}>
        <ReportsQueue />
      </AdminLayout>,
    );
    const row = await screen.findByTestId("report-row");
    // The reason, 13/600 (its Warn colour is a var(), which jsdom's colour parser drops).
    const reason = within(row).getByRole("button", { name: "Spam: How to get 1000 followers" });
    expect(reason.textContent).toBe("Spam");
    expect(reason.style.fontSize).toBe("13px");
    expect(reason.style.fontWeight).toBe("600");
    expect(within(row).getByText("OpenBuilds · How to get 1000 followers")).toBeTruthy();
    expect(row.textContent).toContain("Reported by @newuser1 · ");
    expect(within(row).getByRole("button", { name: "Hide" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Dismiss" })).toBeTruthy();
    fireEvent.click(within(row).getByText("OpenBuilds · How to get 1000 followers"));
    await waitFor(() => expect(screen.getByTestId("admin-detail-page")).toBeTruthy());
    expect(screen.getByRole("dialog", { name: "OpenBuilds reported as spam" })).toBeTruthy();
  });
});
