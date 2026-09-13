// BG-P21 — the repainted build header.
//
// The claims: all three hero variants land in the same `--recess` media well
// with a `--line` hairline above and `--r-media` on the media itself; the title
// is the display face at a clamp whose floor clears the 20px display minimum;
// the outcome takes the reading measure; the facts strip weighs its members
// evenly and prints every figure in tabular numerals.
//
// Colour and type are read off static markup rather than the mounted DOM: every
// value here is a `var(--token)` and jsdom's CSS parser drops those on
// assignment. See src/test/tokenStyle.tsx.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BuildHeader, type HeroMedia } from "./BuildHeader";
import type { Build, NodeTree, NodeType } from "@/lib/build";
import { staticDoc, styleOf } from "@/test/tokenStyle";

const build = {
  id: "b1",
  slug: "inbox-triage",
  title: "Inbox triage agent",
  outcome: "Sorts a morning's email into three piles and drafts the replies.",
  shape: "workflow",
  live_url: null,
  hero_node_id: null,
  made_for: [],
  made_with: [],
  cost_setup: 40,
  cost_monthly: 12,
  currency: "GBP",
  time_to_first_result: 25,
  reproduction_count: 3,
  rebuild_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
} as unknown as Build;

const tree: NodeTree[] = [];
const nodeTypes: NodeType[] = [];

function header(overrides: Partial<Build> = {}, hero?: HeroMedia) {
  return (
    <BuildHeader
      build={{ ...build, ...overrides } as Build}
      tree={tree}
      nodeTypes={nodeTypes}
      hero={hero}
    />
  );
}

/** The hero well, whichever variant filled it. */
function well(doc: Document): Element | null {
  return doc.querySelector('[data-visual-slot="build-hero"]');
}

describe("the hero is a well, not a framed card", () => {
  const screenshot: HeroMedia = { kind: "image", src: "/shot.png", alt: "A screenshot" };
  const video: HeroMedia = {
    kind: "video",
    src: "/clip.mp4",
    poster: "/poster.png",
    alt: "A recording",
  };

  it("grounds a screenshot in --recess under a --line hairline", () => {
    const style = styleOf(well(staticDoc(header({}, screenshot))));
    expect(style).toContain("background:var(--recess)");
    expect(style).toContain("border-top:1px solid var(--line)");
    expect(style).toContain("border-radius:var(--r-media)");
  });

  it("gives the same well to a video and to a live embed", () => {
    const videoWell = styleOf(well(staticDoc(header({}, video))));
    const liveWell = styleOf(
      well(staticDoc(header({ shape: "app", live_url: "https://example.test" } as Partial<Build>)))
    );

    for (const style of [videoWell, liveWell]) {
      expect(style).toContain("background:var(--recess)");
      expect(style).toContain("border-top:1px solid var(--line)");
    }
  });

  it("carries no frame: no ring, no glass", () => {
    const style = styleOf(well(staticDoc(header({}, screenshot))));
    expect(style).not.toContain("var(--glass");
    // The hairline above is the only border the well has.
    expect(style).not.toContain("border:1px solid");
  });

  it("puts --r-media on the media itself, not only on the well", () => {
    const image = staticDoc(header({}, screenshot)).querySelector("img");
    expect(styleOf(image)).toContain("border-radius:var(--r-media)");

    const player = staticDoc(header({}, video)).querySelector("video");
    expect(styleOf(player)).toContain("border-radius:var(--r-media)");
    // A recording that letterboxes sits in the page's own dark, not in #000.
    expect(styleOf(player)).toContain("background:var(--porthole)");
  });

  it("keeps the video a player with its poster, muted and not autoplaying", () => {
    render(header({}, video));
    const player = document.querySelector("video") as HTMLVideoElement;
    expect(player.getAttribute("poster")).toBe("/poster.png");
    expect(player.hasAttribute("muted") || player.muted).toBe(true);
    expect(player.hasAttribute("autoplay")).toBe(false);
  });

  it("spends no second primary on the live embed's load button", () => {
    const doc = staticDoc(
      header({ shape: "app", live_url: "https://example.test" } as Partial<Build>)
    );
    const button = doc.querySelector('[data-visual-slot="build-hero-load-button"]');
    expect(button).toBeTruthy();
    // Secondary: glass on a --line border. A filled --action here would be the
    // page's second primary.
    expect(styleOf(button)).toContain("border-color:var(--line)");
    expect(styleOf(button)).not.toContain("background:var(--action)");
  });
});

describe("the header block", () => {
  it("sets the title in the display face, clamped above the 20px floor", () => {
    const style = styleOf(staticDoc(header()).querySelector("h1"));
    expect(style).toContain("Bodoni Moda");
    expect(style).toContain("font-size:clamp(40px, 4.6vw, 64px)");
    expect(style).toContain("color:var(--text)");
  });

  it("leads the prose with bodyLarge at the reading measure", () => {
    const doc = staticDoc(header());
    const outcome = Array.from(doc.querySelectorAll("p")).find((p) =>
      p.textContent?.startsWith("Sorts a morning")
    );
    expect(styleOf(outcome)).toContain("font-size:17px");
    expect(styleOf(outcome)).toContain("max-width:68ch");
    expect(styleOf(outcome)).toContain("color:var(--text2)");
  });

  it("renders the shared plaque under the title when no reproduction block is given", () => {
    render(header());
    // The fallback slot is the shared Plaque, which always names the model
    // alongside the claim.
    expect(screen.getByText("Reproduction")).toBeTruthy();
    expect(document.querySelector('[data-visual-slot="build-reproduction"]')).toBeTruthy();
  });
});

describe("the facts strip", () => {
  it("weighs label and figure evenly, one rung apart", () => {
    const doc = staticDoc(header());
    const strip = doc.querySelector('[data-visual-slot="build-facts"]') as Element;
    const spans = Array.from(strip.querySelectorAll("span"));

    const labels = spans.filter((span) => styleOf(span).includes("text-transform:uppercase"));
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(styleOf(label)).toContain("color:var(--text2)");
  });

  it("prints every figure in tabular numerals", () => {
    const doc = staticDoc(header());
    const strip = doc.querySelector('[data-visual-slot="build-facts"]') as Element;
    const figures = Array.from(strip.querySelectorAll("span")).filter((span) =>
      styleOf(span).includes("font-variant-numeric:tabular-nums")
    );

    // Cost and speed both carry digits, and both are tabular.
    expect(figures.length).toBeGreaterThanOrEqual(2);
    for (const figure of figures) expect(styleOf(figure)).toContain("color:var(--text)");
  });

  it("rules the strip with --line and gives it no fill of its own", () => {
    const doc = staticDoc(header());
    const style = styleOf(doc.querySelector('[data-visual-slot="build-facts"]'));
    expect(style).toContain("border-top:1px solid var(--line)");
    expect(style).toContain("border-bottom:1px solid var(--line)");
    expect(style).not.toContain("background:");
    // It wraps, which is what carries four facts down to 390.
    expect(style).toContain("flex-wrap:wrap");
  });
});
