import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";
import type { Step } from "@/lib/build/graph";

import { ListTile, type BuildListProps } from "./BuildList";
import { StepTile } from "./StepTile";

const fixture = mapSandboxFixture("supportInbox");
const none = () => undefined;
const no = async () => false;
const listProps: BuildListProps = {
  phone: false,
  steps: fixture.steps,
  dividers: new Map(),
  names: {},
  suggestions: [],
  intoResult: new Set(),
  results: [],
  selectedId: null,
  onSelect: none,
  onRename: none,
  onMove: none,
  onRemove: none,
  onAccept: none,
  onDismiss: none,
  onAddPrompt: no,
  onAddAgentPrompt: no,
  onAddAgentTo: none,
};

/** The words a tile shows, with what only the List has taken out: the drag handle, the menu, Uses chips and the footer link. */
function wordsOf(card: HTMLElement): string {
  const copy = card.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-label^="Move "], [aria-haspopup="menu"], [data-testid="tile-uses"], button').forEach((element) => element.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

const kinds = (["p1", "f2", "c5", "k6", "a7", "t8"] as const).map((id) => fixture.steps.find((step) => step.id === id) as Step);

describe("StepTile: the List's tile on the map", () => {
  it.each(kinds.map((step) => [step.kind, step] as const))("%s: the same tile, less the List's own controls", (_kind, step) => {
    const { unmount } = render(<ListTile step={step} index={0} last props={listProps} />);
    const listed = screen.getByTestId("step-card");
    const listWords = wordsOf(listed);
    unmount();

    render(<StepTile tile={{ step }} steps={fixture.steps} />);
    const mapped = screen.getByTestId("step-card");
    expect(wordsOf(mapped)).toBe(listWords);
    expect(within(mapped).queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
    expect(within(mapped).queryByRole("button", { name: /options$/ })).toBeNull();
  });

  it("the Result's card is the List's", () => {
    render(<StepTile tile={{ result: fixture.results[0] }} steps={fixture.steps} />);
    expect(screen.getByTestId("result-card")).toHaveTextContent("Support inbox");
  });

  it("the badge shows the map's number, and only the parts in show", () => {
    const code = fixture.steps.find((step) => step.id === "c5") as Step;
    const { rerender } = render(<StepTile tile={{ step: code }} steps={fixture.steps} badge="S2·2" />);
    expect(screen.getByTestId("step-card")).toHaveTextContent("S2·2");
    expect(screen.getByTestId("code-lines")).toBeInTheDocument();
    rerender(<StepTile tile={{ step: code }} steps={fixture.steps} show={["settings"]} />);
    expect(screen.queryByTestId("code-lines")).toBeNull();
    const prompt = fixture.steps[0];
    rerender(<StepTile tile={{ step: prompt }} steps={fixture.steps} show={[]} />);
    expect(screen.getByTestId("step-card")).not.toHaveTextContent("Label the last 200 emails.");
  });
});
