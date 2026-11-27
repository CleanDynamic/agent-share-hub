import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Avatar, avatarTint } from "@/components/brand/Avatar";
import { showsCreateButton } from "@/components/shell/siteNav";
import { avatarTints } from "@/lib/theme/tokens";

import { CreateButton } from "./CreateButton";
import { PhoneBottomSheet } from "./BottomSheet";
import { PhonePills } from "./PhonePills";
import { PhoneTabs } from "./PhoneTabs";

// jsdom has no PointerEvent.
class TestPointerEvent extends MouseEvent {}
vi.stubGlobal("PointerEvent", TestPointerEvent);

/** The markup as written, `prop:value;` with no spaces: jsdom drops `var()` and `calc(env())` from parsed styles. */
const markup = (node: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>).replace(/: /g, ":");

describe("the round create button", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is a named 56 Mint circle with a 24 plus at stroke 2.4, 16 from the right and 16 above the dock", () => {
    render(<CreateButton onTap={vi.fn()} onHold={vi.fn()} />);
    const fab = screen.getByRole("button", { name: "New" });
    expect(fab.getAttribute("aria-haspopup")).toBe("dialog");
    const html = markup(<CreateButton onTap={vi.fn()} onHold={vi.fn()} />);
    expect(html).toContain("width:56px;height:56px");
    expect(html).toContain("right:16px");
    expect(html).toContain("bottom:calc(49px + env(safe-area-inset-bottom) + 16px)");
    expect(html).toContain("background:var(--brand-accent);color:var(--bg)");
    expect(html).toContain("box-shadow:0 6px 18px rgba(0,0,0,.45)");
    const icon = fab.querySelector("svg");
    expect(icon?.getAttribute("width")).toBe("24");
    expect(icon?.getAttribute("stroke-width")).toBe("2.4");
  });

  it("a tap opens the sheet and does not start a build", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    render(<CreateButton onTap={onTap} onHold={onHold} />);
    const fab = screen.getByRole("button", { name: "New" });
    fireEvent.pointerDown(fab);
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.pointerUp(fab);
    fireEvent.click(fab);
    act(() => void vi.advanceTimersByTime(1000));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onHold).not.toHaveBeenCalled();
  });

  it("a press held for 500ms opens a new build and the click that follows does not also open the sheet", () => {
    const onTap = vi.fn();
    const onHold = vi.fn();
    render(<CreateButton onTap={onTap} onHold={onHold} />);
    const fab = screen.getByRole("button", { name: "New" });
    fireEvent.pointerDown(fab);
    act(() => void vi.advanceTimersByTime(499));
    expect(onHold).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(fab);
    fireEvent.click(fab);
    expect(onTap).not.toHaveBeenCalled();
    // The next plain tap works again.
    fireEvent.click(fab);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("leaving the button before 500ms cancels the hold", () => {
    const onHold = vi.fn();
    render(<CreateButton onTap={vi.fn()} onHold={onHold} />);
    const fab = screen.getByRole("button", { name: "New" });
    fireEvent.pointerDown(fab);
    fireEvent.pointerLeave(fab);
    act(() => void vi.advanceTimersByTime(1000));
    expect(onHold).not.toHaveBeenCalled();
  });
});

describe("where the create button is drawn", () => {
  it("on Home, Builds, OpenBuilds and Activity", () => {
    for (const path of ["/", "/builds", "/gallery", "/openbuilds", "/notifications"]) expect(showsCreateButton(path), path).toBe(true);
  });

  it("not on pushed pages, the editor, Import, settings, Library, Drafts or sign-in", () => {
    for (const path of ["/b2/bakery", "/openbuilds/spaces/web", "/openbuilds/topics/t1", "/compose/new", "/rebuild/x", "/import", "/settings", "/library", "/drafts", "/connect", "/profile/kit", "/messages"]) {
      expect(showsCreateButton(path), path).toBe(false);
    }
  });
});

describe("a phone avatar without a picture", () => {
  it("sits on one of the six tints, the same one for the same person, with mono initials at 62% white", () => {
    expect(avatarTints).toHaveLength(6);
    expect(avatarTint("user-1")).toBe(avatarTint("user-1"));
    expect(avatarTints).toContain(avatarTint("user-2"));
    const sizes: [number, string, string][] = [[32, "12px", "8px"], [40, "13px", "9px"], [48, "15px", "11px"]];
    for (const [size, font, radius] of sizes) {
      const { container, unmount } = render(<Avatar phone size={size} userId="user-1" name="Sun Tzu" />);
      const el = container.querySelector('[data-ui="avatar"]') as HTMLElement;
      expect(el.textContent).toBe("ST");
      expect(el.style.fontSize).toBe(font);
      expect(el.style.borderRadius).toBe(radius);
      expect(el.style.fontWeight).toBe("600");
      expect(avatarTints).toContain(markup(<Avatar phone size={size} userId="user-1" name="Sun Tzu" />).match(/background:(#[0-9A-Fa-f]{6})/)?.[1] as never);
      unmount();
    }
  });

  it("desktop keeps its own look", () => {
    const { container } = render(<Avatar size={40} userId="user-1" name="Sun Tzu" />);
    expect((container.querySelector('[data-ui="avatar"]') as HTMLElement).style.fontWeight).toBe("400");
  });
});

describe("Home's centred tabs", () => {
  const tabs = [
    { value: "following", label: "Following" },
    { value: "everyone", label: "Everyone" },
  ];

  it("a centred pair, 24 apart, the current tab 700 in Text and the other 500 in Text 3, the word marked for the indicator", () => {
    render(<PhoneTabs centred label="Feed scope" tabs={tabs} value="everyone" onChange={vi.fn()} />);
    const list = screen.getByRole("tablist", { name: "Feed scope" });
    expect(list.getAttribute("style")).toContain("justify-content: center");
    expect(list.getAttribute("style")).toContain("gap: 24px");
    const [a, b] = screen.getAllByRole("tab");
    expect(a.getAttribute("style")).toContain("padding: 0px 16px");
    expect(a.getAttribute("style")).toContain("font-weight: 500");
    expect(b.getAttribute("style")).toContain("font-weight: 700");
    expect(b.querySelector("[data-tab-word]")?.textContent).toBe("Everyone");
    // The old per-tab Mint bar is not drawn; the one indicator is separate.
    expect(screen.queryByTestId("phone-tab-bar")).toBeNull();
  });

  it("the indicator is 3 tall, radius 2, in Text, and slides by transform over 160ms", () => {
    const rect = (left: number, width: number) => ({ left, width, top: 0, right: left + width, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-tab-word") ? rect(120, 64) : rect(0, 390);
    });
    render(<PhoneTabs centred label="Feed scope" tabs={tabs} value="everyone" onChange={vi.fn()} />);
    const bar = screen.getByTestId("phone-tab-indicator");
    const style = bar.getAttribute("style") ?? "";
    expect(style).toContain("height: 3px");
    expect(style).toContain("border-radius: 2px");
    expect(style).toContain("width: 64px");
    expect(style).toContain("translateX(120px)");
    expect(style).toContain("transform 160ms cubic-bezier(.2,.8,.2,1)");
    // Text, not Mint: jsdom drops var(), so read the markup.
    const html = markup(<PhoneTabs centred label="Feed scope" tabs={tabs} value="everyone" onChange={vi.fn()} />);
    expect(html).not.toContain("var(--brand-accent)");
    spy.mockRestore();
  });
});

describe("pill rows", () => {
  it("32 tall pills, 14 across, radius 16, 14/20 500; off is Card with Text 2, on is Text with Page", () => {
    render(
      <MemoryRouter>
        <PhonePills label="Show" pills={[{ value: "a", label: "All" }, { value: "b", label: "Rebuilt" }]} value="a" onChange={vi.fn()} />
      </MemoryRouter>,
    );
    const on = screen.getByRole("button", { name: "All" });
    const off = screen.getByRole("button", { name: "Rebuilt" });
    for (const pill of [on, off]) {
      const s = pill.getAttribute("style") ?? "";
      expect(s).toContain("height: 32px");
      expect(s).toContain("padding: 0px 14px");
      expect(s).toContain("border-radius: 16px");
      expect(s).toContain("font-size: 13px");
      expect(s).toContain("line-height: 16px");
      expect(s).toContain("font-weight: 500");
    }
    const html = markup(<PhonePills label="Show" pills={[{ value: "a", label: "All" }, { value: "b", label: "Rebuilt" }]} value="a" onChange={vi.fn()} />);
    expect(html).toMatch(/background:var\(--text\);color:var\(--bg\)[^>]*>All/);
    expect(html).toMatch(/background:var\(--module\);color:var\(--text2\)[^>]*>Rebuilt/);
    const row = screen.getByRole("group", { name: "Show" });
    expect(row.getAttribute("style")).toContain("gap: 8px");
    expect(row.getAttribute("style")).toContain("padding: 10px 16px");
  });
});

describe("the New sheet's shade", () => {
  it("the menu tone is Panel with a radius of 20 at the top, a 36 by 5 Raised grabber and no header", () => {
    render(
      <PhoneBottomSheet open onOpenChange={vi.fn()} title="New" hideTitle tone="menu">
        <p>rows</p>
      </PhoneBottomSheet>,
    );
    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.getAttribute("data-fill")).toBe("menu");
    expect(sheet.style.borderRadius).toMatch(/^20px 20px (0px|0) (0px|0)$/);
    expect(screen.queryByTestId("sheet-header")).toBeNull();
    expect(screen.queryByRole("button", { name: /Close/ })).toBeNull();
    expect(screen.getByRole("dialog", { name: "New" })).toBeTruthy();
    const grabber = screen.getByTestId("sheet-grabber").firstElementChild as HTMLElement;
    expect(grabber.style.width).toBe("36px");
    expect(grabber.style.height).toBe("5px");
  });
});
