// The proof primitives: lamp dot, picture lamp and plaque (BG-P11, UI-P08).
//
// The claim the plaque exists for is that a reader is entitled to BOTH trust
// signals or neither, and the claim UI-P08 adds is that the three states — healthy,
// stale, unreproduced — are decided in one place (`plaqueState`) and drawn the
// same way by all three components. So every state is checked on every
// component, and the plaque on every size.

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LampDot } from "./LampDot";
import { PictureLamp } from "./PictureLamp";
import { Plaque, plaqueState, type PlaqueBuild, type PlaqueSize, type PlaqueState } from "./Plaque";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-01T00:00:00Z");

const SIZES: PlaqueSize[] = ["card", "header", "row"];
const STATES: PlaqueState[] = ["healthy", "stale", "unreproduced"];

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

const BY_STATE: Record<PlaqueState, PlaqueBuild> = {
  healthy: build(),
  stale: build({ last_confirmed_at: STALE_AT }),
  unreproduced: build({ reproduction_count: 0 }),
};

/**
 * Styles are asserted through SSR rather than through the DOM: jsdom's
 * cssstyle refuses every `var()` value, so a declaration read off a rendered
 * node cannot tell a token apart from a hex, or from nothing at all.
 */
const plaqueHtml = (subject: PlaqueBuild, size: PlaqueSize = "card") =>
  renderToStaticMarkup(<Plaque build={subject} size={size} now={NOW} />);

function renderPlaque(subject: PlaqueBuild, size: PlaqueSize = "card") {
  return render(<Plaque build={subject} size={size} now={NOW} />).container;
}

describe("plaqueState", () => {
  it("is healthy, stale or unreproduced — from the two reads and nothing else", () => {
    expect(plaqueState(BY_STATE.healthy, NOW)).toBe("healthy");
    expect(plaqueState(BY_STATE.stale, NOW)).toBe("stale");
    expect(plaqueState(BY_STATE.unreproduced, NOW)).toBe("unreproduced");
  });

  it("is unreproduced whatever the freshness says, because the count decides first", () => {
    expect(plaqueState(build({ reproduction_count: 0, last_confirmed_at: STALE_AT }), NOW)).toBe("unreproduced");
    expect(plaqueState(build({ reproduction_count: null }), NOW)).toBe("unreproduced");
  });
});

describe("LampDot", () => {

  it("is decoration: hidden from a screen reader, and amber is never its text", () => {
    const html = renderToStaticMarkup(<LampDot />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/(^|;)color:/);
  });
});

describe("PictureLamp", () => {

  it("is an empty 18px spacer when unreproduced, so a row of cards stays aligned", () => {
    const html = renderToStaticMarkup(<PictureLamp state="unreproduced" />);
    expect(html).toContain('data-variant="off"');
    expect(html).toContain("height:18px");
    expect(html).not.toContain("<span");
    expect(html).not.toContain("--lit");
    expect(html).not.toContain("radial-gradient");
  });

  it.each(STATES)("is 18px tall in every state — %s", (state) => {
    expect(renderToStaticMarkup(<PictureLamp state={state} />)).toContain("height:18px");
  });

  it("is hidden from a screen reader: the plaque under the picture says it in words", () => {
    for (const state of STATES) {
      expect(renderToStaticMarkup(<PictureLamp state={state} />)).toContain('aria-hidden="true"');
    }
  });
});

describe("Plaque — healthy", () => {

  it("is the only filled ground on the object (the lamp aside)", () => {
    const html = plaqueHtml(BY_STATE.healthy);
    expect(html.match(/background:/g)).toHaveLength(1);
  });

  it("agrees with the picture lamp: lit", () => {
    expect(renderToStaticMarkup(<PictureLamp state={plaqueState(BY_STATE.healthy, NOW)} />)).toContain(
      'data-variant="on"',
    );
  });
});

describe("Plaque — stale", () => {

  it("states a fact and never a failure", () => {
    const text = renderPlaque(BY_STATE.stale).textContent ?? "";
    expect(text).toMatch(/months? ago, on Sonnet 4\.5/);
    expect(text).not.toMatch(/out of date|outdated|expired|broken|warning/i);
  });

  it("agrees with the picture lamp: dimmed", () => {
    expect(renderToStaticMarkup(<PictureLamp state={plaqueState(BY_STATE.stale, NOW)} />)).toContain(
      'data-variant="dim"',
    );
  });
});

describe("Plaque — unreproduced", () => {

  it("says nothing about freshness even when the creator has confirmed it", () => {
    const text = renderPlaque(build({ reproduction_count: 0 })).textContent;
    expect(text).toBe("not yet reproduced");
  });

  it("keeps the count's hooks, so the one reproduction line is still findable", () => {
    const container = renderPlaque(BY_STATE.unreproduced);
    expect(container.querySelector("[data-testid='reproduction-count']")).toHaveTextContent("not yet reproduced");
  });

  it("agrees with the picture lamp: absent, and the spacer holds the row", () => {
    expect(renderToStaticMarkup(<PictureLamp state={plaqueState(BY_STATE.unreproduced, NOW)} />)).toContain(
      'data-variant="off"',
    );
  });
});

describe("Plaque — the three sizes", () => {

  it("says it short on a card and a row, and in full on the header", () => {
    expect(renderPlaque(BY_STATE.healthy, "card").textContent).toContain("3 days ago, on Sonnet 4.5");
    expect(renderPlaque(BY_STATE.healthy, "card").textContent).not.toContain("last confirmed working");
    expect(renderPlaque(BY_STATE.healthy, "row").textContent).not.toContain("last confirmed working");
    expect(renderPlaque(BY_STATE.healthy, "header").textContent).toContain(
      "last confirmed working 3 days ago, on Sonnet 4.5",
    );
  });

  it("lets the claim wrap rather than clip it", () => {
    for (const size of SIZES) {
      const html = plaqueHtml(BY_STATE.healthy, size);
      expect(html).not.toContain("text-overflow");
      expect(html).toContain("flex-wrap:wrap");
    }
  });

  it("marks only a card's plaque as the card's, for the card's content-order contract", () => {
    expect(renderPlaque(BY_STATE.healthy, "card").querySelector("[data-card-part='plaque']")).not.toBeNull();
    expect(renderPlaque(BY_STATE.healthy, "header").querySelector("[data-card-part='plaque']")).toBeNull();
  });
});

describe("Plaque — every state, every size", () => {
  for (const state of STATES) {
    for (const size of SIZES) {
      it(`renders ${state} at ${size} with the reproduction hook, and carries no raw colour`, () => {
        const html = plaqueHtml(BY_STATE[state], size);
        expect(html).toContain("data-plaque-reproduction");
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(html).not.toMatch(/rgba?\(/);
      });
    }
  }

  it("rides a trailing child at the end, in every state", () => {
    for (const state of STATES) {
      const container = render(
        <Plaque build={BY_STATE[state]} now={NOW} trailing={<a href="/x">rebuilds</a>} />,
      ).container;
      const plaque = container.firstElementChild as HTMLElement;
      expect(plaque.lastElementChild?.textContent).toBe("rebuilds");
    }
  });

  it("explains the count on hover", () => {
    const container = renderPlaque(build({ reproduction_count: 1 }));
    expect(container.querySelector("[title]")?.getAttribute("title")).toMatch(/1 person other than the creator/);
    expect(renderPlaque(BY_STATE.unreproduced).querySelector("[title]")?.getAttribute("title")).toMatch(
      /Nobody other than the creator/,
    );
  });
});

describe("refined plaque and lamps (UI-P85)", () => {
  const refined = (node: React.ReactElement) =>
    renderToStaticMarkup(<MemoryRouter initialEntries={["/dev/kit/components"]}>{node}</MemoryRouter>);

  it("LampDot is a 3px bar, radius 1, --lit with --lamp-glow; dimmed is the filter, never an opacity", () => {
    const lit = refined(<LampDot />);
    expect(lit).toContain("height:3px");
    expect(lit).toContain("width:8px");
    expect(lit).toContain("border-radius:1px");
    expect(lit).toContain("background-color:var(--lit)");
    expect(lit).toContain("box-shadow:var(--lamp-glow)");
    const dim = refined(<LampDot dim />);
    expect(dim).toContain("filter:var(--dim-filter)");
    expect(dim).not.toContain("opacity");
  });

  it("PictureLamp is lit, dimmed by the filter when stale, and absent when unreproduced; no amber edge", () => {
    expect(refined(<PictureLamp state="healthy" />)).toContain('data-variant="on"');
    const stale = refined(<PictureLamp state="stale" />);
    expect(stale).toContain('data-variant="dim"');
    expect(stale).toContain("filter:var(--dim-filter)");
    expect(stale).not.toContain("opacity");
    expect(refined(<PictureLamp state="unreproduced" />)).toContain('data-variant="off"');
    expect(refined(<PictureLamp state="healthy" />)).not.toMatch(/border(?!-radius)/);
  });

  it("Plaque: an evidence pill, the lamp bar, then the freshness in 12 --text2; the states come from plaqueState()", () => {
    const fresh = refined(<Plaque build={build()} now={NOW} />);
    expect(fresh).toContain('data-plaque-state="healthy"');
    expect(fresh).toContain('data-tone="evidence"');
    expect(fresh).toContain("41 reproduced");
    expect(fresh).toContain('data-plaque-lamp="lit"');
    expect(fresh).toContain("font-size:12px");
    expect(fresh).toContain("color:var(--text2)");

    const stale = refined(<Plaque build={build({ last_confirmed_at: new Date(NOW - (STALE_AFTER_DAYS + 5) * DAY).toISOString() })} now={NOW} />);
    expect(stale).toContain('data-plaque-state="stale"');
    expect(stale).toContain('data-plaque-lamp="dim"');
    expect(stale).toContain("filter:var(--dim-filter)");
  });

  it("Plaque: not yet reproduced is a neutral pill with no lamp", () => {
    const html = refined(<Plaque build={build({ reproduction_count: 0 })} now={NOW} />);
    expect(html).toContain("not yet reproduced");
    expect(html).toContain('data-ui="pill"');
    expect(html).not.toContain('data-tone=');
    expect(html).not.toContain("data-plaque-lamp");
  });
});
