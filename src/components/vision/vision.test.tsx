// SV-02 P4: the shared pieces of the vision boards: each one's accessible name, its keys and its tokens.
//
// Styles are asserted through SSR markup, because jsdom's cssstyle drops every `var()` value (see controls.test.tsx).

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ActiveFilterChip } from "./ActiveFilterChip";
import { DashedSlot } from "./DashedSlot";
import { InnerTile } from "./InnerTile";
import { PageFigure } from "./PageFigure";
import { PlainRow } from "./PlainRow";
import { SectionHead } from "./SectionHead";
import { TextTabs } from "./TextTabs";
import { TypeChip } from "./TypeChip";

const markup = (node: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe("SectionHead", () => {
  it("draws the fact as the heading, 20/600 with 16px side padding and 8px under, and no meta line", () => {
    const html = markup(<SectionHead title="36 drafts" meta="latest first" />);
    expect(html).toContain("font-size:20px;font-weight:600;line-height:24px;color:var(--text)");
    expect(html).toContain("padding:0 16px 8px");
    expect(html).not.toContain("latest first");
  });

  it("has a chevron link named for the section, only when it has a page", () => {
    render(
      <MemoryRouter>
        <SectionHead title="Recent builds" to="/builds" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Open Recent builds" }).getAttribute("href")).toBe("/builds");
  });

  it("names the chevron from openName when the title is not text", () => {
    render(
      <MemoryRouter>
        <SectionHead title={<span>Runs</span>} openName="Runs" to="/builds" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Open Runs" })).toBeInTheDocument();
  });

  it("draws no chevron without a page, and the chevron is a ghost icon button, 32 round, text 2", () => {
    expect(markup(<SectionHead title="Notes" />)).not.toContain("Open ");
    const html = markup(<SectionHead title="Notes" to="/x" />);
    expect(html).toContain("width:32px;height:32px");
    expect(html).toContain("background:transparent");
    expect(html).toContain("color:var(--text2)");
    expect(html).not.toContain("border:1px solid");
  });
});

describe("PageFigure", () => {
  it("is 20/500 at -0.015em, and 32/500 at -0.02em in the room", () => {
    expect(markup(<PageFigure figure="1,284" />)).toContain("font-size:20px;font-weight:500;letter-spacing:-0.015em;line-height:1.2");
    expect(markup(<PageFigure figure="1,284" size="room" />)).toContain("font-size:32px;font-weight:500;letter-spacing:-0.02em;line-height:1.1");
  });

  it("builds the meta line from parts, toned by meaning with tokens", () => {
    const html = markup(
      <PageFigure
        figure="12"
        parts={[{ text: "9 worked", tone: "evidence" }, { text: "2 failed", tone: "breakage" }, { text: "1 not tested", tone: "lit" }, { text: "plain" }]}
      />,
    );
    expect(html).toContain("font-size:13px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("color:var(--evidence)");
    expect(html).toContain("color:var(--breakage-ink)");
    expect(html).toContain("color:var(--lit-ink)");
    expect(html).toContain("font-variant-numeric:tabular-nums");
  });
});

describe("PlainRow", () => {
  it("puts the label left and the value right, padded 12px 16px, with no lines", () => {
    const first = markup(<PlainRow label="Steps" value="12" height={48} />);
    expect(first).toContain("min-height:48px");
    expect(first).toContain("padding:12px 16px");
    expect(first).not.toContain("border-bottom");
    expect(markup(<PlainRow label="Steps" value="12" last />)).not.toContain("border-bottom");
    expect(first.indexOf(">Steps<")).toBeLessThan(first.indexOf(">12<"));
  });
});

describe("TypeChip", () => {
  it("is a pill 24 tall, 0 10px, radius 12, 13/500 on Card", () => {
    const html = markup(<TypeChip>Step</TypeChip>);
    expect(html).toContain("height:24px");
    expect(html).toContain("padding:0 10px");
    expect(html).toContain("border-radius:var(--r-chip)");
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("font-size:13px;font-weight:500");
    expect(html).not.toContain("text-transform:uppercase");
  });
});

describe("ActiveFilterChip", () => {
  it("names its remove button for the filter and calls back", () => {
    const onRemove = vi.fn();
    render(<ActiveFilterChip name="Model" value="Sonnet 5.5" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Model" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("is a pill 32 tall, radius 16, on Card, with the key in --text2 and the value in --text", () => {
    const html = markup(<ActiveFilterChip name="Model" value="Sonnet 5.5" onRemove={() => {}} />);
    expect(html).toContain("height:32px");
    expect(html).toContain("border-radius:16px");
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("color:var(--text)");
  });
});

describe("TextTabs", () => {
  it("is 53 tall on a phone as well, so the touch floor is met", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    render(<TextTabs tabs={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} value="a" onChange={() => {}} label="Phone tabs" height={32} />);
    for (const tab of screen.getAllByRole("tab")) expect(tab.style.height).toBe("53px");
    vi.unstubAllGlobals();
  });

  const tabs = [
    { value: "a", label: "Table" },
    { value: "b", label: "Maps", count: 4 },
    { value: "c", label: "Classification" },
  ];

  it("is a named tablist with the chosen tab selected and the only tab stop", () => {
    render(<TextTabs tabs={tabs} value="b" onChange={() => {}} label="Builds view" />);
    expect(screen.getByRole("tablist", { name: "Builds view" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Maps 4" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Maps 4" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Table" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves with the arrows, Home and End, wrapping", () => {
    const onChange = vi.fn();
    render(<TextTabs tabs={tabs} value="c" onChange={onChange} label="Builds view" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Classification" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Classification" }), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Classification" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Classification" }), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("is 53 tall, 15/500 in --label, the chosen tab 15/700 in --text with a 4px Mint bar 56 wide, and no line", () => {
    const html = markup(<TextTabs tabs={tabs} value="a" onChange={() => {}} label="Builds view" />);
    expect(html).toContain("height:53px");
    expect(html).toContain("font-size:15px;font-weight:700");
    expect(html).toContain("width:56px;height:4px");
    expect(html).toContain("background:var(--tab-bar)");
    expect(html).toContain("color:var(--label)");
    expect(html).not.toContain("border-bottom");
  });
});

describe("InnerTile and DashedSlot", () => {
  it("InnerTile is --module with no border, radius 12, padded 12px 14px, 4px between lines", () => {
    const html = markup(<InnerTile>x</InnerTile>);
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("border:0");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("padding:12px 14px");
    expect(html).toContain("gap:4px");
  });

  it("DashedSlot is a 1px dashed --label edge, radius 6, or 8 when page-wide", () => {
    expect(markup(<DashedSlot>x</DashedSlot>)).toContain("border:1px dashed var(--label)");
    expect(markup(<DashedSlot>x</DashedSlot>)).toContain("border-radius:var(--r-control)");
    expect(markup(<DashedSlot wide>x</DashedSlot>)).toContain("border-radius:var(--r-card)");
  });
});
