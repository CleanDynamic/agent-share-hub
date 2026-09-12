// BG-P11 — the plaque.
//
// The claim under test is the one the theme states and the one three surfaces
// used to be free to break: a reader is entitled to BOTH trust signals or
// neither, and no caller may choose. The first block proves it structurally —
// there is no props shape that produces one half — and the rest cover the three
// states and the three sizes.

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Plaque, plaqueState, type PlaqueBuild, type PlaqueSize } from "./Plaque";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-01T00:00:00Z");

const SIZES: PlaqueSize[] = ["card", "header", "row"];

function build(over: Partial<PlaqueBuild> = {}): PlaqueBuild {
  return {
    reproduction_count: 41,
    rebuild_count: 0,
    last_confirmed_at: new Date(NOW - 3 * DAY).toISOString(),
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: new Date(NOW - 40 * DAY).toISOString(),
    ...over,
  };
}

/** A confirmation old enough that `isStale` says so, whatever the threshold. */
const STALE_AT = new Date(NOW - (STALE_AFTER_DAYS + 60) * DAY).toISOString();

function renderPlaque(subject: PlaqueBuild, size: PlaqueSize = "card") {
  const { container } = render(<Plaque build={subject} size={size} now={NOW} />);
  return container;
}

describe("the plaque cannot render half of itself", () => {
  /**
   * Every state, every size, both halves. A regression that hides one half in
   * one state on one size is exactly the failure this component exists to make
   * impossible, so the check is the cross product rather than one sample.
   */
  const cases: Array<[string, PlaqueBuild]> = [
    ["healthy", build()],
    ["stale", build({ last_confirmed_at: STALE_AT })],
    ["never reproduced", build({ reproduction_count: 0 })],
    [
      "never reproduced and never confirmed",
      build({ reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null }),
    ],
    [
      "confirmed but by nobody who is not the creator",
      build({ reproduction_count: 0 }),
    ],
  ];

  for (const [name, subject] of cases) {
    for (const size of SIZES) {
      it(`renders both signals — ${name}, ${size}`, () => {
        const container = renderPlaque(subject, size);
        expect(container.querySelector("[data-plaque-reproduction]")).not.toBeNull();
        expect(container.querySelector("[data-plaque-freshness]")).not.toBeNull();
      });
    }
  }

  it("takes one record, so there is no argument that supplies one half", () => {
    // A compile-time claim, asserted at runtime the only way it can be: the
    // component's whole input is `build`, and both halves are read off it. If a
    // future edit split it into two optional props this renders one half and
    // the block above goes red.
    const container = renderPlaque(build({ reproduction_count: 0 }));
    const plaque = container.querySelector("[data-visual-slot='plaque']") as HTMLElement;
    expect(plaque.children.length).toBeGreaterThanOrEqual(2);
    expect(plaque).toHaveTextContent("not yet reproduced");
    expect(plaque).toHaveTextContent(/last confirmed working|not confirmed by anyone yet/);
  });
});

describe("the three states", () => {
  it("is healthy when the claim is recent and somebody has run it", () => {
    const container = renderPlaque(build());
    expect(container.querySelector("[data-plaque-state]")).toHaveAttribute(
      "data-plaque-state",
      "healthy"
    );
    expect(container.querySelector("[data-plaque-lamp]")).toHaveAttribute(
      "data-plaque-lamp",
      "lit"
    );
  });

  it("dims the lamp to 45% when the claim has gone stale", () => {
    const container = renderPlaque(build({ last_confirmed_at: STALE_AT }));
    const lamp = container.querySelector("[data-plaque-lamp]") as HTMLElement;
    expect(lamp).toHaveAttribute("data-plaque-lamp", "dim");
    expect(lamp.style.opacity).toBe("0.45");
  });

  it("keeps a stale build's copy a statement of fact, never a failure", () => {
    const container = renderPlaque(build({ last_confirmed_at: STALE_AT }));
    const freshness = container.querySelector("[data-plaque-freshness]") as HTMLElement;
    // signals.ts's own words, unedited: "last confirmed working 8 months ago,
    // on Sonnet 4.5". Nothing here rewords it into a warning.
    expect(freshness).toHaveTextContent(/last confirmed working .* ago, on Sonnet 4\.5/);
    expect(freshness.textContent ?? "").not.toMatch(/out of date|outdated|expired|broken/i);
  });

  it("says so plainly, and shows no lamp, when nobody has confirmed it", () => {
    const container = renderPlaque(
      build({ reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null })
    );
    expect(container.querySelector("[data-plaque-state]")).toHaveAttribute(
      "data-plaque-state",
      "unreproduced"
    );
    expect(container.querySelector("[data-plaque-lamp]")).toBeNull();
    expect(container.querySelector("[data-plaque-reproduction]")).toHaveTextContent(
      "not yet reproduced"
    );
  });

  it("lights the lamp for a confirmed build nobody has reproduced", () => {
    // The two signals are independent claims. A creator's own confirmation
    // moves the date and not the number, so an unreproduced build can still
    // have a live freshness claim — and an absent lamp would deny it.
    const container = renderPlaque(build({ reproduction_count: 0 }));
    expect(container.querySelector("[data-plaque-lamp]")).toHaveAttribute(
      "data-plaque-lamp",
      "lit"
    );
  });

  it("agrees with plaqueState, which is the same two reads", () => {
    expect(plaqueState(build(), NOW)).toBe("healthy");
    expect(plaqueState(build({ last_confirmed_at: STALE_AT }), NOW)).toBe("stale");
    expect(plaqueState(build({ reproduction_count: 0 }), NOW)).toBe("unreproduced");
  });
});

/**
 * Colour is asserted through SSR rather than through the DOM.
 *
 * jsdom's cssstyle refuses every `var()` value — `el.style.color` comes back
 * empty for a declaration that is perfectly valid in a browser — so an
 * assertion read off a rendered node cannot tell a token apart from a hex, or
 * from nothing at all. `renderToStaticMarkup` writes React's style object out
 * verbatim, which is the only place in a test run where the declarations this
 * component actually ships are visible.
 */
function markup(subject: PlaqueBuild, size: PlaqueSize = "card"): string {
  return renderToStaticMarkup(<Plaque build={subject} size={size} now={NOW} />);
}

describe("the reproduction count is the distinct one", () => {
  it("is the only half carrying a filled ground", () => {
    const html = markup(build());
    expect(html).toContain("background-color:var(--cat-evidence-fill)");
    // One filled ground on the whole object. If the freshness half ever grew
    // one, the count would stop being the element that deviates.
    expect(html.match(/background-color:/g)).toHaveLength(2); // the tag and the lamp
  });

  it("is not inflated on a card — it wins on fill, at the size of its neighbours", () => {
    const container = renderPlaque(build(), "card");
    const numeral = container.querySelector("[data-plaque-reproduction] span") as HTMLElement;
    expect(numeral.style.fontSize).toBe("");
  });

  it("steps up one notch at header size, inside the same tag", () => {
    const container = renderPlaque(build(), "header");
    const numeral = container.querySelector("[data-plaque-reproduction] span") as HTMLElement;
    expect(numeral.style.fontSize).toBe("20px");
  });
});

describe("tokens only", () => {
  it("carries no raw hex anywhere, in any state or size", () => {
    const states: PlaqueBuild[] = [
      build(),
      build({ last_confirmed_at: STALE_AT }),
      build({ reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null }),
    ];
    for (const subject of states) {
      for (const size of SIZES) {
        const html = markup(subject, size);
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(html).not.toMatch(/rgba?\(/);
      }
    }
  });

  it("spends `--lit` as light and never as type", () => {
    // The one rule the colour contract states twice. Amber may be the lamp's
    // fill; it may never be a `color`.
    const html = markup(build());
    expect(html).toContain("background-color:var(--lit)");
    // Anchored, because "background-color:var(--lit)" contains the substring
    // an unanchored check would be looking for.
    expect(html).not.toMatch(/(^|[;"])color:var\(--lit\)/);
  });
});
