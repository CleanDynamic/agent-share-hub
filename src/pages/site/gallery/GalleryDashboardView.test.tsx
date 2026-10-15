// UI-P89 — the Gallery dashboard in the refined look, rendered with the dev fixture: the same parts, names, copy and
// handlers as `GalleryDashboardView`, drawn as the refined board draws them.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values); roles and names on the rendered tree.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_FIXTURE_NOW, DASHBOARD_FIXTURE_ROWS } from "@/dev/fixtures/gallery-dashboard";
import { LABS } from "@/lib/models/registry";

import type { GalleryDashboardViewProps } from "./GalleryDashboardView";
import { GalleryDashboardView } from "./GalleryDashboardView";
import { dashboardCounts } from "./dashboardModel";

const REFINED = "/dev/kit/pages/gallery-dashboard";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function props(extra: Partial<GalleryDashboardViewProps> = {}): GalleryDashboardViewProps {
  return {
    tab: "builds",
    onTabChange: vi.fn(),
    onViewChange: vi.fn(),
    rows: DASHBOARD_FIXTURE_ROWS,
    allRows: DASHBOARD_FIXTURE_ROWS,
    counts: dashboardCounts(DASHBOARD_FIXTURE_ROWS, LABS, DASHBOARD_FIXTURE_NOW),
    status: "ready",
    onRetry: vi.fn(),
    query: null,
    onSearch: vi.fn(),
    model: null,
    onModelChange: vi.fn(),
    lab: null,
    onLabChange: vi.fn(),
    audience: null,
    onAudienceChange: vi.fn(),
    report: null,
    onReportChange: vi.fn(),
    active: null,
    onActiveChange: vi.fn(),
    sort: "engagement",
    onSortChange: vi.fn(),
    onClearFilters: vi.fn(),
    drafts: { count: 3 },
    onConnect: vi.fn(),
    onOpenBuild: vi.fn(),
    onCloseBuild: vi.fn(),
    onOpenModel: vi.fn(),
    ...extra,
  };
}

const tree = (p: GalleryDashboardViewProps) => (
  <MemoryRouter initialEntries={[REFINED]}>
    <GalleryDashboardView {...p} />
  </MemoryRouter>
);

function view(extra: Partial<GalleryDashboardViewProps> = {}) {
  const p = props(extra);
  render(tree(p));
  return p;
}

describe("GalleryDashboardView", () => {
  it("lays the sidebar and the content out as the board does, with no panels", () => {
    const html = renderToStaticMarkup(tree(props()));
    expect(html).toContain("flex:1 1 208px;max-width:224px");
    expect(html).toContain("border-right:1px solid var(--hairline)");
    expect(html).toContain("flex:999 1 640px");
    expect(html).not.toContain('data-ui="panel"');
    expect(html).not.toContain("Sentient");
  });

  it("keeps the sidebar's names and handlers, with each lab's real mark and no initial tile", () => {
    const p = view();
    const nav = screen.getByRole("navigation", { name: "Dashboard" });
    expect(within(nav).getByTestId("dash-nav-builds").getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(nav).getByTestId("dash-nav-models"));
    expect(p.onTabChange).toHaveBeenCalledWith("models");

    const labs = screen.getByRole("group", { name: "Labs" });
    const anthropic = within(labs).getByTestId("dash-lab-Anthropic");
    expect(anthropic.querySelector('[data-mark="anthropic"]')).not.toBeNull();
    expect(anthropic.textContent).toBe("Anthropic7");
    fireEvent.click(anthropic);
    expect(p.onLabChange).toHaveBeenCalledWith("Anthropic");

    fireEvent.click(within(screen.getByRole("group", { name: "Reporting" })).getByTestId("dash-report-month"));
    expect(p.onReportChange).toHaveBeenCalledWith("month");
    fireEvent.click(screen.getByRole("button", { name: "Connect a tool" }));
    expect(p.onConnect).toHaveBeenCalled();
    expect(within(screen.getByTestId("dash-drafts")).getByRole("link", { name: "Open drafts" }).getAttribute("href")).toBe("/drafts");
  });

  it("draws the title row, the tabs and the filter row with the refined controls", () => {
    const p = view();
    expect(screen.getByRole("heading", { level: 1, name: "Builds" })).toBeTruthy();
    expect(screen.getByTestId("dash-pill").textContent).toBe("All models");
    expect(screen.getByRole("searchbox", { name: "Search the gallery" })).toBeTruthy();
    const views = screen.getByRole("radiogroup", { name: "Gallery view" });
    fireEvent.click(within(views).getByRole("radio", { name: "Feed" }));
    expect(p.onViewChange).toHaveBeenCalledWith("feed");
    fireEvent.click(within(screen.getByRole("tablist", { name: "Dashboard tabs" })).getByRole("tab", { name: "Makers" }));
    expect(p.onTabChange).toHaveBeenCalledWith("makers");
    for (const key of ["sort", "model", "for", "active"]) {
      expect(screen.getByTestId(`dash-menu-${key}`).getAttribute("data-ui")).toBe("menu-button");
    }
    expect(screen.getByTestId("dash-export").textContent).toBe("Export");
  });

  it("draws a row per build on the board's grid, model tags with marks, and the actions' names", () => {
    const p = view();
    const rows = screen.getAllByTestId("dash-row");
    expect(rows).toHaveLength(DASHBOARD_FIXTURE_ROWS.length);
    expect(within(rows[0]).getByRole("checkbox", { name: /^Select / })).toBeTruthy();
    expect(rows.some((row) => row.querySelector("[data-mark]") !== null)).toBe(true);
    const open = within(rows[0]).getByRole("button", { name: /^Open details for / });
    fireEvent.click(open);
    expect(p.onOpenBuild).toHaveBeenCalledTimes(1);

    const html = renderToStaticMarkup(tree(props()));
    expect(html).toContain("grid-template-columns:minmax(0, 2.6fr) minmax(0, 1.7fr) 64px 64px 64px 80px 72px minmax(0, 1.5fr) 28px");
    expect(html).toContain("height:36px");
    expect(html).toContain("height:48px");
  });

  it("gives a ticked row the tile fill and counts it in the summary bar", () => {
    view();
    const rows = screen.getAllByTestId("dash-row");
    fireEvent.click(within(rows[1]).getByRole("checkbox"));
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
    /* jsdom drops var() values, so the fill is read from the hairline it replaces. */
    expect(rows[1].getAttribute("style")).toContain("border-bottom: 1px solid transparent");
    expect(rows[0].getAttribute("style")).not.toContain("border-bottom: 1px solid transparent");
    expect(screen.getByTestId("dash-footer").textContent).toContain("1 selected");
    expect(screen.getByRole("checkbox", { name: "Select all builds" }).getAttribute("aria-checked")).toBe("mixed");
  });

  it("presses a calculation and shows its value; Add calculation stays disabled", () => {
    view();
    const sum = screen.getByRole("button", { name: /^Sum of prompts/ });
    expect(sum.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(sum);
    expect(sum.getAttribute("aria-pressed")).toBe("true");
    expect(sum.textContent).toMatch(/Sum of prompts\d+/);
    expect(screen.getByText("+ Add calculation").getAttribute("aria-disabled")).toBe("true");
  });

  it("draws the Models and Makers tabs, the empty line and the failure", () => {
    const { rerender } = render(tree(props({ tab: "models" })));
    expect(screen.getAllByTestId("dash-model-row").length).toBeGreaterThan(0);
    rerender(tree(props({ tab: "makers" })));
    expect(screen.getAllByTestId("dash-maker-row").length).toBeGreaterThan(0);
    rerender(tree(props({ rows: [] })));
    expect(screen.getByTestId("dash-empty").querySelector("p")?.textContent).toBe("No builds match these filters.");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
    rerender(tree(props({ status: "error" })));
    expect(screen.getByRole("button", { name: /try again|retry/i })).toBeTruthy();
  });
});
