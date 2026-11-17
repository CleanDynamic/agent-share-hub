// G20: the editor's keyboard drag says what happened, through its one polite line, at each step: on pick-up, on each move
// ("2 of 3 in Session 1"), and on the drop or the cancel. No visible word changes: the record under the list is hidden.

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, fireEvent, render } from "@testing-library/react";

import { done, mountList, pickUp, press, said, stubLayout, stubMedia } from "./ca21Harness";
import { SortableRows } from "./referencePieces";

beforeEach(stubMedia);
afterEach(done);

const tileIds = () => [...document.querySelectorAll('[data-skel-kind="tile"]')].map((el) => el.getAttribute("data-skel-id") as string);
const grip = (id: string) => within(document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`) as HTMLElement).getAllByTestId("drag-handle")[0];

describe("G20: the drag's words", () => {
  it("says the pick-up, each move, and the drop", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    await pickUp(grip(first));
    expect(said()).toMatch(/^Picked up Prompt 1\. Session 1, 1 of (\d+)\.$/);
    const count = Number(/of (\d+)\.$/.exec(said() ?? "")?.[1]);
    await press("ArrowDown");
    expect(said()).toBe(`Over Session 1, 2 of ${count}.`);
    await press("Space");
    expect(said()).toBe(`Moved Prompt 1 to 2 of ${count} in Session 1.`);
    // Heard, not seen: the record is hidden from view and from screen readers (the announcer says it once).
    expect(screen.getByTestId("nest-said").getAttribute("aria-hidden")).toBe("true");
  });

  it("says the cancel", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    await pickUp(grip(first));
    await press("ArrowDown");
    await press("Escape");
    await waitFor(() => expect(said()).toBe("Put back in Session 1."));
  });
});

describe("G20: SortableRows says names and places, not keys", () => {
  it("on pick-up and on Escape", async () => {
    const rows = ["Hero", "Pricing", "Footer"].map((name, at) => ({ key: `k${at}`, name, render: (grip: React.ReactNode) => <span>{grip}{name}</span> }));
    render(<SortableRows rows={rows} label="Components" onOrder={() => undefined} />);
    const grip = screen.getByRole("button", { name: "Move Hero" });
    grip.focus();
    await act(async () => {
      fireEvent.keyDown(grip, { key: " ", code: "Space" });
    });
    const region = () => Array.from(document.querySelectorAll('[role="status"][aria-live]')).map((el) => el.textContent).join(" ");
    await waitFor(() => expect(region()).toContain("Picked up Hero. 1 of 3."));
    expect(region()).not.toContain("k0");
    await act(async () => {
      fireEvent.keyDown(grip, { key: "Escape", code: "Escape" });
    });
    await waitFor(() => expect(region()).toContain("Put Hero back, 1 of 3."));
  });
});
