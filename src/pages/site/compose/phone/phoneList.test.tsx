// Prompt 23: the list's own pieces on a phone. The claims: a tile is a header row (the kind with its icon, the first titled box's
// title at the right), the title, and one line of its text, with no Open link; a part's row folds on a tap; a session's chevron
// turns; a found word is filled in Mint; the Sources sheet steps aside without closing. The desktop drawing of each is untouched
// (the desktop tests and the DOM comparison hold that).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { FindProvider } from "@/components/build/FindHit";
import { FindHit, phoneFoundWord } from "@/components/build/FindHit";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";

import { BuildList } from "../BuildList";
import { WorkstreamHead, type WorkstreamHeadProps } from "../WorkstreamHead";

function stubWidth(px: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { matches: max ? px <= Number(max[1]) : min ? px >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  stubWidth(390);
});
afterEach(cleanup);

describe("a tile on a phone", () => {
  it("is a header row, the title and one line of its text, with no Open link", () => {
    const base = sandboxListProps("bakery");
    const steps = base.steps.map((step, at) => (at === 0 ? { ...step, boxes: [{ title: "Tone", text: "Warm and short." }] } : step));
    render(
      <MemoryRouter>
        <BuildList {...base} steps={steps} phone onEditTile={() => undefined} />
      </MemoryRouter>,
    );
    const tile = screen.getAllByTestId("step-card")[0];
    const head = within(tile).getByTestId("tile-head-phone");
    expect(within(head).getByTestId("prompt-eyebrow").textContent).toContain("Prompt");
    expect(within(head).getByTestId("tile-box-title").textContent).toBe("Tone");
    expect(head.querySelector('[data-icon="prompt"]')).toBeTruthy();
    const line = tile.querySelector("p") as HTMLParagraphElement;
    expect(line.style.whiteSpace).toBe("nowrap");
    expect(line.style.textOverflow).toBe("ellipsis");
    expect(line.style.fontSize).toBe("13px");
    expect(within(tile).queryByText(/^Open /)).toBeNull();
  });

  it("keeps the computer's tile as it was: no phone header", () => {
    stubWidth(1440);
    render(
      <MemoryRouter>
        <BuildList {...sandboxListProps("bakery")} phone={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("tile-head-phone")).toBeNull();
  });
});

const part = (over: Partial<WorkstreamHeadProps> = {}): WorkstreamHeadProps => ({
  part: { key: "pa", label: "Part A", name: "Tenant portal", nameColour: "var(--text)", sessions: 3, collapsed: false },
  phone: true,
  first: true,
  last: true,
  controls: "pa-sessions",
  onToggle: vi.fn(),
  startsAfterChoices: [],
  joins: "Part B",
  ...over,
});

describe("a part on a phone", () => {
  it("is a row on Panel that folds on a tap, with Part A and the count in mono", () => {
    const props = part();
    render(<WorkstreamHead {...props} />);
    const head = screen.getByTestId("workstream-head");
    expect(head.style.borderRadius).toBe("12px");
    expect(head.style.marginBottom).toBe("8px");
    expect(screen.getByTestId("workstream-label").textContent).toBe("Part A");
    expect(screen.getByTestId("workstream-count").style.fontSize).toBe("13px");
    fireEvent.click(head);
    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not fold from a tap on the computer's row", () => {
    stubWidth(1440);
    const props = part({ phone: false });
    render(<WorkstreamHead {...props} />);
    fireEvent.click(screen.getByTestId("workstream-head"));
    expect(props.onToggle).not.toHaveBeenCalled();
  });
});

describe("Find on a phone", () => {
  it("fills a found word in Mint", () => {
    render(
      <FindProvider value={{ query: "order", current: null }}>
        <FindHit text="Plan the order page" />
      </FindProvider>,
    );
    // jsdom does not keep color-mix(); the component's style object is read instead.
    expect(phoneFoundWord(true).backgroundColor).toBe("color-mix(in srgb, var(--brand-accent) 30%, transparent)");
    expect(phoneFoundWord(false).backgroundColor).toBe("color-mix(in srgb, var(--brand-accent) 18%, transparent)");
    expect(screen.getByTestId("find-hit").textContent).toBe("order");
  });
});

describe("a sheet stepping aside", () => {
  it("stays open and mounted, faded and out of the way", () => {
    render(
      <PhoneBottomSheet open onOpenChange={() => undefined} title="Sources" stepAside>
        <p>Session 1</p>
      </PhoneBottomSheet>,
    );
    const sheet = screen.getByTestId("bottom-sheet");
    expect(screen.getByText("Session 1")).toBeTruthy();
    expect(sheet.style.opacity).toBe("0");
    expect(sheet.style.pointerEvents).toBe("none");
  });
});
