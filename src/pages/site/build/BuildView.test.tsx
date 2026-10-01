// UI-P29 — the Build page's first screen: both layouts, every control's callback, the states.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";

import { BuildView, BuildViewNotice, BuildViewSkeleton, PHONE_PARTS, type BuildViewProps } from "./BuildView";
import { buildTabs } from "./buildModel";

function mount(over: Partial<BuildViewProps> = {}, viewport: "desktop" | "mobile" = "desktop") {
  const props: BuildViewProps = { ...buildFixture(viewport), ...over };
  return {
    props,
    ...render(
      <MemoryRouter>
        <BuildView fit="content" {...props} />
      </MemoryRouter>,
    ),
  };
}

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.useRealTimers();
});

describe("BuildView on a desktop", () => {
  it("has one h1, the title, on the plate with the credit, the Δ and the mark square", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Invoice triage agent" })).toBeTruthy();
    const hero = screen.getByTestId("build-hero");
    expect(within(hero).getByText("Inbox sorter").tagName).toBe("I");
    expect(hero.textContent).toContain("by @kofi · made by @maya");
    expect(within(hero).getByText("Δ swapped model, added retry step")).toBeTruthy();
    expect(hero.querySelector('[data-ui="hero-plate-mark"]')).not.toBeNull();
  });

  it("tags the shape, and says when the record came through the connector", () => {
    mount();
    expect(screen.getByTestId("build-shape-tag").textContent).toBe("agent · via connector");
    const base = buildFixture();
    mount({ hero: { ...base.hero, viaConnector: false } });
    expect(screen.getAllByTestId("build-shape-tag")[1].textContent).toBe("agent");
  });

  it("docks the four actions on the hero, blurred, with Lineage as a link", () => {
    mount();
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(screen.getByTestId("build-hero")).toContainElement(dock);
    expect(dock.style.backdropFilter).toContain("blur(16px)");
    expect(within(dock).getByRole("button", { name: "Copy for AI" })).toBeTruthy();
    expect(within(dock).getByRole("button", { name: "Download" })).toBeTruthy();
    expect(within(dock).getByRole("button", { name: "Rebuild" })).toBeTruthy();
    expect(within(dock).getByRole("link", { name: "Lineage" }).getAttribute("href")).toBe("/b2/invoice-triage-agent/lineage");
  });

  it("copies for AI and says so politely", async () => {
    vi.useFakeTimers();
    const onCopyForAI = vi.fn().mockResolvedValue(true);
    const base = buildFixture();
    mount({ actions: { ...base.actions, onCopyForAI } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    });
    expect(onCopyForAI).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(60);
    });
    const live = screen.getByTestId("build-live");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("Copied");
  });

  it("downloads and rebuilds through the callbacks", () => {
    const onDownload = vi.fn();
    const onRebuild = vi.fn();
    const base = buildFixture();
    mount({ actions: { ...base.actions, onDownload, onRebuild } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    fireEvent.click(screen.getByRole("button", { name: "Rebuild" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });

  it("proves it: the orb, the plaque, the one primary and the six details", () => {
    const onPress = vi.fn();
    const base = buildFixture();
    mount({ proof: { ...base.proof, action: { kind: "reproduce", onPress } } });
    const proof = screen.getByTestId("build-proof");
    expect(within(proof).getByText("41 ran it")).toBeTruthy();
    expect(within(proof).getByText("last 27 Sep")).toBeTruthy();
    expect(proof.querySelector('[data-plaque-size="proof"]')?.textContent).toContain("last confirmed working 3 days ago");
    fireEvent.click(screen.getByRole("button", { name: "I ran this and it worked" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Your run relights the lamp and records the model you used.")).toBeTruthy();
    for (const label of ["Made for", "Made with", "Setup", "Monthly", "First result", "Needs"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("£12")).toBeTruthy();
    expect(screen.getByText("20 min")).toBeTruthy();
  });

  it("asks the creator to re-confirm, and a stranger to sign in", () => {
    const base = buildFixture();
    mount({ proof: { ...base.proof, action: { kind: "reconfirm", onPress: vi.fn() } } });
    expect(screen.getByRole("button", { name: "Re-confirm it still works" })).toBeTruthy();
    mount({ proof: { ...base.proof, action: { kind: "sign-in", onPress: vi.fn() } } });
    expect(screen.getByRole("button", { name: "Sign in to confirm" })).toBeTruthy();
  });

  it("shows completeness, with its two ticks and the next step, only when it is given", () => {
    mount();
    const block = screen.getByTestId("build-completeness");
    expect(block.textContent).toContain("86 / 100");
    expect(block.textContent).toContain("PUBLISH 60");
    expect(block.textContent).toContain("GALLERY 80");
    expect(block.textContent).toContain("Next: add a link to where it runs.");
    expect(within(block).getByRole("progressbar", { name: "Completeness" }).getAttribute("aria-valuenow")).toBe("86");

    const base = buildFixture();
    const { container } = mount({ proof: { ...base.proof, completeness: null } });
    expect(container.querySelector('[data-testid="build-completeness"]')).toBeNull();
  });

  it("lists every part as a button, marks the selected one and the gap, and selects through the callback", () => {
    const onSelect = vi.fn();
    const base = buildFixture();
    mount({ anatomy: { ...base.anatomy, onSelect } });
    const anatomy = screen.getByTestId("build-anatomy");
    expect(within(anatomy).getByRole("heading", { level: 2, name: "Anatomy" })).toBeTruthy();
    expect(anatomy.textContent).toContain("8 parts · 1 left open");
    const rows = within(anatomy).getAllByTestId("build-part-row");
    expect(rows).toHaveLength(8);
    expect(rows[0].getAttribute("aria-current")).toBe("true");
    expect(rows[1].getAttribute("aria-current")).toBeNull();
    const gap = rows.find((row) => row.hasAttribute("data-gap"))!;
    expect(gap.textContent).toContain("£150 ask");
    expect(gap.style.borderStyle).toBe("dashed");
    fireEvent.click(rows[2]);
    expect(onSelect).toHaveBeenCalledWith("part-3");
  });

  it("opens the full anatomy in a dialog", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Show the full anatomy" }));
    const dialog = screen.getByRole("dialog", { name: "Anatomy" });
    expect(within(dialog).getByText("Why a person decides")).toBeTruthy();
  });

  it("frames the selected part, with BuildTabs' keys as tabs and the switch beside Copy", () => {
    const onTabChange = vi.fn();
    const onModeChange = vi.fn();
    const base = buildFixture();
    mount({ viewer: { ...base.viewer, tabs: buildTabs(true), onTabChange, onModeChange } });
    const viewer = screen.getByTestId("build-viewer");
    expect(within(viewer).getByText("PART 01")).toBeTruthy();
    expect(viewer.textContent).toContain("01 · System prompt");
    const tabs = within(viewer).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Anatomy",
      "Watch it get built",
      "Run it yourself",
      "Understand it",
      "Where it broke",
      "Rebuilds",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(within(viewer).getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("build-viewer-tab-anatomy");
    fireEvent.click(tabs[1]);
    expect(onTabChange).toHaveBeenCalledWith("watch");
    fireEvent.click(within(viewer).getByRole("button", { name: "Run" }));
    expect(onModeChange).toHaveBeenCalledWith("run");
    expect(within(viewer).getByText("What each step does, and why, in plain language.")).toBeTruthy();
  });

  it("copies the part through the callback", async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const base = buildFixture();
    mount({ viewer: { ...base.viewer, onCopy } });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId("build-viewer")).getByRole("button", { name: "Copy" }));
    });
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("draws the kept events, and plays the build through the callback", () => {
    const onPlay = vi.fn();
    const base = buildFixture();
    mount({ timeline: { ...base.timeline, onPlay } });
    const timeline = screen.getByTestId("build-timeline");
    expect(timeline.textContent).toContain("26 minutes · 5 events kept");
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(within(timeline).getByRole("button", { name: "Play the build" }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("does not crash on a build with no parts and no kept steps", () => {
    const base = buildFixture();
    mount({
      anatomy: { ...base.anatomy, parts: [], gaps: 0, selectedId: null },
      timeline: { events: [], duration: null, onPlay: vi.fn() },
    });
    expect(screen.getByText("Nothing has been placed in this build yet.")).toBeTruthy();
    expect(screen.getByText("No steps were kept for this build.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play the build" })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Nothing placed yet")).toBeTruthy();
  });
});

describe("BuildView on a phone", () => {
  it("puts the tiles under the hero, drops the dock and the mark square, and stacks the plate", () => {
    phone(true);
    mount({}, "mobile");
    const hero = screen.getByTestId("build-hero");
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(hero).not.toContainElement(dock);
    expect(hero.querySelector('[data-ui="hero-plate-mark"]')).toBeNull();
    expect(hero.querySelector('[data-ui="hero-plate"]')?.getAttribute("data-size")).toBe("phone");
    expect(screen.getByRole("heading", { level: 1, name: "Invoice triage agent" })).toBeTruthy();
  });

  it("offers the sections as a sideways row of chips, and no tab row in the viewer", () => {
    phone(true);
    const onTabChange = vi.fn();
    const base = buildFixture("mobile");
    mount({ viewer: { ...base.viewer, onTabChange } }, "mobile");
    const row = screen.getByRole("group", { name: "Sections of this build" });
    const chips = within(row).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(buildTabs(false).map((tab) => tab.label));
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chips[4]);
    expect(onTabChange).toHaveBeenCalledWith("broke");
    expect(within(screen.getByTestId("build-viewer")).queryByRole("tablist")).toBeNull();
  });

  it("shows the first six parts, then the rest on request", () => {
    phone(true);
    mount({}, "mobile");
    expect(screen.getAllByTestId("build-part-row")).toHaveLength(PHONE_PARTS);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more parts" }));
    expect(screen.getAllByTestId("build-part-row")).toHaveLength(8);
    expect(screen.queryByTestId("build-anatomy-more")).toBeNull();
  });

  it("draws the proof's primary full width, and no full-anatomy button", () => {
    phone(true);
    mount({}, "mobile");
    const primary = screen.getByRole("button", { name: "I ran this and it worked" });
    expect(primary.style.width).toBe("100%");
    expect(screen.queryByRole("button", { name: "Show the full anatomy" })).toBeNull();
  });
});

describe("the states", () => {
  it("holds the first screen's shape while loading", () => {
    render(<BuildViewSkeleton />);
    const loading = screen.getByTestId("build-loading");
    expect(loading.getAttribute("aria-busy")).toBe("true");
  });

  it("says what went wrong in one line, with one action", () => {
    const onRetry = vi.fn();
    render(<BuildViewNotice line="This build could not be loaded." action={<button onClick={onRetry}>Try again</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "This build could not be loaded." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
