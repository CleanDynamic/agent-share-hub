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
  it("draws the title 14/500 and the meta 12 in --label, 2px below", () => {
    const html = markup(<SectionHead title="Recent builds" meta="Last 30 days" />);
    expect(html).toContain("font-size:14px;font-weight:500;line-height:1.3;color:var(--text)");
    expect(html).toContain("margin-top:2px;font-size:12px;font-weight:400");
    expect(html).toContain("color:var(--label)");
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

  it("draws no chevron without a page, and the chevron is the control recipe at 28", () => {
    expect(markup(<SectionHead title="Notes" />)).not.toContain("Open ");
    const html = markup(<SectionHead title="Notes" to="/x" />);
    expect(html).toContain("width:28px;height:28px");
    expect(html).toContain("background:var(--control)");
    expect(html).toContain("border:1px solid var(--control-border)");
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
    expect(html).toContain("color:var(--cat-breakage)");
    expect(html).toContain("color:var(--lit)");
    expect(html).toContain("font-variant-numeric:tabular-nums");
  });
});

describe("PlainRow", () => {
  it("puts the label left and the value right, with a hairline under all but the last", () => {
    const first = markup(<PlainRow label="Steps" value="12" height={48} />);
    expect(first).toContain("min-height:48px");
    expect(first).toContain("border-bottom:1px solid var(--hairline)");
    expect(markup(<PlainRow label="Steps" value="12" last />)).toContain("border-bottom:none");
    expect(first.indexOf(">Steps<")).toBeLessThan(first.indexOf(">12<"));
  });
});

describe("TypeChip", () => {
  it("is Geist Mono 10.5 over 18, 0 6px, radius 4, --control fill, --text2 text", () => {
    const html = markup(<TypeChip>Step</TypeChip>);
    expect(html).toContain("padding:0 6px");
    expect(html).toContain("border-radius:var(--r-chip)");
    expect(html).toContain("background:var(--control)");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("font-size:10.5px");
    expect(html).toContain("line-height:18px");
    expect(html).toContain("text-transform:uppercase");
  });
});

describe("ActiveFilterChip", () => {
  it("names its remove button for the filter and calls back", () => {
    const onRemove = vi.fn();
    render(<ActiveFilterChip name="Model" value="Sonnet 5.5" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Model" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("is the control recipe at 26 high, the key in --label and the value in --text", () => {
    const html = markup(<ActiveFilterChip name="Model" value="Sonnet 5.5" onRemove={() => {}} />);
    expect(html).toContain("height:26px");
    expect(html).toContain("background:var(--control)");
    expect(html).toContain("color:var(--label)");
    expect(html).toContain("color:var(--text)");
  });
});

describe("TextTabs", () => {
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

  it("is 36 high, 20 apart, with a 1px --text underline on the chosen tab over a hairline", () => {
    const html = markup(<TextTabs tabs={tabs} value="a" onChange={() => {}} label="Builds view" />);
    expect(html).toContain("height:36px");
    expect(html).toContain("gap:20px");
    expect(html).toContain("border-bottom:1px solid var(--text)");
    expect(html).toContain("border-bottom:1px solid var(--hairline)");
    expect(html).toContain("color:var(--text2)");
  });
});

describe("InnerTile and DashedSlot", () => {
  it("InnerTile is --module over --module-border, radius 8, padded 14px 16px", () => {
    const html = markup(<InnerTile>x</InnerTile>);
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("border:1px solid var(--module-border)");
    expect(html).toContain("border-radius:var(--r-card)");
    expect(html).toContain("padding:14px 16px");
  });

  it("DashedSlot is a 1px dashed --label edge, radius 6, or 8 when page-wide", () => {
    expect(markup(<DashedSlot>x</DashedSlot>)).toContain("border:1px dashed var(--label)");
    expect(markup(<DashedSlot>x</DashedSlot>)).toContain("border-radius:var(--r-control)");
    expect(markup(<DashedSlot wide>x</DashedSlot>)).toContain("border-radius:var(--r-card)");
  });
});
