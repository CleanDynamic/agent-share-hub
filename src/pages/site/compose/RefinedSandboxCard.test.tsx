// UI-P94 — the Card sheet in the refined look, rendered with the dev fixture: the same fields, ids and names as
// `SandboxCard`, then what `refined/{dusk,noon}/composer-card.html` draws.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { RefinedSandboxCard } from "./RefinedSandboxCard";
import { CARD_FIELD_ID, type CardField, type SandboxCardProps } from "./SandboxCard";

/* The server render has no portal to draw into, so the sheet is drawn in place there; jsdom drops `var()` and `min()`
   from inline styles, so the look is read from that markup. */
vi.mock("@radix-ui/react-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@radix-ui/react-dialog")>()),
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

function card(over: Partial<SandboxCardProps> = {}, field: CardField | null = null) {
  const props: SandboxCardProps = {
    ...sandboxViewProps("bakery"),
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onAudience: vi.fn(),
    onDetail: vi.fn(),
    onGapSwitch: vi.fn(),
    onToggleMadeWith: vi.fn(),
    onAddMadeWith: vi.fn(),
    open: true,
    onOpenChange: vi.fn(),
    field,
    phone: false,
    ...over,
  };
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?look=refined"]}>
      <RefinedSandboxCard {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("the Card's fields (as SandboxCard)", () => {
  it("has the cover, the three fields, Made with and More details, under the title Card", () => {
    card();
    const sheet = screen.getByTestId("sandbox-card");
    expect(within(sheet).getByRole("heading", { name: "Card" })).toBeTruthy();
    expect(within(sheet).getByRole("region", { name: "Cover" }).id).toBe(CARD_FIELD_ID.cover);
    for (const label of ["Title", "One-line summary", "Who it's for"]) expect(within(sheet).getByLabelText(label)).toBeTruthy();
    expect(within(sheet).getByTestId("compose-dropzone")).toBeTruthy();
    expect(within(sheet).getByTestId("compose-made-with").textContent).toContain("Made with");
    expect(within(sheet).getByRole("button", { name: /More details/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("lands on the field a missing item names", () => {
    card({}, "summary");
    expect(document.activeElement).toBe(screen.getByLabelText("One-line summary"));
  });

  it("writes through the same handlers, and opens More details in place", () => {
    const props = card();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Plum & Rye" } });
    expect(props.onTitle).toHaveBeenCalledWith("Plum & Rye");
    fireEvent.change(screen.getByLabelText("Who it's for"), { target: { value: "bakers" } });
    expect(props.onAudience).toHaveBeenCalledWith("bakers");
    fireEvent.click(screen.getByRole("button", { name: /More details/ }));
    expect(screen.getByLabelText("What broke")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What broke"), { target: { value: "the grid" } });
    expect(props.onDetail).toHaveBeenCalledWith("symptom", "the grid");
  });

  it("closes from Close", () => {
    const props = card();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});

const markup = () =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?look=refined"]}>
      <RefinedSandboxCard
        {...sandboxViewProps("bakery")}
        onTitle={() => undefined}
        onDescription={() => undefined}
        onAudience={() => undefined}
        onDetail={() => undefined}
        onGapSwitch={() => undefined}
        onToggleMadeWith={() => undefined}
        onAddMadeWith={() => undefined}
        open
        onOpenChange={() => undefined}
        field={null}
        phone={false}
      />
    </MemoryRouter>,
  );

describe("the refined look (UI-P94)", () => {
  it("is a side sheet 472 wide, inset 6, radius 12, the window recipe with the sheet shadow, over the scrim", () => {
    const html = markup();
    expect(html).toMatch(/data-testid="sandbox-card"[^>]*style="position:fixed;top:6px;right:6px;bottom:6px;z-index:51;width:min\(472px, calc\(100% - 12px\)\)[^"]*border-radius:12px;background:var\(--window\);border:1px solid var\(--window-border\);box-shadow:var\(--sheet-shadow\)/);
    expect(html).toContain("background:var(--scrim)");
    expect(html).toContain("height:56px;flex-shrink:0;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 16px 0 24px;border-bottom:1px solid var(--hairline-module)");
  });

  it("draws the drop zone 216 high on the tile with the dot grid and a dashed line, and the fields as wells 36 high (the summary 80)", () => {
    const html = markup();
    expect(html).toMatch(/data-testid="compose-dropzone" style="height:216px;box-sizing:border-box;border-radius:8px;border:1px dashed var\(--line\);background:radial-gradient\(var\(--dot-grid\) 1px, transparent 1px\) 0 0 \/ 16px 16px, var\(--tile\)/);
    expect(html).toMatch(/id="card-title"[^>]*style="background:var\(--well\);border:1px solid var\(--well-border\);box-shadow:var\(--well-shadow\);border-radius:6px;box-sizing:border-box;width:100%;outline:none;height:36px/);
    expect(html).toMatch(/id="card-summary"[^>]*style="[^"]*height:80px/);
  });

  it("names what it was made with as model tags, and leads More details with the chev glyph", () => {
    const html = markup();
    expect(html).toContain("background:var(--tag-fill)");
    expect(html).toContain('d="M6.5 4 10.5 8l-4 4"');
    expect(html).toContain("(optional)");
  });
});
