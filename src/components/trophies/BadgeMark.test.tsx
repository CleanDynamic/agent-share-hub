// RC-P26 — a badge is drawn one way, and its tier can be read without its colour.
//
// buildgallery-theme › Progress and achievement says tier is weight and fill,
// never a hue, and STATES.md row 18 turns that into three fills. This holds the
// component to the row, holds every other surface that draws a badge to the same
// paint ("every badge of a tier looks identical apart from its icon"), holds the
// tier to the words in its accessible name ("don't rely on colour alone"), and
// records the contrast of every pairing the treatment spends.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DepthRevealModal from "@/components/depth/DepthRevealModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dusk, exhibition, type TokenName } from "@/lib/theme/semantics";

import { BADGES, type Badge, type Tier } from "./badge-data";
import { BadgeChip, BadgeMark, badgeLabel, badgePaint } from "./BadgeMark";
import { BadgeTile } from "./badge-tile";
import { PendingRevealStrip } from "./pending-reveal-strip";
import { ShowcaseStrip } from "./showcase-strip";

const TIERS: Tier[] = ["common", "rare", "highest"];
const first = (tier: Tier): Badge => BADGES.find((badge) => badge.tier === tier)!;

/** STATES.md row 18, as the three fills it names. The edge is 1px in all of them. */
const EARNED = {
  common: { background: "transparent", border: "1px solid var(--line)", color: "var(--text)" },
  rare: { background: "var(--recess)", border: "1px solid var(--recess)", color: "var(--text)" },
  highest: { background: "var(--lit)", border: "1px solid var(--lit)", color: "var(--on-lit)" },
} as const;

/** Not yet earned: the outline, a --text2 icon, whatever the tier. */
const NOT_YET = { background: "transparent", border: "1px solid var(--line)", color: "var(--text2)" } as const;

/** Static markup as a DOM: jsdom drops var() from a style object but keeps the attribute text. */
function dom(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

function style(element: Element | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (element?.getAttribute("style") ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

function paintOf(element: Element | null) {
  const s = style(element);
  return { background: s["background"], border: s["border"], color: s["color"] };
}

function mark(badge: Badge, earned: boolean): HTMLElement {
  return dom(renderToStaticMarkup(<BadgeMark badge={badge} earned={earned} />)).querySelector<HTMLElement>('[role="img"]')!;
}

/** A source file without its comments, so prose about a token is not taken for using it. */
function code(file: string): string {
  return readFileSync(join("src", "components", "trophies", file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("the document and the component say the same thing", () => {
  it("STATES.md row 18 and XP-DESIGN.md give the three fills the component spends", () => {
    const states = readFileSync(join("docs", "reconciliation", "STATES.md"), "utf8");
    const design = readFileSync(join("docs", "reconciliation", "XP-DESIGN.md"), "utf8");
    expect(states).toMatch(/\| 18 \|[^\n]*common = 1px --line outline, rare = --recess fill, highest = --lit fill/);
    expect(design).toContain("common = outline; rare = --recess fill; highest = --lit fill with --on-lit.");
  });
});

describe("each tier renders its treatment (STATES.md row 18)", () => {
  it.each(TIERS)("an earned %s badge is painted as the ladder says", (tier) => {
    const tile = mark(first(tier), true);

    expect(paintOf(tile)).toEqual(EARNED[tier]);
    expect(badgePaint(tier, true)).toEqual(EARNED[tier]);
    expect(tile.textContent).toBe(first(tier).name);
    expect(tile.getAttribute("data-tier")).toBe(tier);
    expect(tile.getAttribute("data-earned")).toBe("true");
  });

  it.each(TIERS)("a %s badge not yet earned is the outline, a --text2 icon and Not yet beneath", (tier) => {
    const tile = mark(first(tier), false);

    expect(paintOf(tile)).toEqual(NOT_YET);
    expect(badgePaint(tier, false)).toEqual(NOT_YET);
    // The name, then Not yet beneath it.
    expect([...tile.querySelectorAll("span")].map((span) => span.textContent)).toEqual([first(tier).name, "Not yet"]);
    expect(tile.getAttribute("data-earned")).toBe("false");
  });

  it("puts --on-lit on the icon and the label of the highest tier, and sets no ink of its own on either", () => {
    const tile = mark(first("highest"), true);

    expect(style(tile).color).toBe("var(--on-lit)");
    for (const span of tile.querySelectorAll("span")) expect(style(span).color).toBeUndefined();
    // A lucide icon strokes in currentColor, so it takes the tile's ink.
    expect(tile.querySelector("svg")!.getAttribute("stroke")).toBe("currentColor");
    expect(tile.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("every badge of a tier looks identical apart from its icon and its name, earned or not", () => {
    for (const tier of TIERS) {
      for (const earned of [true, false]) {
        const styles = BADGES.filter((badge) => badge.tier === tier).map((badge) => mark(badge, earned).getAttribute("style"));
        expect(new Set(styles).size, `${tier}, earned ${earned}`).toBe(1);
      }
    }
  });

  it("is one size in every tier and state: only the paint differs, so earning a badge moves nothing", () => {
    const geometries = new Set<string>();
    for (const badge of BADGES) {
      for (const earned of [true, false]) {
        const s = style(mark(badge, earned));
        expect(s["border"], badge.id).toMatch(/^1px solid /);
        delete s["background"];
        delete s["border"];
        delete s["color"];
        geometries.add(JSON.stringify(s));
      }
    }
    expect(geometries.size).toBe(1);
    const geometry = JSON.parse([...geometries][0]);
    expect(geometry["border-radius"]).toBe("var(--r-chip)");
    expect(geometry["box-sizing"]).toBe("border-box");
    expect(geometry["aspect-ratio"]).toBe("1 / 1");
  });

  it("uses amber as a ground only, never as ink: amber is light, never type", () => {
    for (const tier of TIERS) {
      for (const earned of [true, false]) {
        expect(badgePaint(tier, earned).color, `${tier} ${earned}`).not.toContain("--lit");
      }
    }
    expect(badgePaint("highest", true).background).toBe("var(--lit)");
  });
});

describe("a tier is readable without its colour", () => {
  it("every badge's accessible name is '<name>, <tier> badge', and says not yet earned when it is not", () => {
    for (const badge of BADGES) {
      expect(badgeLabel(badge, true)).toBe(`${badge.name}, ${badge.tier} badge`);
      expect(badgeLabel(badge, false)).toBe(`${badge.name}, ${badge.tier} badge, not yet earned`);
      expect(mark(badge, true).getAttribute("aria-label")).toBe(`${badge.name}, ${badge.tier} badge`);
      expect(mark(badge, false).getAttribute("aria-label")).toBe(`${badge.name}, ${badge.tier} badge, not yet earned`);
    }
  });

  it("is found by that name in the accessibility tree", () => {
    render(
      <div>
        {BADGES.map((badge) => (
          <BadgeMark key={badge.id} badge={badge} earned={badge.tier !== "common"} />
        ))}
      </div>,
    );
    for (const badge of BADGES) {
      const name = `${badge.name}, ${badge.tier} badge${badge.tier === "common" ? ", not yet earned" : ""}`;
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
  });

  it("sorts the ten into three, four and three by the words alone, with every style stripped", () => {
    const told = BADGES.map((badge) => /, (common|rare|highest) badge/.exec(badgeLabel(badge, true))![1]);
    expect(TIERS.map((tier) => told.filter((word) => word === tier).length)).toEqual([3, 4, 3]);
    expect(told).toEqual(BADGES.map((badge) => badge.tier));
  });

  it("tells the tiers apart by fill, not by hue: three different grounds from one closed palette", () => {
    expect(new Set(TIERS.map((tier) => badgePaint(tier, true).background)).size).toBe(3);

    const tokens = new Set(
      TIERS.flatMap((tier) => [true, false].map((earned) => Object.values(badgePaint(tier, earned)).join(" ")))
        .join(" ")
        .match(/var\((--[a-z0-9-]+)\)/g)
        ?.map((use) => use.slice(4, -1)),
    );
    expect([...tokens].sort()).toEqual(["--line", "--lit", "--on-lit", "--recess", "--text", "--text2"]);
  });
});

describe("the cabinet tile", () => {
  it("is a button named by its mark, and selects its badge", () => {
    const onSelect = vi.fn();
    const badge = { ...BADGES[0], earned: true };
    render(<BadgeTile badge={badge} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "First build, common badge" }));

    expect(onSelect).toHaveBeenCalledWith(badge);
  });

  it("is named not yet earned when it is not", () => {
    render(<BadgeTile badge={BADGES[3]} />);

    expect(screen.getByRole("button", { name: "Proven, rare badge, not yet earned" })).toBeInTheDocument();
  });

  it("has no paint of its own, so there is one edge and the mark carries the tier", () => {
    const button = dom(renderToStaticMarkup(<BadgeTile badge={first("rare")} />)).querySelector("button")!;
    const s = style(button);

    expect(s["background"]).toBe("none");
    expect(s["border"]).toBe("0");
    expect(button.querySelector('[role="img"]')).not.toBeNull();
  });
});

describe("every surface that draws a badge spends the same paint", () => {
  const earned: Badge[] = TIERS.map((tier) => ({ ...first(tier), earned: true }));

  it("the showcase strip paints each tile as the mark does, at the chip radius, and names its tier", () => {
    const strip = dom(
      renderToStaticMarkup(
        <TooltipProvider>
          <ShowcaseStrip badges={earned} isOwnProfile={false} />
        </TooltipProvider>,
      ),
    );
    const tiles = [...strip.querySelectorAll('div[role="img"]')];

    expect(tiles).toHaveLength(3);
    tiles.forEach((tile, at) => {
      expect(paintOf(tile)).toEqual(EARNED[earned[at].tier]);
      expect(style(tile)["border-radius"]).toBe("var(--r-chip)");
      expect(tile.getAttribute("aria-label")).toBe(badgeLabel(earned[at], true));
    });
  });

  it("the auto-pinned showcase paints the same, and its button name carries the tier and the pin", () => {
    const strip = dom(
      renderToStaticMarkup(
        <TooltipProvider>
          <ShowcaseStrip badges={earned} isOwnProfile={false} autoPinned />
        </TooltipProvider>,
      ),
    );
    const buttons = [...strip.querySelectorAll("button")];

    expect(buttons).toHaveLength(3);
    buttons.forEach((button, at) => {
      expect(paintOf(button)).toEqual(EARNED[earned[at].tier]);
      expect(style(button)["border-radius"]).toBe("var(--r-chip)");
      expect(button.getAttribute("aria-label")).toBe(`${badgeLabel(earned[at], true)}, auto-pinned`);
    });
  });

  it("the empty showcase slots are the badges' shape", () => {
    const strip = dom(
      renderToStaticMarkup(
        <TooltipProvider>
          <ShowcaseStrip badges={[]} isOwnProfile autoPinned />
        </TooltipProvider>,
      ),
    );
    // The five empty slots are the only divs the strip hides from the accessibility tree; its icons are svgs.
    const slots = [...strip.querySelectorAll('div[aria-hidden="true"]')];

    expect(slots).toHaveLength(5);
    for (const slot of slots) expect(style(slot)["border-radius"]).toBe("var(--r-chip)");
  });

  /* RC-P28a — the chip a line of text uses (the profile header's founder badge). */
  it("the chip paints each badge as the mark does, at the chip radius, and names its tier", () => {
    for (const tier of TIERS) {
      for (const isEarned of [true, false]) {
        const badge = first(tier);
        const chip = dom(renderToStaticMarkup(<BadgeChip badge={badge} earned={isEarned} />)).querySelector('[role="img"]');

        expect(paintOf(chip), `${tier} ${isEarned}`).toEqual(isEarned ? EARNED[tier] : NOT_YET);
        expect(style(chip)["border-radius"]).toBe("var(--r-chip)");
        expect(chip?.getAttribute("aria-label")).toBe(badgeLabel(badge, isEarned));
        expect(chip?.textContent).toBe(badge.name);
      }
    }
  });

  it("the reveal strip paints each well as the mark does and does not read a name twice", () => {
    const strip = dom(renderToStaticMarkup(<PendingRevealStrip badges={earned} />));
    const wells = [...strip.querySelectorAll('span[role="img"]')];

    expect(wells).toHaveLength(3);
    wells.forEach((well, at) => {
      expect(paintOf(well)).toEqual(EARNED[earned[at].tier]);
      expect(style(well)["border-radius"]).toBe("var(--r-chip)");
      expect(well.getAttribute("aria-label")).toBe(badgeLabel(earned[at], true));
      expect(well.nextElementSibling?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("the depth reveal draws a key in the catalogue as its badge, and any other key as a common one", () => {
    render(
      <DepthRevealModal
        open
        onClose={() => {}}
        pendingBadges={[
          { id: "row-1", badge_key: "well-proven", title: "Well proven", description: "a build of yours is run successfully by 10 other people" },
          { id: "row-2", badge_key: "first-steps", title: "First Steps", description: "Completed the onboarding quest." },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "Well proven, highest badge" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "First Steps, common badge" })).toBeInTheDocument();
  });
});

describe("no badge uses a category hue or a tier colour", () => {
  it("in any mark, earned or not", () => {
    for (const badge of BADGES) {
      for (const earned of [true, false]) {
        const html = renderToStaticMarkup(<BadgeMark badge={badge} earned={earned} />);
        expect(html, `${badge.id} ${earned}`).not.toMatch(/--cat-|--tier-|oklch\(|#[0-9a-f]{3,8}\b|rgba?\(/i);
      }
    }
  });

  it("in any file that draws a badge", () => {
    const files = [
      "BadgeMark.tsx",
      "badge-data.ts",
      "badge-tile.tsx",
      "badge-detail-modal.tsx",
      "cabinet-grid.tsx",
      "pending-reveal-strip.tsx",
      "showcase-editor.tsx",
      "showcase-strip.tsx",
    ];
    for (const file of files) {
      expect(code(file), file).not.toMatch(/--cat-|\bt\.cat[A-Z]\w*|\bcat[A-Z]\w*\b|tierColorVar|--tier-|oklch\(|#[0-9a-f]{3,8}\b|rgba?\(/);
    }
    // The reveal modal maps a key to a badge and must not reach for a hue either.
    const reveal = readFileSync(join("src", "components", "depth", "DepthRevealModal.tsx"), "utf8");
    expect(reveal).not.toMatch(/--cat-|\bt\.cat[A-Z]|tierColorVar|--tier-|oklch\(/);
  });
});

/* ── measurement ──────────────────────────────────────────────────────────────
   The arithmetic is local, as it is in contrast.test.ts and state-contrast.test.ts:
   a shared module is one more thing every prompt has to be told about, for twenty
   lines that have not changed since 2008. */

type Rgba = [number, number, number, number];

function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]*))?\)$/.exec(colour.replace(/\s/g, ""));
  if (!rgb) throw new Error(`unparseable colour: ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
}

function over(fg: string, bg: string): string {
  const f = parse(fg);
  const b = parse(bg);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(f[i] * f[3] + b[i] * (1 - f[3])));
  return `rgb(${r},${g},${bl})`;
}

function luminance(colour: string): number {
  const [r, g, b, a] = parse(colour);
  if (a !== 1) throw new Error(`luminance needs an opaque colour, got ${colour}`);
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const ROOMS = { exhibition, dusk } as const;
type Room = keyof typeof ROOMS;
const ROOM_NAMES: Room[] = ["exhibition", "dusk"];

const tokenOf = (room: Room, token: TokenName): string => ROOMS[room][token];
const glassOf = (room: Room): string => over(tokenOf(room, "glass"), tokenOf(room, "bg"));

describe("the pairings the treatment spends are measured", () => {
  const PAIRS: { job: string; ink: TokenName; ground: TokenName | "glass" }[] = [
    { job: "common label on the page", ink: "text", ground: "bg" },
    { job: "common label on a card", ink: "text", ground: "glass" },
    { job: "rare label on its fill", ink: "text", ground: "recess" },
    { job: "highest icon and label on its fill", ink: "on-lit", ground: "lit" },
    { job: "not yet, on the page", ink: "text2", ground: "bg" },
    { job: "not yet, on a card", ink: "text2", ground: "glass" },
  ];

  const ground = (room: Room, name: TokenName | "glass") => (name === "glass" ? glassOf(room) : tokenOf(room, name));

  it.each(ROOM_NAMES.flatMap((room) => PAIRS.map((pair) => ({ room, ...pair }))))(
    "$room: $job clears the 4.5:1 text floor",
    ({ room, ink, ground: name }) => {
      const ratio = contrast(tokenOf(room, ink), ground(room, name));
      expect(ratio, `${room} --${ink} on --${name} is ${ratio}:1`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("records the figures the component's header quotes, so a moved token has to be re-recorded", () => {
    const figures = ROOM_NAMES.map((room) => ({
      room,
      textOnBg: contrast(tokenOf(room, "text"), tokenOf(room, "bg")),
      textOnRecess: contrast(tokenOf(room, "text"), tokenOf(room, "recess")),
      onLitOnLit: contrast(tokenOf(room, "on-lit"), tokenOf(room, "lit")),
      text2OnBg: contrast(tokenOf(room, "text2"), tokenOf(room, "bg")),
    }));
    expect(figures).toEqual([
      { room: "exhibition", textOnBg: 13.1, textOnRecess: 11.33, onLitOnLit: 7.29, text2OnBg: 5.26 },
      { room: "dusk", textOnBg: 14.17, textOnRecess: 10.62, onLitOnLit: 7.49, text2OnBg: 7.65 },
    ]);
  });

  // REPORTED, NOT REPAINTED (RC-P26). Two EDGES of the ladder are under the 3.0:1
  // floor for UI on Exhibition: the outline, --line on --bg, and the highest tier's
  // amber against the ground, which is the same 1.80 the focus ring was escalated
  // for (BG-P30, state-contrast.test.ts). The ladder is the theme's own and neither
  // edge is the only carrier of anything: the ink inside is what is read (all six
  // pairings above clear 4.5) and the tier is in the accessible name. A value that
  // moves must be re-recorded here, and the note in the diary read again.
  it("records the two edges that are under the UI floor, rather than hiding them", () => {
    const edges = ROOM_NAMES.map((room) => ({
      room,
      outlineOnBg: contrast(tokenOf(room, "line"), tokenOf(room, "bg")),
      amberOnBg: contrast(tokenOf(room, "lit"), tokenOf(room, "bg")),
    }));
    expect(edges).toEqual([
      { room: "exhibition", outlineOnBg: 1.3, amberOnBg: 1.8 },
      { room: "dusk", outlineOnBg: 1.82, amberOnBg: 7.47 },
    ]);
  });
});
