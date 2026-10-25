// CA-26 P1: the skip link, the tab order, and the build list as one Tab stop.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFrameView } from "@/components/shell/SiteFrame";
import { sandboxListProps, sandboxViewProps } from "@/dev/fixtures/sandbox";

import { BuildList } from "./BuildList";
import { ROVING_ITEM } from "@/lib/focus/buildItems";
import { SkipToBuild, currentBuildItem } from "./buildFocus";
import { done, mountList, partsOf, stubMedia } from "./ca21Harness";
import { SandboxView, type SandboxViewProps } from "./SandboxView";

const items = () => [...document.querySelectorAll<HTMLElement>(`[data-testid="build-list"] :is(${ROVING_ITEM})`)];
/** What Tab can reach inside the list: the list's items and anything a tile holds that has not been taken out of the order. */
const stops = () =>
  [...document.querySelectorAll<HTMLElement>('[data-testid="build-list"] :is(button, a[href], input, select, textarea, [tabindex])')].filter(
    (el) => el.getAttribute("tabindex") !== "-1" && !el.hasAttribute("disabled") && el.closest("[data-roving-skip]") === null && el.closest(ROVING_ITEM) !== null,
  );

beforeEach(stubMedia);
afterEach(done);

describe("the build list is one Tab stop", () => {
  it("one item holds tabindex 0 and every control inside an item is out of the Tab order", () => {
    mountList({ parts: partsOf() });
    const all = items();
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((el) => el.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(stops()).toHaveLength(1);
  });

  it("Tab enters at the first item, then at the last one that had focus", () => {
    mountList({ parts: partsOf() });
    expect(currentBuildItem()).toBe(items()[0]);
    const third = items()[3];
    act(() => third.focus());
    expect(currentBuildItem()).toBe(third);
    expect(third.getAttribute("tabindex")).toBe("0");
    expect(items()[0].getAttribute("tabindex")).toBe("-1");
    expect(stops()).toHaveLength(1);
  });

  it("the arrows, Home and End move focus within the list", () => {
    mountList({ parts: partsOf() });
    const all = items();
    act(() => all[0].focus());
    fireEvent.keyDown(all[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(all[2]);
    fireEvent.keyDown(all[2], { key: "ArrowUp" });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1], { key: "End" });
    expect(document.activeElement).toBe(all.at(-1));
    fireEvent.keyDown(all.at(-1) as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(all[0]);
    expect(stops()).toHaveLength(1);
  });

  it("Right goes into an item's own controls and Left comes back", () => {
    mountList({ parts: partsOf() });
    const tile = items().find((el) => el.dataset.testid === "step-card") as HTMLElement;
    act(() => tile.focus());
    fireEvent.keyDown(tile, { key: "ArrowRight" });
    const inside = document.activeElement as HTMLElement;
    expect(inside).not.toBe(tile);
    expect(tile.contains(inside)).toBe(true);
    fireEvent.keyDown(inside, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tile);
  });

  it("the focused item shows the focus ring, and loses it on blur", () => {
    mountList({ parts: partsOf() });
    const tile = items().find((el) => el.dataset.testid === "step-card") as HTMLElement;
    act(() => tile.focus());
    expect(tile.style.outlineStyle).toBe("solid");
    expect(tile.style.outlineWidth).toBe("2px");
    expect(tile.style.outlineOffset).toBe("2px");
    act(() => tile.blur());
    expect(tile.style.outlineStyle).toBe("");
  });

  it("a focused item is scrolled into view", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mountList({ parts: partsOf() });
    act(() => items()[2].focus());
    expect(scroll).toHaveBeenCalled();
  });
});

describe("the skip link", () => {
  it("is the first focusable element in the frame, hidden until focused, and named Skip to build", () => {
    render(
      <MemoryRouter>
        <SiteFrameView skipLink={<SkipToBuild />} header={<button>Header</button>}>
          <button>Page</button>
        </SiteFrameView>
      </MemoryRouter>,
    );
    const first = document.querySelector<HTMLElement>('a[href], button, [tabindex="0"]');
    const link = screen.getByRole("link", { name: "Skip to build" });
    expect(first).toBe(link);
    expect(link.style.width).toBe("1px");
    act(() => link.focus());
    expect(link.style.height).toBe("32px");
    expect(link.style.padding).toBe("0px 12px");
    expect(link.style.borderRadius).toBe("8px");
    expect(link.style.outlineStyle).toBe("solid");
    act(() => link.blur());
    expect(link.style.width).toBe("1px");
  });

  it("Enter moves focus to the build list's current item", () => {
    render(
      <MemoryRouter>
        <SkipToBuild />
      </MemoryRouter>,
    );
    mountList({ parts: partsOf() });
    const third = items()[3];
    act(() => third.focus());
    act(() => screen.getByRole("link", { name: "Skip to build" }).focus());
    fireEvent.click(screen.getByRole("link", { name: "Skip to build" }));
    expect(document.activeElement).toBe(third);
  });

  it("falls to the first item when the list has not been focused", () => {
    render(<SkipToBuild />);
    mountList({ parts: partsOf() });
    fireEvent.click(screen.getByRole("link", { name: "Skip to build" }));
    expect(document.activeElement).toBe(items()[0]);
  });
});

describe("the page's tab order", () => {
  it("is Sources, the post, the build list, then Details", () => {
    vi.stubGlobal("matchMedia", (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      const max = /max-width:\s*(\d+)px/.exec(query);
      return { matches: min ? 1440 >= Number(min[1]) : max ? 1440 <= Number(max[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
    const props = { ...sandboxViewProps("bakery"), onPublish: vi.fn(), list: <BuildList {...sandboxListProps("bakery")} />, post: <p contentEditable suppressContentEditableWarning>the post body</p> } as SandboxViewProps;
    render(
      <MemoryRouter>
        <SandboxView {...props} />
      </MemoryRouter>,
    );
    const at = (id: string) => screen.getByTestId(id);
    const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const sources = at("sandbox-sources-slot");
    const post = at("sandbox-post");
    const list = at("build-list");
    expect(before(sources, post)).toBe(true);
    expect(before(post, list)).toBe(true);
    const details = document.querySelector<HTMLElement>('[data-testid="sandbox-details-slot"]');
    if (details) expect(before(list, details)).toBe(true);
    cleanup();
  });
});
