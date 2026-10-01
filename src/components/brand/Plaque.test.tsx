// The proof primitives: lamp dot, picture lamp and plaque (BG-P11, UI-P08).
//
// The claim the plaque exists for is that a reader is entitled to BOTH trust
// signals or neither, and the claim UI-P08 adds is that the three states — healthy,
// stale, unreproduced — are decided in one place (`plaqueState`) and drawn the
// same way by all three components. So every state is checked on every
// component, and the plaque on every size.

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LampDot } from "./LampDot";
import { PictureLamp } from "./PictureLamp";
import { Plaque, PlaqueLamp, plaqueState, type PlaqueBuild, type PlaqueSize, type PlaqueState } from "./Plaque";
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
  it("is a 10×7 oval of --lit, lit, with the lamp glow", () => {
    const html = renderToStaticMarkup(<LampDot />);
    expect(html).toContain("width:10px");
    expect(html).toContain("height:7px");
    expect(html).toContain("border-radius:50%");
    expect(html).toContain("background-color:var(--lit)");
    expect(html).toContain("opacity:1");
    expect(html).toContain("box-shadow:var(--lamp-glow)");
    expect(html).toContain('data-variant="on"');
  });

  it("dims to 45% when stale, with no glow", () => {
    const html = renderToStaticMarkup(<LampDot dim />);
    expect(html).toContain("opacity:0.45");
    expect(html).not.toContain("box-shadow");
    expect(html).toContain('data-variant="dim"');
  });

  it.each([
    [12, 8],
    [20, 12],
    [22, 14],
  ])("draws at %i×%i", (width, height) => {
    const html = renderToStaticMarkup(<LampDot width={width} height={height} />);
    expect(html).toContain(`width:${width}px`);
    expect(html).toContain(`height:${height}px`);
  });

  it("is decoration: hidden from a screen reader, and amber is never its text", () => {
    const html = renderToStaticMarkup(<LampDot />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/(^|;)color:/);
  });

  it("is what PlaqueLamp draws, and keeps its own hook", () => {
    const { container } = render(<PlaqueLamp dim size="header" />);
    const lamp = container.querySelector("[data-plaque-lamp]") as HTMLElement;
    expect(lamp.getAttribute("data-plaque-lamp")).toBe("dim");
    expect(lamp.style.opacity).toBe("0.45");
    expect(lamp.style.width).toBe("12px");
    expect(lamp.getAttribute("data-ui")).toBe("lamp-dot");
  });
});

describe("PictureLamp", () => {
  it("is an 18px centred row with a 30×8 --lit lamp and a wash, when healthy", () => {
    const html = renderToStaticMarkup(<PictureLamp state="healthy" />);
    expect(html).toContain('data-variant="on"');
    expect(html).toContain("height:18px");
    expect(html).toContain("justify-content:center");
    // the lamp
    expect(html).toContain("width:30px;height:8px");
    expect(html).toContain("border-radius:50%");
    expect(html).toContain("background-color:var(--lit)");
    expect(html).toContain("margin-top:3px");
    expect(html).toContain("box-shadow:var(--picture-lamp-glow)");
    // the wash
    expect(html).toContain("left:50%");
    expect(html).toContain("top:10px");
    expect(html).toContain("width:220px;height:110px;margin-left:-110px");
    expect(html).toContain(
      "radial-gradient(ellipse 50% 60% at 50% 0%, var(--picture-lamp-wash) 0%, transparent 100%)",
    );
    expect(html).toContain("pointer-events:none");
    expect(html).not.toContain("opacity:0.45");
  });

  it("dims the lamp and the wash to 45% when stale, and drops the glow", () => {
    const html = renderToStaticMarkup(<PictureLamp state="stale" />);
    expect(html).toContain('data-variant="dim"');
    expect(html.match(/opacity:0\.45/g)).toHaveLength(2); // the wash and the lamp
    expect(html).not.toContain("picture-lamp-glow");
  });

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
  it("is a wrapping, centred flex row at gap 7, tag then freshness", () => {
    const html = plaqueHtml(BY_STATE.healthy);
    expect(html).toContain("display:flex;align-items:center;flex-wrap:wrap;gap:7px");
    expect(html).toContain('data-plaque-state="healthy"');
    expect(html).toContain('data-variant="fresh"');
  });

  it("puts '41 reproduced' on --evidence-fill in --on-evidence-fill, DM Mono, 2px 6px, radius 8, no wrap", () => {
    const html = plaqueHtml(BY_STATE.healthy);
    expect(html).toContain("background:var(--evidence-fill)");
    expect(html).toContain("color:var(--on-evidence-fill)");
    expect(html).toContain("padding:2px 6px");
    expect(html).toContain("border-radius:var(--r-chip)");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("DM Mono");
    expect(html).toContain("41 reproduced");
  });

  it("lights the lamp and sets the claim in --text", () => {
    const html = plaqueHtml(BY_STATE.healthy);
    expect(html).toContain('data-plaque-lamp="lit"');
    expect(html).toContain("gap:5px");
    expect(html).toContain("color:var(--text);");
    expect(html).toContain("box-shadow:var(--lamp-glow)");
  });

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
  it("keeps the tag, dims the lamp and sets the claim in --text2", () => {
    const html = plaqueHtml(BY_STATE.stale);
    expect(html).toContain('data-plaque-state="stale"');
    expect(html).toContain('data-variant="stale"');
    expect(html).toContain("41 reproduced");
    expect(html).toContain('data-plaque-lamp="dim"');
    expect(html).toContain("opacity:0.45");
    expect(html).toContain("color:var(--text2);");
    expect(html).not.toContain("box-shadow");
  });

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
  it("is one line, 'not yet reproduced', in --text2 — no tag, no lamp, no freshness", () => {
    const html = plaqueHtml(BY_STATE.unreproduced);
    expect(html).toContain('data-plaque-state="unreproduced"');
    expect(html).toContain('data-variant="never"');
    expect(html).toContain("not yet reproduced");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("Figtree");
    expect(html).not.toContain("evidence-fill");
    expect(html).not.toContain("data-plaque-lamp");
    expect(html).not.toContain("data-plaque-freshness");
    expect(html).not.toContain("not confirmed by anyone yet");
  });

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
  it.each([
    ["card", "10px", "10px"],
    ["row", "11px", "11px"],
    ["header", "13px", "12px"],
  ] as const)("%s sets the tag at %s and the claim at %s", (size, tag, text) => {
    const html = plaqueHtml(BY_STATE.healthy, size);
    expect(html).toContain(`font-size:${tag}`);
    expect(html).toContain(`font-size:${text}`);
  });

  it("sets the unreproduced line at the same size as the claim", () => {
    expect(plaqueHtml(BY_STATE.unreproduced, "card")).toContain("font-size:10px");
    expect(plaqueHtml(BY_STATE.unreproduced, "row")).toContain("font-size:11px");
    expect(plaqueHtml(BY_STATE.unreproduced, "header")).toContain("font-size:12px");
  });

  it("says it short on a card and a row, and in full on the header", () => {
    expect(renderPlaque(BY_STATE.healthy, "card").textContent).toContain("3 days ago, on Sonnet 4.5");
    expect(renderPlaque(BY_STATE.healthy, "card").textContent).not.toContain("last confirmed working");
    expect(renderPlaque(BY_STATE.healthy, "row").textContent).not.toContain("last confirmed working");
    expect(renderPlaque(BY_STATE.healthy, "header").textContent).toContain(
      "last confirmed working 3 days ago, on Sonnet 4.5",
    );
  });

  it("never inflates the count: the numeral is the size of its neighbours at every size", () => {
    for (const size of SIZES) {
      const container = renderPlaque(BY_STATE.healthy, size);
      expect(container.querySelector("[data-plaque-reproduction] span")).toBeNull();
    }
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
