import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_FIXTURE_NOW, DASHBOARD_FIXTURE_ROWS } from "@/dev/fixtures/gallery-dashboard";
import { LABS } from "@/lib/models/registry";

import { GalleryDashboardView, type GalleryDashboardViewProps } from "./GalleryDashboardView";
import { dashboardCounts } from "./dashboardModel";

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
    onConnect: vi.fn(),
    onOpenBuild: vi.fn(),
    onCloseBuild: vi.fn(),
    onOpenModel: vi.fn(),
    ...extra,
  };
}

function view(extra: Partial<GalleryDashboardViewProps> = {}) {
  const p = props(extra);
  render(
    <MemoryRouter>
      <GalleryDashboardView {...p} />
    </MemoryRouter>,
  );
  return p;
}

describe("GalleryDashboardView", () => {
  it("draws the table: a header, a row per build, sorted by engagement", () => {
    view();
    const table = screen.getByRole("table", { name: "Builds" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Build",
      "AI models",
      "Sessions",
      "Prompts",
      "AI turns",
      "Engagement",
      "Activity",
      "Last activity",
      "",
    ]);
    const rows = screen.getAllByTestId("dash-row");
    expect(rows).toHaveLength(10);
    expect(within(rows[0]).getByRole("button", { name: "CV tailored to a job ad" })).toBeTruthy();
    expect(within(rows[1]).getByTestId("dash-model-count").textContent).toBe("3");
    expect(within(rows[1]).getByText("+1")).toBeTruthy();
  });

  it("titles Engagement and AI turns, and the engagement cell breaks the total down", () => {
    view();
    expect(screen.getByRole("columnheader", { name: "AI turns" }).getAttribute("title")).toBe(
      "Messages back and forth with the AI, across every session",
    );
    expect(screen.getByRole("columnheader", { name: "Engagement" }).getAttribute("title")).toBe(
      "Runs, rebuilds, comments and saves from other people",
    );
    expect(screen.getAllByTitle("62 runs · 12 rebuilds · 0 comments · 0 saves")).toHaveLength(1);
  });

  it("reads the pill, the heading and the sidebar counts", () => {
    view({ lab: "Google" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Builds");
    expect(screen.getByTestId("dash-pill").textContent).toBe("Google models");
    expect(screen.getByTestId("dash-nav-builds").getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("dash-lab-Google").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("dash-lab-Google").textContent).toContain("3");
    expect(screen.getByTestId("dash-nav-models").textContent).toContain("12");
  });

  it("choosing a lab again clears it", () => {
    const p = view({ lab: "Google" });
    fireEvent.click(screen.getByTestId("dash-lab-Google"));
    expect(p.onLabChange).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByTestId("dash-lab-OpenAI"));
    expect(p.onLabChange).toHaveBeenCalledWith("OpenAI");
  });

  it("ticks rows, shows how many, and select-all goes mixed then full", () => {
    view();
    const all = screen.getByRole("checkbox", { name: "Select all builds" });
    expect(all.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select CV tailored to a job ad" }));
    expect(all.getAttribute("aria-checked")).toBe("mixed");
    expect(screen.getByTestId("dash-footer").textContent).toContain("10 builds in view · 1 selected");
    fireEvent.click(all);
    expect(all.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("dash-footer").textContent).toContain("10 selected");
    fireEvent.click(all);
    expect(all.getAttribute("aria-checked")).toBe("false");
  });

  it("shows the footer's calculations only while they are on", () => {
    view();
    const footer = screen.getByTestId("dash-footer");
    expect(footer.textContent).not.toContain("161");
    fireEvent.click(within(footer).getByRole("button", { name: /Sum of prompts/ }));
    expect(footer.textContent).toContain("161");
    fireEvent.click(within(footer).getByRole("button", { name: /Avg sessions per build/ }));
    expect(footer.textContent).toContain("2.8");
    expect(within(footer).getByText("+ Add calculation").getAttribute("aria-disabled")).toBe("true");
  });

  it("opens a build from its title and from its action button", () => {
    const p = view();
    fireEvent.click(screen.getByRole("button", { name: "Open details for CV tailored to a job ad" }));
    fireEvent.click(screen.getByRole("button", { name: "Pull request reviewer for small teams" }));
    expect(p.onOpenBuild).toHaveBeenCalledTimes(2);
  });

  it("says so when no build matches, and clears the filters", () => {
    const p = view({ rows: [] });
    expect(screen.getByText("No builds match these filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(p.onClearFilters).toHaveBeenCalled();
  });

  it("shows the drafts box only when signed in", () => {
    const { unmount } = render(
      <MemoryRouter>
        <GalleryDashboardView {...props()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("dash-drafts")).toBeNull();
    unmount();
    view({ drafts: { count: 3 } });
    expect(screen.getByTestId("dash-drafts").textContent).toContain("3 drafts");
    expect(screen.getByRole("link", { name: "Open drafts" }).getAttribute("href")).toBe("/drafts");
  });

  it("does not crash on loading or error", () => {
    view({ status: "loading" });
    expect(screen.getByRole("status", { name: "Loading builds" })).toBeTruthy();
  });

  it("lists model versions by prompts, with the new badge and a last-used build, and a version filters the builds", () => {
    const p = view({ tab: "models" });
    const table = screen.getByRole("table", { name: "Models" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Model version",
      "Lab",
      "Builds",
      "Sessions",
      "Prompts",
      "AI turns",
      "Engagement",
      "Last used",
    ]);
    const sonnet = screen.getAllByTestId("dash-model-row").find((row) => within(row).queryByRole("button", { name: "Sonnet 5.5" }));
    expect(sonnet).toBeTruthy();
    expect(within(sonnet!).getByText("new")).toBeTruthy();
    expect(within(sonnet!).getByText("Anthropic")).toBeTruthy();
    fireEvent.click(within(sonnet!).getByRole("button", { name: "Sonnet 5.5" }));
    expect(p.onOpenModel).toHaveBeenCalledWith("sonnet-5-5");
  });

  it("applies the Labs filter on the Models tab", () => {
    view({ tab: "models", lab: "OpenAI" });
    const names = screen.getAllByTestId("dash-model-row").map((row) => within(row).getAllByRole("cell")[1].textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((lab) => lab === "OpenAI")).toBe(true);
  });

  it("puts a model the registry does not name last, without a button", () => {
    const [first, ...rest] = DASHBOARD_FIXTURE_ROWS;
    const odd = { ...first, making: { sessions: [{ client: "X", model: "mystery-1", prompts: 999, turns: 1 }] } };
    view({ tab: "models", rows: [odd, ...rest] });
    const rows = screen.getAllByTestId("dash-model-row");
    const last = rows[rows.length - 1];
    expect(within(last).getAllByRole("cell")[0].textContent).toBe("mystery-1");
    expect(within(last).queryByRole("button")).toBeNull();
    expect(within(last).getAllByRole("cell")[1].textContent).toBe("—");
  });

  it("lists makers by engagement with a profile link", () => {
    view({ tab: "makers" });
    const rows = screen.getAllByTestId("dash-maker-row");
    expect(rows).toHaveLength(10);
    expect(within(rows[0]).getByRole("link", { name: "@dana" }).getAttribute("href")).toBe("/profile/dana");
    expect(within(rows[1]).getByRole("link", { name: "@kofi" })).toBeTruthy();
    expect(within(rows[2]).getByRole("link", { name: "@maria" })).toBeTruthy();
  });

  it("opens the detail sheet for openId, with the four stats and the sessions", () => {
    const photo = DASHBOARD_FIXTURE_ROWS.find((row) => row.title === "Photo renamer by date taken")!;
    const p = view({ openId: photo.id });
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { level: 2 }).textContent).toBe("Photo renamer by date taken");
    expect(within(sheet).getByRole("link", { name: "@maria" })).toBeTruthy();
    expect(sheet.textContent).toContain("made for Photographers");
    expect(within(sheet).getAllByTestId("sheet-session")).toHaveLength(2);
    expect(within(sheet).getByRole("link", { name: "Open the build" }).getAttribute("href")).toBe(`/b2/${photo.slug}`);
    expect(within(sheet).getByRole("link", { name: "How does proof work?" }).getAttribute("href")).toBe("/about#proof");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close details" }));
    expect(p.onCloseBuild).toHaveBeenCalled();
  });

  it("changes the sheet's total with the 7 / 30 / 90 toggle", () => {
    const photo = DASHBOARD_FIXTURE_ROWS.find((row) => row.title === "Photo renamer by date taken")!;
    view({ openId: photo.id });
    const total = () => screen.getByTestId("sheet-window-total").textContent;
    expect(total()).toBe("8");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(total()).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(total()).toBe("14");
  });
});
