// UI-P94 — the Card in the refined look, rendered with the dev fixture: the same dialog, fields, ids, focus and names
// as `SandboxCard`, drawn as a side sheet with the window recipe, the cover's drop zone, well fields, Made with as
// `ModelTag`s and More details as a disclosure.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { SandboxCard } from "./SandboxCard";
import { CARD_FIELD_ID, type SandboxCardProps } from "./SandboxCard";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mount(over: Partial<SandboxCardProps> = {}) {
  const props: SandboxCardProps = {
    ...sandboxViewProps("bakery"),
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onFiles: vi.fn(),
    open: true,
    onOpenChange: vi.fn(),
    field: null,
    phone: false,
    ...over,
  };
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <SandboxCard {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("SandboxCard: what SandboxCard does", () => {
  it("is a dialog named Card with the cover, the three fields and Made with, and nothing when closed", () => {
    mount();
    const card = screen.getByRole("dialog", { name: "Card" });
    expect(within(card).getByRole("region", { name: "Cover" })).toBeTruthy();
    for (const label of ["Title", "One-line summary", "Who it's for"]) expect(within(card).getByLabelText(label)).toBeTruthy();
    expect(within(card).getByTestId("compose-made-with")).toBeTruthy();
    expect((within(card).getByLabelText("Title") as HTMLInputElement).value).toBe("Bakery homepage");
    cleanup();
    mount({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lands on the field a missing item names", () => {
    mount({ field: "summary" });
    expect(document.activeElement?.id).toBe(CARD_FIELD_ID.summary);
  });

  it("writes the title and the summary, and counts the summary", () => {
    const props = mount();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Bakery" } });
    expect(props.onTitle).toHaveBeenCalledWith("Bakery");
    fireEvent.change(screen.getByLabelText("One-line summary"), { target: { value: "Bread" } });
    expect(props.onDescription).toHaveBeenCalledWith("Bread");
    expect(screen.getByText(`${props.description.length} / 200`)).toBeTruthy();
  });

  it("takes dropped files, and closes from Close", () => {
    const props = mount();
    const file = new File(["x"], "cover.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("compose-dropzone"), { dataTransfer: { types: ["Files"], files: [file] } });
    expect(props.onFiles).toHaveBeenCalledWith([file]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens More details (optional)", () => {
    mount();
    const more = screen.getByRole("button", { name: /More details/ });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("What broke")).toBeTruthy();
  });
});

describe("SandboxCard: the board", () => {
  it("is a side sheet 472 wide, inset 6, radius 12, the window recipe with the sheet shadow", () => {
    mount();
    const sheet = screen.getByTestId("sandbox-card");
    // jsdom drops a shorthand that carries var(), so the fills are read in the browser (audit:design).
    expect(sheet.style.width).toBe("472px");
    expect([sheet.style.top, sheet.style.right, sheet.style.bottom]).toEqual(["6px", "6px", "6px"]);
    expect(sheet.style.borderRadius).toBe("12px");
    expect(sheet.style.boxShadow).toBe("var(--sheet-shadow)");
    const title = screen.getByRole("heading", { name: "Card" });
    expect(title.style.fontSize).toBe("15px");
    expect(title.style.fontWeight).toBe("500");
  });

  it("draws the drop zone 216 high in the tile's fill, dashed, with the image glyph and the underlined browse link", () => {
    mount();
    const zone = screen.getByTestId("compose-dropzone");
    expect(zone.style.height).toBe("216px");
    expect(zone.style.borderRadius).toBe("8px");
    expect(zone.style.backgroundSize).toBe("16px 16px");
    expect(within(zone).getByText("Drop a screenshot or a short video").style.fontSize).toBe("13px");
    expect(within(zone).getByRole("button", { name: "or browse your files" }).style.textDecoration).toBe("underline");
    expect(zone.querySelector("svg")).not.toBeNull();
  });

  it("puts the fields in wells 36 high under 12.5/500 labels, the summary 80 high", () => {
    mount();
    const title = screen.getByLabelText("Title");
    expect(title.style.height).toBe("36px");
    expect(title.style.boxShadow).toBe("var(--well-shadow)");
    expect(screen.getByText("Title").style.fontSize).toBe("12.5px");
    expect(screen.getByLabelText("One-line summary").style.height).toBe("80px");
    expect(screen.getByText("Separate with commas").style.fontSize).toBe("12px");
  });

  it("names Made with in ModelTags with the real marks, and More details with a chevron", () => {
    mount();
    const chips = screen.getAllByTestId("made-with-chip");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Claude Code · Sonnet 5.5", "Claude · Opus 5.5"]);
    for (const chip of chips) expect(chip.querySelector("[data-mark]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /More details/ }).querySelector("svg")).not.toBeNull();
  });
});
