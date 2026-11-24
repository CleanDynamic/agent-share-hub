// Prompt 22 — the build page on a phone: the head, the actions and the Download sheet, the sections as pills, the section
// bodies' phone cards, and the read-only notepad as a bottom sheet.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Notepad } from "@/components/brand/Notepad";
import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";

import { BreakageBody } from "./BreakageBody";
import type { BuildViewProps } from "./BuildView";
import { BuildView } from "./BuildView";
import { stepTabs } from "./buildModel";
import { RebuildsBody } from "./RebuildsBody";

function stepsProps(over: Partial<BuildViewProps> = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture("mobile");
  return { ...base, hero: { ...base.hero, title, outcome }, viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps, ...over };
}

const mount = (props: BuildViewProps) =>
  render(
    <MemoryRouter>
      <BuildView {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("the build page on a phone (prompt 22)", () => {
  it("heads with the title as the h1, then Rebuild, then Copy for AI, Download and Lineage in one row", () => {
    mount(stepsProps());
    expect(screen.getByRole("heading", { level: 1, name: "Bakery homepage" })).toBeTruthy();
    const dock = screen.getByRole("group", { name: "Take this build" });
    const controls = within(dock).getAllByRole("button").map((button) => button.textContent);
    expect(controls.slice(0, 3)).toEqual(["Rebuild", "Copy for AI", "Download"]);
    expect(within(dock).getByRole("link", { name: "Lineage" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/reproduc|confirmed|stale|plaque/i);
  });

  it("says a rebuild's source and offers Compare with the original", () => {
    const props = stepsProps();
    mount({ ...props, actions: { ...props.actions, compareTo: "/b2/a/compare/b" }, hero: { ...props.hero, credit: { rebuiltFrom: { title: "Inbox sorter", handle: "kofi" }, madeBy: null } } });
    expect(screen.getByTestId("build-credit").textContent).toBe("Rebuilt from Inbox sorter by @kofi");
    expect(screen.getByRole("link", { name: "Compare with the original" }).getAttribute("href")).toBe("/b2/a/compare/b");
  });

  it("opens the Download sheet once the build has a setup: the build, the folder, then one row per harness", () => {
    const onDownloadSetup = vi.fn();
    const onDownload = vi.fn();
    const props = stepsProps();
    mount({ ...props, actions: { ...props.actions, onDownload, onDownloadSetup } });
    fireEvent.click(screen.getByTestId("build-download"));
    const sheet = screen.getByRole("dialog", { name: "Download" });
    expect(within(sheet).getByText("Rebuild in")).toBeTruthy();
    const rows = within(sheet).getAllByRole("button").filter((button) => button.getAttribute("data-ui") === "phone-row");
    expect(rows.map((row) => row.textContent)).toEqual(["The build", "The setup, as a folder", "Claude CodeHarness", "OpenClawHarness", "Hermes AgentHarness", "Devin DesktopHarness"]);
    fireEvent.click(rows[4]);
    expect(onDownloadSetup).toHaveBeenCalledWith("hermes-agent");
    expect(onDownload).not.toHaveBeenCalled();
  });

  it("draws the sections as tabs only when there is more than Steps, and swaps the section in place", () => {
    const onTabChange = vi.fn();
    const props = stepsProps();
    mount({ ...props, viewer: { ...props.viewer, tabs: stepTabs(true, { events: true }), onTabChange } });
    const tabs = within(screen.getByRole("tablist", { name: "Sections of this build" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Steps", "Watch it get built", "Rebuilds"]);
    fireEvent.click(tabs[2]);
    expect(onTabChange).toHaveBeenCalledWith("rebuilds");
  });

  it("puts What you need, then the owner's Completeness, then Classification after the section", () => {
    const props = stepsProps();
    mount({ ...props, proof: { ...props.proof, completeness: { score: 72, publishAt: 40, galleryAt: 60, next: null } }, classification: <section data-testid="build-classification" /> });
    const order = ["build-steps", "build-need", "build-completeness", "build-classification"].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("build-completeness").textContent).toContain("72 of 100 · Gallery lists from 60");
  });
});

describe("the section bodies on a phone", () => {
  it("Where it broke: a card per breakage with Open the replay, and the empty line", () => {
    const onOpenReplay = vi.fn();
    const { unmount } = render(
      <BreakageBody
        phone
        breakage={{ rows: [{ key: "a", name: "Failed on euro totals", happened: null, fix: "Read the currency.", span: "step 3", start: 3, attempts: null }], gaps: [{ id: "g", title: "Tolerance", problem: null, topicId: null }], onOpenReplay }}
      />,
    );
    expect(screen.getByText("Step 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Watch step 3 in the replay" }));
    expect(onOpenReplay).toHaveBeenCalledWith(3);
    expect(screen.getByText("Left open on purpose: the build works without it.")).toBeTruthy();
    unmount();
    render(<BreakageBody phone breakage={{ rows: [], gaps: [] }} />);
    expect(screen.getByText("Either nothing broke, or nothing was written down. Both are worth knowing.")).toBeTruthy();
  });

  it("Rebuilds: the count as the heading, each rebuild a card link, and the empty line", () => {
    const { unmount } = render(
      <MemoryRouter>
        <RebuildsBody phone rebuilds={{ cards: [{ key: "r", render: () => null, summary: { title: "Kit's take", to: "/b2/kit", meta: "@kit · 9 steps" } }], loading: false, lineageTo: "/b2/x/lineage" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "1 rebuild" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Kit's take" }).getAttribute("href")).toBe("/b2/kit");
    expect(screen.getByText("@kit · 9 steps")).toBeTruthy();
    unmount();
    render(
      <MemoryRouter>
        <RebuildsBody phone rebuilds={{ cards: [], loading: false, lineageTo: "/b2/x/lineage" }} />
      </MemoryRouter>,
    );
    expect(screen.getByText("This build has no rebuilds yet.")).toBeTruthy();
  });
});

describe("the reader's notepad on a phone", () => {
  it("is a bottom sheet in the Notepad tone: what it belongs to, the title, the text and the count", () => {
    render(<Notepad open onClose={() => undefined} field="Instructions" title="Order helper rules" context="Agent · Order helper" value="Take the order." />);
    const sheet = screen.getByTestId("notepad");
    expect(sheet.getAttribute("data-fill")).toBe("notepad");
    expect(within(sheet).getByText("Agent · Order helper · Instructions")).toBeTruthy();
    expect(within(sheet).getByTestId("notepad-title").textContent).toBe("Order helper rules");
    expect(within(sheet).getByTestId("notepad-count").textContent).toBe("15 characters");
    expect(within(sheet).getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});
