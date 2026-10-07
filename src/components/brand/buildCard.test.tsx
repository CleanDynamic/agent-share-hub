// UI-P14 — the pure build card: the reference's geometry, in the reference's order.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BuildCard, CardCredit, COVER_HEIGHT, type BuildCardProps } from "./BuildCard";
import type { PlaqueBuild } from "./Plaque";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-01T12:00:00Z");
const FRESH: PlaqueBuild = {
  reproduction_count: 41,
  rebuild_count: 0,
  last_confirmed_at: new Date(NOW - 3 * DAY).toISOString(),
  last_confirmed_model: "sonnet-4.5",
  published_at: new Date(NOW - 60 * DAY).toISOString(),
};

const props = (over: Partial<BuildCardProps> = {}): BuildCardProps => ({
  to: "/b2/invoice-triage-agent",
  title: "Invoice triage agent",
  cover: <div data-testid="cover" />,
  shape: "agent",
  build: FRESH,
  now: NOW,
  ...over,
});

const markup = (over?: Partial<BuildCardProps>) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <BuildCard {...props(over)} />
    </MemoryRouter>,
  );

describe("BuildCard", () => {
  it("is one glass surface: --glass, a 1px --glass-border, radius 14, 5px padding and gap, the card shadow", () => {
    // UI-P52 density pass: padding and gap 7 → 5.
    const html = markup();
    expect(html).toContain("background:var(--glass)");
    expect(html).toContain("border-radius:var(--r-card)");
    expect(html).toContain("padding:5px");
    expect(html).toContain("gap:5px");
    expect(html).toContain("box-shadow:var(--shadow-card)");
    expect(html).toContain("border-width:1px;border-style:solid;border-color:var(--glass-border)");
    expect(html).not.toMatch(/backdrop|blur/i);
  });

  it("orders the lamp, the cover with its tag, the title, the credit and Δ, the plaque, the chips and the ask", () => {
    const html = markup({
      credit: <CardCredit rebuiltFrom="Inbox sorter" by="@maya" />,
      delta: "swapped model",
      categories: ["instruction", "data"],
      openAsk: "1 part unsolved · £400",
    });
    const at = (needle: string) => html.indexOf(needle);
    const order = [
      'data-ui="picture-lamp"',
      'data-testid="cover"',
      'data-ui="shape-tag"',
      "<h3",
      'data-card-part="credit"',
      "Δ swapped model",
      'data-ui="plaque"',
      'data-card-part="chips"',
      'data-testid="gallery-card-bounty"',
    ].map(at);
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("sits the cover in a clipped box of the context's height, radius 10, with the tag at top 6 left 6", () => {
    expect(markup()).toContain("height:92px;border-radius:var(--r-media);overflow:hidden");
    expect(markup({ coverHeight: COVER_HEIGHT.catalogue })).toContain("height:112px");
    const html = markup();
    expect(html).toContain("top:6px;left:6px;background:var(--media-tag);color:var(--text)");
    // UI-P52 density pass: the tag's padding is 2px 4px; positions and cover heights are not in the table.
    expect(html).toContain("padding:2px 4px");
    expect(COVER_HEIGHT).toEqual({ catalogue: 112, wall: 92, works: 86, mobile: 96 });
  });

  it("sets the title drawn at 19 (18 or 17 on mobile) on one line with an ellipsis", () => {
    // UI-P52 density pass: display() renders the drawn size through the table
    // (19 → 16, 17 → 16), and under 20px a display role is Figtree 600.
    const html = markup();
    expect(html).toContain("font-size:16px;font-weight:600");
    expect(html).toContain("white-space:nowrap;overflow:hidden;text-overflow:ellipsis");
    expect(markup({ titleSize: 17 })).toContain("font-size:16px");
  });

  it("pads the body 0 5px 5px at gap 6, and chips wrap at gap 4", () => {
    const html = markup({ categories: ["instruction"] });
    expect(html).toContain("padding:0 5px 5px");
    expect(html).toMatch(/data-card-part="chips" style="display:flex;gap:4px;flex-wrap:wrap"/);
  });

  it("never offers breakage as a chip", () => {
    const html = markup({ categories: ["breakage", "evidence"] });
    expect(html).not.toContain('data-category="breakage"');
    expect(html).toContain('data-category="evidence"');
  });

  it("says the open ask in 10px mono --cat-breakage", () => {
    const html = markup({ openAsk: "2 parts unsolved · £400" });
    expect(html).toMatch(/DM Mono.*font-size:10px;line-height:normal;color:var\(--cat-breakage\)/);
    expect(html).toContain("2 parts unsolved · £400");
  });

  it("turns the border into 1.5px dashed --cat-breakage for a gap, and changes nothing else about the card's colour", () => {
    const gap = markup({ gap: true });
    expect(gap).toContain("border-width:1.5px;border-style:dashed;border-color:var(--cat-breakage)");
    expect(gap).toContain("background:var(--glass)");
    expect(gap).not.toContain("border-color:var(--glass-border)");
  });

  it("is one link named by its title, and the title is a level-3 heading", () => {
    render(
      <MemoryRouter>
        <BuildCard {...props({ categories: ["instruction"] })} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Invoice triage agent" })).toHaveAttribute("href", "/b2/invoice-triage-agent");
    expect(screen.getByRole("heading", { level: 3, name: "Invoice triage agent" })).toBeTruthy();
  });

  it("takes a media node in place of the cover box, with no tag and no fixed height", () => {
    const html = markup({ media: <div data-testid="thread" /> });
    expect(html).toContain('data-testid="thread"');
    expect(html).not.toContain('data-ui="shape-tag"');
    expect(html).not.toContain("height:92px");
  });

  it("reads the lamp off the plaque's own state, so they cannot disagree", () => {
    expect(markup()).toContain('data-variant="on"');
    expect(markup({ build: { ...FRESH, reproduction_count: 0, last_confirmed_at: null } })).toContain('data-variant="off"');
    expect(markup({ build: { ...FRESH, last_confirmed_at: new Date(NOW - 200 * DAY).toISOString() } })).toContain(
      'data-variant="dim"',
    );
  });
});

describe("CardCredit", () => {
  it("says 'by @maya' in Figtree 11 --text2", () => {
    const html = renderToStaticMarkup(<CardCredit by="@maya" />);
    expect(html).toContain("by @maya");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("color:var(--text2)");
    expect(html).not.toContain("<i");
  });

  it("says 'Rebuilt from Inbox sorter by @maya' with the source in italic --text", () => {
    const html = renderToStaticMarkup(<CardCredit rebuiltFrom="Inbox sorter" by="@maya" />);
    expect(html).toContain("Rebuilt from ");
    expect(html).toContain('<i style="color:var(--text)">Inbox sorter</i>');
    expect(html).toContain(" by @maya");
    expect(html).toContain('title="Rebuilt from Inbox sorter by @maya"');
  });

  it("says nothing with neither half", () => {
    expect(renderToStaticMarkup(<CardCredit />)).toBe("");
  });
});
