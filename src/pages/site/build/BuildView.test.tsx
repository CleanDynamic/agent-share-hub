// UI-P29 — the Build page's first screen: both layouts, every control's callback, the states.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";

import { BuildView, BuildViewFailed, BuildViewNotice, BuildViewSkeleton, PHONE_PARTS, type BuildViewProps } from "./BuildView";
import { buildTabs, landTab, stepTabs } from "./buildModel";

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
    expect(screen.getByTestId("build-anatomy-empty").textContent).toBe("This build has no parts yet.");
    expect(screen.getByTestId("build-timeline-empty").textContent).toBe("No events were kept for this build.");
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
    const row = screen.getByRole("tablist", { name: "Sections of this build" });
    const chips = within(row).getAllByRole("tab");
    expect(chips.map((chip) => chip.textContent)).toEqual(buildTabs(false).map((tab) => tab.label));
    expect(chips[0].getAttribute("aria-selected")).toBe("true");
    expect(chips.map((chip) => chip.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    fireEvent.click(chips[4]);
    expect(onTabChange).toHaveBeenCalledWith("broke");
    expect(within(screen.getByTestId("build-viewer")).queryByRole("tablist")).toBeNull();
    // The arrow keys move between the chips, and the panel is named by the chosen one.
    chips[0].focus();
    fireEvent.keyDown(chips[0], { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenLastCalledWith(buildTabs(false)[1].value);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", `build-tab-${base.viewer.tab}`);
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
  it("holds the first screen's shape while loading, with the panels' own heads, and announces itself once", () => {
    render(<BuildViewSkeleton />);
    const loading = screen.getByTestId("build-loading");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.getAttribute("role")).toBe("status");
    expect(loading.textContent).toContain("Loading the build");
    expect(screen.getByRole("heading", { level: 2, name: "Anatomy" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Watch it get built" })).toBeTruthy();
  });

  it("says That didn't load. in the page's own panel, naming it, with a retry, and never the exception", () => {
    const onRetry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<BuildViewFailed onRetry={onRetry} error={new Error("PGRST116")} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByTestId("build-error").textContent).toContain("That didn't load.");
    expect(screen.getByTestId("build-error").textContent).not.toContain("PGRST116");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("says what went wrong in one line, with one action", () => {
    const onRetry = vi.fn();
    render(<BuildViewNotice line="This build could not be loaded." action={<button onClick={onRetry}>Try again</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "This build could not be loaded." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

/* ── UI-P73: the steps, The build and What you need ── */

describe("BuildView with the steps drawn (UI-P73)", () => {
  const mountSteps = (which: BuildStepsSample = "list", viewport: "desktop" | "mobile" = "desktop", over: Partial<BuildViewProps> = {}) => {
    const { title, outcome, ...steps } = buildStepsFixture(which);
    void title;
    void outcome;
    const base = buildFixture(viewport);
    return mount({ viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps, ...over }, viewport);
  };

  it("with no steps the page is the old one: the anatomy, the viewer and the timeline", () => {
    mount();
    expect(screen.getByTestId("build-anatomy")).toBeTruthy();
    expect(screen.getByTestId("build-viewer")).toBeTruthy();
    expect(screen.getByTestId("build-timeline")).toBeTruthy();
    expect(screen.queryByTestId("build-steps")).toBeNull();
  });

  it("B1 shows 5 step cards, 4 chat heads, the paste-in chips and the CLAUDE.md download", () => {
    mountSteps("list");
    expect(screen.queryByTestId("build-anatomy")).toBeNull();
    expect(screen.queryByTestId("build-timeline")).toBeNull();
    expect(screen.getAllByTestId("step-card")).toHaveLength(5);
    expect(screen.getAllByText(/^New chat/)).toHaveLength(4);
    expect(screen.getByText("New chat in ChatGPT")).toBeTruthy();
    expect(screen.getAllByText("what step 2 gave you").length).toBe(1);
    expect(screen.getAllByText("what step 1 gave you").length).toBe(1);
    expect(screen.getByText("attach CLAUDE.md")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Download CLAUDE.md" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Send in the same chat as step 4")).toBeTruthy();
    expect(screen.getByText("4 sessions · 5 prompts · 1 file · 3–6 Oct")).toBeTruthy();
    expect(screen.getByText("copy each step into the chat it names")).toBeTruthy();
  });

  it("What you need lists tools, files and time, and says what Copy for AI copies", () => {
    mountSteps("list");
    const need = screen.getByTestId("build-need");
    expect(within(need).getByRole("heading", { name: "What you need" })).toBeTruthy();
    expect(within(need).getByText("to repeat this build")).toBeTruthy();
    expect(within(need).getByText("Claude Code")).toBeTruthy();
    expect(within(need).getByText("4 sessions over 3 days")).toBeTruthy();
    expect(within(need).getByText("Copy for AI copies all 5 steps in order, with each new chat and paste-in written out.")).toBeTruthy();
  });

  it("the tab strip starts with The build, holds at most 5 tabs, and has no Anatomy or Run it yourself", () => {
    mountSteps("list");
    const tabs = within(screen.getByRole("tablist", { name: "Sections of this build" })).getAllByRole("tab");
    expect(tabs[0].textContent).toBe("The build");
    expect(tabs.length).toBeLessThanOrEqual(5);
    expect(tabs.map((tab) => tab.textContent)).not.toContain("Anatomy");
    expect(tabs.map((tab) => tab.textContent)).not.toContain("Run it yourself");
    expect(stepTabs(true).map((tab) => tab.label)).toEqual(["The build", "Watch it get built", "Understand it", "Where it broke", "Rebuilds"]);
  });

  it("only the first step's head says New chat, and a team's steps say Uses, never Paste in", () => {
    mountSteps("team");
    expect(screen.getByText("The team these made")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy the team/ })).toBeTruthy();
    expect(screen.getAllByTestId("inner-card")).toHaveLength(4);
    expect(screen.getAllByText("Uses").length).toBeGreaterThan(0);
    expect(screen.getByText("steps 1–2 set it up · the team then runs by itself")).toBeTruthy();
    expect(screen.getByText("3.3, until every claim has a source")).toBeTruthy();
    const team = screen.getByTestId("build-steps").textContent ?? "";
    expect(team.slice(team.indexOf("The team these made"))).not.toContain("Paste in");
  });

  it("B4 draws one prompt and says there is no map", () => {
    mountSteps("one");
    expect(screen.getAllByTestId("step-card")).toHaveLength(1);
    expect(screen.getByText("New chat in ChatGPT")).toBeTruthy();
    expect(screen.getByText("One prompt, so there is no map. Map appears once a build has two sessions or an agent.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "How to look at the build" })).toBeNull();
  });

  it("the List and Map switch shows when there are two sessions or an agent", () => {
    mountSteps("list");
    expect(screen.getByRole("group", { name: "How to look at the build" })).toBeTruthy();
  });

  it("Copy copies the step's text and says so", async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn().mockResolvedValue(true);
    const { title, outcome, ...steps } = buildStepsFixture("list");
    void title;
    void outcome;
    const base = buildFixture();
    mount({ viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps: { ...steps, onCopy } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy step 1" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(60);
    });
    expect(onCopy).toHaveBeenCalledWith(steps.steps[0].step.text);
    expect(screen.getByTestId("build-live").textContent).toBe("Copied");
  });

  it("a paste-in chip scrolls to its step and rings it", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mountSteps("list");
    fireEvent.click(screen.getByText("what step 1 gave you"));
    expect(scroll).toHaveBeenCalled();
    expect(document.getElementById("step-p1")).toBe(scroll.mock.contexts[0]);
  });

  it("Read all of it opens the full prompt window for readers, and Esc closes it", () => {
    mountSteps("list");
    fireEvent.click(screen.getByRole("button", { name: "Read all of it" }));
    const window = screen.getByTestId("full-prompt-window");
    expect(window.textContent).toContain("Follow CLAUDE.md");
    expect(within(window).queryByLabelText("Title")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("full-prompt-window")).toBeNull();
  });

  it("on a phone the tabs are a sideways row, The build is one column and What you need follows it", () => {
    phone(true);
    mountSteps("list", "mobile");
    expect(screen.getByRole("tablist", { name: "Sections of this build" })).toBeTruthy();
    expect(screen.getAllByTestId("step-card")).toHaveLength(5);
    expect(screen.queryByRole("group", { name: "How to look at the build" })).toBeNull();
    const steps = screen.getByTestId("build-steps");
    const need = screen.getByTestId("build-need");
    expect(steps.compareDocumentPosition(need) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("another tab keeps its own body under the strip", () => {
    const base = buildFixture();
    mountSteps("list", "desktop", { viewer: { ...base.viewer, tabs: stepTabs(false), tab: "watch", content: <p>the replay</p> } });
    expect(screen.getByText("the replay")).toBeTruthy();
    expect(screen.queryByTestId("build-steps")).toBeNull();
    expect(screen.getByTestId("build-need")).toBeTruthy();
  });
});

describe("landTab (UI-P73)", () => {
  it("lands Run it yourself on The build when the steps are drawn, and nothing else", () => {
    expect(landTab("run", true)).toBe("anatomy");
    expect(landTab("run", false)).toBe("run");
    expect(landTab("watch", true)).toBe("watch");
    expect(landTab("understand", true)).toBe("understand");
  });
});
