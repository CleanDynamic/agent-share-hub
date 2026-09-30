// RC-P28 — reputation is parked (src/lib/progress/flags.ts). The level chip's
// flyout drew a Reputation row whenever a score was passed; it now draws only
// while REPUTATION_ENABLED is true, so no mount brings the parked feature back
// by passing a number. The flag is read through a getter so one test can turn
// it on; every other test sees it as it ships, false.
//
// RC-P28a — the chip carries the level as light, the way the progress page
// does: a --lit fill with --on-lit on it, --lit bars, no glow, and no text in
// --lit. Colours are read from static markup, because jsdom drops var() from
// a style object but keeps the attribute text.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ reputation: false }));
vi.mock("@/lib/progress/flags", () => ({
  GUILDS_ENABLED: false,
  LEADERBOARDS_ENABLED: false,
  get REPUTATION_ENABLED() {
    return flags.reputation;
  },
}));

import NavProgressChip from "./NavProgressChip";
import { parkedEntryPoints } from "@/test/parkedEntryPoints";

beforeEach(() => {
  flags.reputation = false;
});

const chip = () => render(<NavProgressChip level={3} xpIntoLevel={40} xpForLevel={100} totalXp={412} reputation={78} />);

describe("NavProgressChip while reputation is parked", () => {
  it("draws no Reputation row in the flyout, even when a score is passed", () => {
    const { container } = chip();

    expect(screen.getByRole("tooltip")).toHaveTextContent("Lifetime XP");
    expect(screen.queryByText("Reputation")).toBeNull();
    expect(screen.queryByText("78")).toBeNull();
    expect(parkedEntryPoints(container)).toEqual([]);
  });

  it("draws the row only once the flag is turned on", () => {
    flags.reputation = true;
    chip();

    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
  });
});

/** The chip as static markup, parsed back into a DOM. */
function markup(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <NavProgressChip level={6} xpIntoLevel={74} xpForLevel={421} totalXp={1230} />,
  );
  return host;
}

function styleOf(element: Element | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (element?.getAttribute("style") ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

describe("NavProgressChip carries the level as light (RC-P28a)", () => {
  it("fills the level with --lit and sets --on-lit on it, with no glow", () => {
    const level = styleOf(markup().querySelector('[data-testid="level-chip-level"]'));

    expect(level["background"]).toBe("var(--lit)");
    expect(level["color"]).toBe("var(--on-lit)");
    expect(level["box-shadow"]).toBeUndefined();
  });

  it("fills both bars with --lit, never the primary's --action", () => {
    const chip = markup();
    for (const bar of ["level-chip-bar", "level-chip-flyout-bar"]) {
      expect(styleOf(chip.querySelector(`[data-testid="${bar}"]`))["background"], bar).toBe("var(--lit)");
    }
  });

  it("draws no text in --lit: amber is light, never type", () => {
    const inked = [...markup().querySelectorAll("*")].filter((element) => styleOf(element)["color"] === "var(--lit)");
    expect(inked.map((element) => element.textContent)).toEqual([]);
  });
});
