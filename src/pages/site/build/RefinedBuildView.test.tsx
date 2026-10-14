// UI-P90 — the Build page's first screen and The build in the refined look, rendered with the dev fixture: the same
// parts, names and handlers as `BuildView`, on the refined recipes.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import BuildDemo from "@/pages/dev/BuildDemo";
import BuildStepsDemo from "@/pages/dev/BuildStepsDemo";

import type { BuildViewProps } from "./BuildView";
import { stepTabs } from "./buildModel";
import { RefinedBuildView } from "./RefinedBuildView";

const REFINED = "/dev/kit/pages/build-steps?look=refined";

function stepsProps(viewport: "desktop" | "mobile" = "desktop", over: Partial<BuildViewProps> = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture(viewport);
  return { ...base, hero: { ...base.hero, title, outcome }, viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }, steps, ...over };
}

function mount(props: BuildViewProps) {
  return render(
    <MemoryRouter initialEntries={[REFINED]}>
      <RefinedBuildView {...props} />
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

describe("RefinedBuildView on a desktop", () => {
  it("is the fork, drawn from the dev page's fixture: one h1, the hero, the reproduction and The build", () => {
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <BuildStepsDemo viewport="desktop" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("build-view").getAttribute("data-look")).toBe("refined");
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
      <MemoryRouter initialEntries={["/dev/kit/pages/build?look=refined"]}>
        <BuildDemo viewport="desktop" fit="content" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("build-view").getAttribute("data-look")).toBe("refined");
    expect(screen.getByTestId("build-anatomy")).toBeTruthy();
    expect(screen.getByTestId("build-viewer")).toBeTruthy();
    expect(screen.getByTestId("build-timeline")).toBeTruthy();
  });

  it("draws no serif, no glass blur and no lucide icon in its first screen", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <RefinedBuildView {...stepsProps()} />
      </MemoryRouter>,
    );
    const first = html.slice(0, html.indexOf('data-testid="build-second-row"'));
    expect(first).not.toContain("Sentient");
    expect(first).not.toContain("backdrop-filter");
    expect(first).not.toContain("lucide");
  });
});

describe("RefinedBuildView on a phone", () => {
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
