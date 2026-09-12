// BG-P11 — the gap marker.
//
// The claim that matters most and is easiest to break: a gap keeps its TRUE
// category chip and the breakage hue is spent on the edge. A red chip would
// say the part is a breakage, which is a different and untrue claim — the part
// is a configuration, and what is missing is its content.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  GAP_INVITATION,
  GAP_SOLVED,
  GapMarker,
  gapEdge,
  gapState,
  type GapPlacement,
  type GapState,
} from "./GapMarker";

const PLACEMENTS: GapPlacement[] = ["card", "row", "panel"];
const STATES: GapState[] = ["unsolved", "funded", "solved"];

function markup(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

/** Every placement rendered with enough props that none of them collapses. */
function sample(placement: GapPlacement, state: GapState) {
  return (
    <GapMarker
      placement={placement}
      state={state}
      category="configuration"
      categoryLabel="Model settings"
      problem="The retry prompt gives up after one 429."
      problemFallback="The creator has not written this down yet."
      reward={state === "unsolved" ? null : "£150"}
      deadline="closes in 6 days"
      solutions="2 solutions"
      summary="1 part unsolved · £150"
    />
  );
}

/**
 * Every rendered category chip's own opening tag.
 *
 * The assertion has to be scoped to the CHIP rather than to the marker: a
 * funded panel legitimately prints its reward on the breakage category's
 * measured ground — the money is a breakage-category fact — so a blanket "no
 * breakage fill anywhere" would fail for the right reason and hide the wrong
 * one. What must never be red is the chip that names the part.
 */
function categoryChips(html: string): string[] {
  return [...html.matchAll(/<span[^>]*data-visual-slot="category-chip"[^>]*>/g)].map(
    (match) => match[0]
  );
}

describe("a gap keeps its own category chip", () => {
  for (const state of STATES) {
    for (const placement of ["row", "panel"] as const) {
      it(`is a configuration chip, not a red one — ${placement}, ${state}`, () => {
        const chips = categoryChips(markup(sample(placement, state)));
        expect(chips).toHaveLength(1);
        // The part's own measured pair, and never breakage's.
        expect(chips[0]).toContain("background:var(--cat-configuration-fill)");
        expect(chips[0]).toContain("color:var(--cat-configuration)");
        expect(chips[0]).not.toContain("var(--cat-breakage");
      });
    }
  }

  it("names the part, so the ask routes to people who write that kind of part", () => {
    render(sample("panel", "funded"));
    const chip = screen.getByText("Model settings");
    expect(chip).toHaveAttribute("data-category", "configuration");
  });

  it("shows no chip at all on a build-level ask that names no part", () => {
    const { container } = render(
      <GapMarker placement="panel" category={null} categoryLabel={null} problem="x" />
    );
    expect(container.querySelector("[data-visual-slot='category-chip']")).toBeNull();
  });
});

describe("the edge", () => {
  it("is 1.5px dashed breakage on a card and a panel, and a left edge on a row", () => {
    expect(gapEdge("card")).toMatchObject({
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "var(--cat-breakage)",
    });
    expect(gapEdge("panel")).toMatchObject({
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "var(--cat-breakage)",
      borderRadius: "var(--r-panel)",
    });
    expect(gapEdge("row")).toEqual({
      borderLeftWidth: 1.5,
      borderLeftStyle: "dashed",
      borderLeftColor: "var(--cat-breakage)",
    });
  });

  it("resolves the dashes to a solid evidence edge once it is filled", () => {
    expect(gapEdge("card", "solved")).toMatchObject({
      borderStyle: "solid",
      borderColor: "var(--evidence)",
    });
    expect(gapEdge("row", "solved")).toMatchObject({
      borderLeftStyle: "solid",
      borderLeftColor: "var(--evidence)",
    });
  });

  it("uses longhands, so jsdom keeps the geometry a shorthand would drop", () => {
    for (const placement of PLACEMENTS) {
      const edge = gapEdge(placement);
      expect(Object.keys(edge)).not.toContain("border");
      expect(Object.keys(edge)).not.toContain("borderLeft");
    }
  });
});

describe("gapState", () => {
  it("is funded only when there is money to print", () => {
    expect(gapState(false, null)).toBe("unsolved");
    expect(gapState(false, "£150")).toBe("funded");
    expect(gapState(true, "£150")).toBe("solved");
    expect(gapState(true, null)).toBe("solved");
  });
});

describe("the panel", () => {
  it("leads with the invitation, not with the problem", () => {
    render(sample("panel", "funded"));
    expect(screen.getByText(GAP_INVITATION)).toBeInTheDocument();
  });

  it("changes the tense once it is answered, not the claim", () => {
    // The build always worked without this part. What a solved gap reports is
    // that somebody answered it, which is why the shape stays and only the
    // edge and the sentence move.
    render(sample("panel", "solved"));
    expect(screen.getByText(GAP_SOLVED)).toBeInTheDocument();
    expect(screen.queryByText(GAP_INVITATION)).toBeNull();
  });

  it("falls back in the creator's absence rather than inventing a problem", () => {
    render(
      <GapMarker
        placement="panel"
        category="data"
        categoryLabel="Dataset"
        problem={null}
        problemFallback="The creator has not written this down yet."
      />
    );
    expect(screen.getByTestId("gap-problem-statement")).toHaveTextContent(
      "The creator has not written this down yet."
    );
  });

  it("prints no reward and no deadline when there are none", () => {
    render(<GapMarker placement="panel" problem="x" />);
    expect(screen.queryByTestId("gap-reward")).toBeNull();
    expect(screen.queryByTestId("gap-deadline")).toBeNull();
  });

  it("renders its one primary action as the kit's primary button", () => {
    const onClick = vi.fn();
    render(
      <GapMarker
        placement="panel"
        problem="x"
        primaryAction={{ label: "Offer a solution", onClick, testId: "solve-open" }}
      />
    );
    const button = screen.getByTestId("solve-open");
    // BG-P07 marks the primary surfaces with this slot. Anything else here
    // would be a hand-rolled button wearing the primary's job.
    expect(button).toHaveAttribute("data-visual-slot", "btn-primary");
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offers exactly one primary, whatever else it is handed", () => {
    render(
      <GapMarker
        placement="panel"
        problem="x"
        primaryAction={{ label: "Offer a solution", onClick: () => {} }}
        secondaryActions={<button type="button">I need this too</button>}
      />
    );
    expect(document.querySelectorAll("[data-visual-slot='btn-primary']")).toHaveLength(1);
  });

  it("carries no tinted ground — the edge is the whole treatment", () => {
    const html = markup(<GapMarker placement="panel" problem="x" />);
    expect(html).toContain("background:transparent");
  });
});

describe("the card placement", () => {
  it("is a mono line and no container", () => {
    const { container } = render(sample("card", "funded"));
    const marker = container.querySelector("[data-visual-slot='gap-marker']") as HTMLElement;
    expect(marker.tagName).toBe("P");
    expect(marker).toHaveTextContent("1 part unsolved · £150");
    // It is the card's fifth part, so the card's content-order contract holds.
    expect(marker).toHaveAttribute("data-card-part", "reward");
  });

  it("renders nothing without a summary to print", () => {
    const { container } = render(<GapMarker placement="card" category="data" categoryLabel="Dataset" />);
    expect(container.querySelector("[data-visual-slot='gap-marker']")).toBeNull();
  });
});

describe("every hue sits on a ground somebody measured", () => {
  /**
   * `critique-color` caught this one on the rendered kit: the row's state word
   * was the breakage hue AS TEXT, and the nine were each measured against
   * `--bg`. A part row sits on `--recess` or on a card's glass, where the same
   * hue falls to 4.23–4.47 against a 4.5 floor. The remedy the theme names
   * first is to reuse a legal pairing, which is the category's own measured
   * fill — opaque, so it holds on any ground.
   */
  it("gives the row's state word a fill rather than leaving it bare ink", () => {
    for (const state of STATES) {
      const html = markup(sample("row", state));
      const word = html.slice(html.indexOf("data-gap-word"));
      expect(word.slice(0, 400)).toMatch(
        state === "solved"
          ? /background:var\(--cat-evidence-fill\)/
          : /background:var\(--cat-breakage-fill\)/
      );
    }
  });

  it("gives the reward the breakage fill rather than breakage ink on nothing", () => {
    const html = markup(sample("panel", "funded"));
    const reward = html.slice(html.indexOf('data-testid="gap-reward"'));
    expect(reward.slice(0, 400)).toContain("background:var(--cat-breakage-fill)");
  });
});

describe("no raw hex", () => {
  it("carries none, in any placement or state", () => {
    for (const placement of PLACEMENTS) {
      for (const state of STATES) {
        const html = markup(sample(placement, state));
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(html).not.toMatch(/rgba?\(/);
      }
    }
  });
});
