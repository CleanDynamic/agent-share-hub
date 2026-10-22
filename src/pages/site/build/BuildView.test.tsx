// UI-P90 — the Build page's first screen and The build in the refined look, rendered with the dev fixture: the same
// parts, names and handlers as `BuildView`, on the refined recipes.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import type { NodeTree } from "@/lib/build/types";
import BuildDemo from "@/pages/dev/BuildDemo";
import BuildStepsDemo from "@/pages/dev/BuildStepsDemo";

import type { BuildViewProps } from "./BuildView";
import { stepTabs } from "./buildModel";
import { BuildView } from "./BuildView";

const REFINED = "/dev/kit/pages/build-steps";

function stepsProps(viewport: "desktop" | "mobile" = "desktop", over: Partial<BuildViewProps> = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture(viewport);
  return { ...base, hero: { ...base.hero, title, outcome }, viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps, ...over };
}

function mount(props: BuildViewProps) {
  return render(
    <MemoryRouter initialEntries={[REFINED]}>
      <BuildView {...props} />
    </MemoryRouter>,
  );
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
  it("is the fork, drawn from the dev page's fixture: one h1, the hero, the reproduction and The build", () => {
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <BuildStepsDemo viewport="desktop" />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Bakery homepage" })).toBeTruthy();
    expect(screen.getByTestId("build-hero")).toBeTruthy();
    expect(screen.getByTestId("build-proof")).toBeTruthy();
    expect(screen.getAllByTestId("step-card")).toHaveLength(5);
    expect(screen.getByTestId("build-need")).toBeTruthy();
  });

  it("hangs the result window under the picture light, with the shape tag and the credit", () => {
    mount(stepsProps());
    const hero = screen.getByTestId("build-hero");
    expect(within(hero).getByRole("img", { name: "Bakery homepage · Result" })).toBeTruthy();
    expect(hero.querySelector('[data-ui="picture-light"]')?.getAttribute("data-variant")).toBe("on");
    expect(screen.getByTestId("build-shape-tag").textContent).toBe("agent · via connector");
    expect(hero.textContent).toContain("Rebuilt from Inbox sorter by @kofi · made by @maya");
    expect(hero.textContent).toContain("Δ swapped model, added retry step");
    // No italics under the refined look.
    expect(hero.querySelector("i")).toBeNull();
  });

  it("leaves the picture light off when nobody has reproduced the build", () => {
    const props = stepsProps();
    mount({ ...props, proof: { ...props.proof, build: { ...props.proof.build, reproduction_count: 0 } } });
    expect(screen.getByTestId("build-hero").querySelector('[data-ui="picture-light"]')).toBeNull();
  });

  it("the action dock is text only and calls each action", async () => {
    const onCopyForAI = vi.fn().mockResolvedValue(true);
    const onDownload = vi.fn();
    const onRebuild = vi.fn();
    const props = stepsProps();
    mount({ ...props, actions: { ...props.actions, onCopyForAI, onDownload, onRebuild } });
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(dock.querySelector("svg")).toBeNull();
    expect(within(dock).getAllByRole("button").map((button) => button.textContent)).toEqual(["Copy for AI", "Download", "Rebuild"]);
    expect(within(dock).getByRole("link", { name: "Lineage" }).getAttribute("href")).toBe(props.actions.lineageTo);
    await act(async () => {
      fireEvent.click(within(dock).getByRole("button", { name: "Copy for AI" }));
    });
    fireEvent.click(within(dock).getByRole("button", { name: "Download" }));
    fireEvent.click(within(dock).getByRole("button", { name: "Rebuild" }));
    expect(onCopyForAI).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });

  it("the reproduction column: the count, the plaque, the one primary, the details and completeness", () => {
    const onPress = vi.fn();
    const props = stepsProps();
    mount({ ...props, proof: { ...props.proof, action: { kind: "reproduce", onPress } } });
    const proof = screen.getByTestId("build-proof");
    expect(proof.textContent).toContain("41ran it");
    expect(proof.textContent).toContain("last 27 Sep");
    expect(proof.querySelector('[data-ui="plaque"]')).not.toBeNull();
    const primaries = document.querySelectorAll('[data-ui="button"][data-variant="primary"]');
    expect(primaries).toHaveLength(1);
    const action = within(proof).getByRole("button", { name: "I ran this and it worked" });
    expect(action.querySelector("svg")).toBeNull();
    fireEvent.click(action);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(within(proof).getByText("Your run relights the lamp and records the model you used.")).toBeTruthy();
    expect(proof.querySelectorAll('[data-ui="row"]')).toHaveLength(6);
    const bar = within(screen.getByTestId("build-completeness")).getByRole("progressbar", { name: "Completeness" });
    expect(bar.getAttribute("aria-valuenow")).toBe("86");
  });

  it("says a run that did not save, with a retry", () => {
    const onRetry = vi.fn();
    const props = stepsProps();
    mount({ ...props, proof: { ...props.proof, writeError: { onRetry } } });
    fireEvent.click(within(screen.getByTestId("build-run-error")).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("The build's tabs, then the steps; another tab keeps its own body", () => {
    const onTabChange = vi.fn();
    const props = stepsProps();
    const { unmount } = mount({ ...props, viewer: { ...props.viewer, onTabChange } });
    const tabs = within(screen.getByRole("tablist", { name: "Sections of this build" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["The build", "Watch it get built", "Understand it", "Where it broke"]);
    fireEvent.click(tabs[1]);
    expect(onTabChange).toHaveBeenCalledWith("watch");
    unmount();

    mount({ ...props, viewer: { ...props.viewer, tab: "watch", content: <p>the replay</p> } });
    expect(screen.getByText("the replay")).toBeTruthy();
    expect(screen.queryByTestId("build-steps")).toBeNull();
    expect(screen.getByTestId("build-need")).toBeTruthy();
  });

  it("with no steps the lower row is the anatomy, the viewer and the timeline", () => {
    render(
      <MemoryRouter initialEntries={["/dev/kit/pages/build"]}>
        <BuildDemo viewport="desktop" fit="content" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("build-anatomy")).toBeTruthy();
    expect(screen.getByTestId("build-viewer")).toBeTruthy();
    expect(screen.getByTestId("build-timeline")).toBeTruthy();
  });

  it("draws no serif, no glass blur and no lucide icon in its first screen", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <BuildView {...stepsProps()} />
      </MemoryRouter>,
    );
    const first = html.slice(0, html.indexOf('data-testid="build-second-row"'));
    expect(first).not.toContain("Sentient");
    expect(first).not.toContain("backdrop-filter");
    expect(first).not.toContain("lucide");
  });
});

describe("BuildView on a phone", () => {
  it("keeps today's order: the hero, the action row, the reproduction, the sections, The build, What you need", () => {
    phone(true);
    mount(stepsProps("mobile"));
    expect(screen.getByTestId("build-view").getAttribute("data-viewport")).toBe("mobile");
    const order = ["build-hero", "build-action-dock", "build-proof", "build-steps", "build-need"].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // The dock is under the hero, not on it.
    expect(within(screen.getByTestId("build-hero")).queryByTestId("build-action-dock")).toBeNull();
    expect(screen.getByRole("tablist", { name: "Sections of this build" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "How to look at the build" })).toBeNull();
  });
});

describe("a check on the build page (CA-03 P5)", () => {
  const check = {
    id: "k1",
    build_id: "b",
    parent_id: null,
    position: 99,
    type: "eval_run",
    title: null,
    note: null,
    payload: { tested: "Places a test order for 2 sourdough loaves", passing: "The total shows £9.00", on_fail: "The total showed £8.99.", passed: 13, total: 14, run_at: "2026-10-12" },
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-12T09:00:00.000Z",
    children: [],
  } as unknown as NodeTree;

  const withSteps = (extra: NodeTree[]): BuildViewProps => {
    const { title, outcome, ...steps } = buildStepsFixture("list", extra);
    const base = buildFixture("desktop");
    return { ...base, hero: { ...base.hero, title, outcome }, viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps };
  };
  const proofMarkup = (props: BuildViewProps) => {
    const { container, unmount } = mount(props);
    const proof = container.querySelector('[data-testid="build-proof"]')?.outerHTML ?? "";
    const plaque = container.querySelector('[data-ui="plaque"]')?.outerHTML ?? "";
    unmount();
    return { proof, plaque };
  };

  it("draws it as a step: the test description, pass criteria, failure notes and its status", () => {
    mount(withSteps([check]));
    const card = screen.getAllByTestId("step-card").find((entry) => entry.getAttribute("data-kind") === "check")!;
    expect(card.textContent).toContain("CheckPassed 13 of 14 runs");
    expect(within(card).getByTestId("check-status").textContent).toBe("Passed 13 of 14 runs · since 12 Oct");
    expect(within(card).getAllByTestId("label-value").map((row) => row.textContent)).toEqual([
      "Test descriptionPlaces a test order for 2 sourdough loaves",
      "Pass criteriaThe total shows £9.00",
      "Failure notesThe total showed £8.99.",
    ]);
    expect(card.textContent).not.toMatch(/verified|reproduc|ran it/i);
    expect(card.querySelector('[data-ui="plaque"]')).toBeNull();
  });

  it("never changes the plaque, the reproduction count or the proof panel", () => {
    const without = proofMarkup(withSteps([]));
    const withCheck = proofMarkup(withSteps([check]));
    expect(withCheck.plaque).not.toBe("");
    expect(withCheck.plaque).toBe(without.plaque);
    expect(withCheck.proof).toBe(without.proof);
  });
});

describe("the summary line under the title (CA-03 P8)", () => {
  it("says what kind of build it is, on one line, with its full text in the title", () => {
    mount(stepsProps());
    const line = screen.getByTestId("build-summary");
    expect(line.textContent).not.toBe("");
    expect(line.getAttribute("title")).toBe(line.textContent);
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <BuildView {...stepsProps()} />
      </MemoryRouter>,
    );
    const tag = /<p data-testid="build-summary"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(tag).toContain("font-size:12.5px");
    expect(tag).toContain("color:var(--text2)");
    expect(tag).toContain("white-space:nowrap");
    expect(tag).toContain("text-overflow:ellipsis");
  });

  it("draws nothing for a build with nothing but a title", () => {
    const props = stepsProps();
    mount({ ...props, steps: props.steps ? { ...props.steps, steps: [] } : props.steps });
    expect(screen.queryByTestId("build-summary")).toBeNull();
  });

  it("leaves the plaque where it was and as it was", () => {
    const plaqueOf = (props: BuildViewProps) => {
      const { container, unmount } = mount(props);
      const plaque = container.querySelector('[data-ui="plaque"]')?.outerHTML ?? "";
      unmount();
      return plaque;
    };
    const props = stepsProps();
    const without = plaqueOf({ ...props, hero: { ...props.hero, summary: "" } });
    expect(without).not.toBe("");
    expect(plaqueOf(props)).toBe(without);
  });
});

describe("Download, once the build has a session setup (CA-04 P4)", () => {
  it("is a menu: the build as before, and the setup as a folder", async () => {
    const onDownload = vi.fn();
    const onDownloadSetup = vi.fn();
    const props = stepsProps();
    mount({ ...props, actions: { ...props.actions, onDownload, onDownloadSetup } });
    const dock = screen.getByRole("group", { name: "Take this build" });
    const trigger = within(dock).getByRole("button", { name: "Download" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["The build", "The setup, as a folder"]);
    fireEvent.click(items[1]);
    expect(onDownloadSetup).toHaveBeenCalledTimes(1);
    expect(onDownload).not.toHaveBeenCalled();
  });

  it("stays one button while the build has none", () => {
    mount(stepsProps());
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(within(dock).getByRole("button", { name: "Download" }).getAttribute("aria-haspopup")).toBeNull();
  });
});

describe("the Classification section (CA-16 P7)", () => {
  it("sits under the hero and above The build, on a desktop and on a phone", () => {
    const section = <section aria-label="Classification" data-testid="build-classification" />;
    const { unmount } = mount(stepsProps("desktop", { classification: section }));
    const hero = screen.getByTestId("build-hero");
    const classification = screen.getByTestId("build-classification");
    const steps = screen.getByTestId("build-steps-panel");
    expect(hero.compareDocumentPosition(classification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(classification.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    phone(true);
    mount(stepsProps("mobile", { classification: section }));
    expect(screen.getByTestId("build-classification")).toBeTruthy();
  });

  it("draws nothing extra without it", () => {
    mount(stepsProps("desktop"));
    expect(screen.queryByTestId("build-classification")).toBeNull();
  });
});
