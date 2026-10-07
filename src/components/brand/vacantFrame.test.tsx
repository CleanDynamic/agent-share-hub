// UI-P15 — the vacant frame: the dashed card for one missing part, with a reward.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MissingWindow } from "@/components/bounty/MissingWindow";
import { VacantFrame, vacantMeta, type VacantFrameProps } from "./VacantFrame";

const props = (over: Partial<VacantFrameProps> = {}): VacantFrameProps => ({
  title: "Bug report triage",
  cover: <div data-testid="cover" />,
  part: "Duplicate detector",
  reward: "£400",
  category: "instruction",
  categoryLabel: "instruction",
  closesIn: "9 days",
  solutions: 5,
  meToo: 14,
  to: "/b2/bug-report-triage",
  ...over,
});

const markup = (over?: Partial<VacantFrameProps>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <VacantFrame {...props(over)} />
    </MemoryRouter>,
  );

describe("VacantFrame", () => {
  it("is a 1.5px dashed --cat-breakage card, radius 14, padding 5, gap 6, on --glass with the card shadow", () => {
    // UI-P52 density pass: padding 7 → 5, gap 8 → 6.
    const html = markup();
    expect(html).toContain("border-width:1.5px;border-style:dashed;border-color:var(--cat-breakage)");
    expect(html).toContain("border-radius:var(--r-card)");
    expect(html).toContain("padding:5px");
    expect(html).toContain("gap:6px");
    expect(html).toContain("background:var(--glass)");
    expect(html).toContain("box-shadow:var(--shadow-card)");
  });

  it("swaps the ground to --row-highlight when selected, and nothing else", () => {
    const selected = markup({ selected: true });
    expect(selected).toContain("background:var(--row-highlight)");
    expect(selected).not.toContain("background:var(--glass)");
    expect(selected).toContain('data-variant="selected"');
    expect(selected).toContain("border-color:var(--cat-breakage)");
  });

  it("always hangs a dim lamp, whatever the build's state", () => {
    expect(markup()).toContain('data-ui="picture-lamp" data-variant="dim"');
  });

  it("puts the missing window on a 104px cover, then the title and reward, then the chip and the meta", () => {
    const html = markup();
    expect(html).toContain("height:104px;border-radius:var(--r-media);overflow:hidden");
    const at = (needle: string) => html.indexOf(needle);
    const order = ['data-testid="cover"', 'data-ui="missing-window"', "<h3", 'data-testid="vacant-reward"', 'data-ui="category-chip"', "9 days · 5 solutions · 14 me too"].map(at);
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("sets the title drawn at 18 on one line and the reward in 15px mono --text", () => {
    // UI-P52 density pass: display(18) renders at 15 (Figtree 600, under
    // Sentient's floor) and the reward 18 → 15, both at normal leading as the
    // board sets them.
    const html = markup();
    expect(html).toContain("font-size:15px;font-weight:600");
    expect(html).toContain("white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    expect(html).toMatch(/data-testid="vacant-reward" style="[^"]*font-size:15px;line-height:normal;color:var\(--text\)/);
    expect(html).toContain(">£400<");
  });

  it("draws no reward for an unpriced ask, and no chip for a build-level one", () => {
    const html = markup({ reward: null, category: null, categoryLabel: null });
    expect(html).not.toContain('data-testid="vacant-reward"');
    expect(html).not.toContain('data-ui="category-chip"');
    expect(html).toContain("9 days · 5 solutions · 14 me too");
  });

  it("is a link to the solve view named by the title", () => {
    render(
      <MemoryRouter>
        <VacantFrame {...props()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Bug report triage" })).toHaveAttribute("href", "/b2/bug-report-triage");
  });

  it("is a button that selects the bounty when given onSelect, by click and by key", () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <VacantFrame {...props({ to: undefined, onSelect, selected: true })} />
      </MemoryRouter>,
    );
    const card = screen.getByRole("button", { name: "Bug report triage" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "a" });
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("vacantMeta", () => {
  it("reads '{closes in} · {n} solutions · {m} me too', in the singular for one", () => {
    expect(vacantMeta({ closesIn: "9 days", solutions: 5, meToo: 14 })).toBe("9 days · 5 solutions · 14 me too");
    expect(vacantMeta({ closesIn: "2 days", solutions: 1, meToo: 0 })).toBe("2 days · 1 solution · 0 me too");
  });

  it("drops the deadline when there is none", () => {
    expect(vacantMeta({ closesIn: null, solutions: 0, meToo: 9 })).toBe("0 solutions · 9 me too");
  });
});

describe("MissingWindow", () => {
  const html = renderToStaticMarkup(<MissingWindow part="Duplicate detector" />);

  it("is 110×48 at radius 10, centred on its cover", () => {
    // UI-P52 density pass: the height 58 → 48, and the top margin follows it to
    // stay centred (the kit keeps −29, which leaves its window 5px low).
    expect(html).toContain("left:50%");
    expect(html).toContain("top:50%");
    expect(html).toContain("width:110px;height:48px;margin-left:-55px;margin-top:-24px");
    expect(html).toContain("border-radius:10px");
  });

  it("is a 1.5px dashed near-white frame on a dark scrim — fixed, because it sits on artwork", () => {
    expect(html).toContain("border:1.5px dashed #F7F8F9");
    expect(html).toContain("background:rgba(14,11,20,.55)");
    expect(html).toContain("color:#F7F8F9");
  });

  it("says MISSING over the part's name", () => {
    expect(html.indexOf("MISSING")).toBeLessThan(html.indexOf("Duplicate detector"));
    expect(html).toContain("letter-spacing:.1em");
    expect(html).toContain("font-weight:600");
  });

  it("lets a long name wrap rather than clip it", () => {
    expect(html).not.toContain("text-overflow");
    expect(html).toContain("text-align:center");
  });
});
