// UI-P74 — the read-only Map on the build page, and "Before you send it".

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import { BuildMap } from "../compose/BuildMap";
import { BeforeYouSend } from "./BeforeYouSend";
import { BuildView } from "./BuildView";
import { stepTabs } from "./buildModel";

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

function mountPage(which: BuildStepsSample) {
  const { title, outcome, ...steps } = buildStepsFixture(which);
  void title;
  void outcome;
  const base = buildFixture("desktop");
  return render(
    <MemoryRouter>
      <BuildView fit="content" {...base} viewer={{ ...base.viewer, tabs: stepTabs(false), tab: "anatomy" }} steps={steps} />
    </MemoryRouter>,
  );
}

const toolOf = () => "Claude";

describe("BeforeYouSend", () => {
  it("B1 step 4: two paste-ins and CLAUDE.md, each with where to go", () => {
    const { steps } = buildStepsFixture("list");
    const onSelect = vi.fn();
    render(<BeforeYouSend entry={steps[3]} toolOf={toolOf} onSelect={onSelect} />);
    const rows = screen.getAllByTestId("before-row");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("Paste what step 2 gave you");
    expect(rows[0].textContent).toContain("Homepage copy · Claude");
    expect(rows[1].textContent).toContain("Paste what step 3 gave you");
    expect(rows[2].textContent).toContain("Attach CLAUDE.md");
    expect(rows[2].textContent).toContain("File · 1.2 KB");
    expect(within(rows[2]).getByRole("link", { name: "Download CLAUDE.md" })).toBeTruthy();
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Go to step 2" }));
    expect(onSelect).toHaveBeenCalledWith("p2");
  });

  it("B3 agent 3.3: the rows read Uses, never Paste", () => {
    const { steps } = buildStepsFixture("team");
    const writer = steps[2].children[2];
    render(<BeforeYouSend entry={writer} toolOf={toolOf} onSelect={() => undefined} />);
    const rows = screen.getAllByTestId("before-row");
    expect(rows.map((row) => row.textContent)).toEqual(["Useswhat 3.2 gives it × 3", "Usestemplate.md", "Useswhat 3.4 sends back"]);
    expect(document.body.textContent).not.toContain("Paste");
  });

  it("is left out when the step has nothing to paste or attach", () => {
    const { steps } = buildStepsFixture("list");
    render(<BeforeYouSend entry={steps[0]} toolOf={toolOf} onSelect={() => undefined} />);
    expect(screen.queryByTestId("before-you-send")).toBeNull();
  });
});

describe("BuildMap in reader mode", () => {
  it("draws no suggested input, no legend and no dot to drag from, even when one is offered", () => {
    const { steps, map } = buildStepsFixture("list");
    const { container } = render(
      <BuildMap
        mode="reader"
        steps={steps.map((entry) => entry.step)}
        {...map}
        suggestions={[{ stepId: "p3", use: { kind: "output", node_id: "p1" }, label: "Output of 1" }]}
        selectedId={null}
        onSelect={() => undefined}
        onClear={() => undefined}
        onConnect={() => undefined}
      />,
    );
    expect(container.querySelector('[data-suggested="true"]')).toBeNull();
    expect(container.textContent).not.toContain("suggested");
    expect(container.textContent).not.toContain("drag from a dot");
    for (const dot of container.querySelectorAll<HTMLElement>('[data-testid^="map-dot-"]')) expect(dot.style.pointerEvents).toBe("none");
  });
});

describe("The build page's Map", () => {
  it("is not requested until Map is chosen; then a box fills the reading panel, Next moves on and Esc clears", async () => {
    mountPage("list");
    expect(screen.queryByTestId("reader-map")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(await screen.findByTestId("reader-map")).toBeTruthy();
    const panel = screen.getByTestId("reading-panel");
    expect(panel.textContent).toContain("Click a box to read its full prompt.");

    fireEvent.click(await screen.findByRole("button", { name: /^Prompt 4, Build the homepage/ }));
    expect(panel.textContent).toContain("Step 4 of 5");
    expect(panel.textContent).toContain("Follow CLAUDE.md");
    expect(panel.textContent).toContain("New chat in Claude Code");
    expect(within(panel).getByText("Before you send it")).toBeTruthy();
    expect(screen.getByText("Step 4 open · what it doesn't touch is dimmed")).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Next: step 5" }));
    expect(panel.textContent).toContain("Step 5 of 5");

    fireEvent.keyDown(screen.getByTestId("build-map"), { key: "Escape" });
    await waitFor(() => expect(panel.textContent).toContain("Click a box to read its full prompt."));
  });

  it("See the team in Map opens the team with its first agent selected", async () => {
    mountPage("team");
    fireEvent.click(screen.getByRole("button", { name: /See the team in Map/ }));
    expect(await screen.findByTestId("opened-map")).toBeTruthy();
    const panel = screen.getByTestId("reading-panel");
    await waitFor(() => expect(panel.textContent).toContain("Lead"));
  });

  it("a phone has no Map: no switch and no See the team in Map", () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    mountPage("team");
    expect(screen.queryByRole("group", { name: "How to look at the build" })).toBeNull();
    expect(screen.queryByRole("button", { name: /See the team in Map/ })).toBeNull();
  });
});
