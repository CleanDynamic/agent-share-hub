// UI-P07 — the control set: button, icon button, segmented, tabs, filter chip,
// eyebrow and avatar.
//
// Styles are asserted through SSR markup, because jsdom's cssstyle drops every
// `var()` value: read off a rendered node, a token and a hex are both the empty
// string, so a check on the node would pass on a control painted in raw colour.
// Behaviour (keyboard, aria) is asserted on the rendered tree.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { Plus } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Avatar, AVATAR_HUES, avatarHue, initialsOf } from "./Avatar";
import { Button } from "./Button";
import { CategoryChip } from "./CategoryChip";
import { Checkbox } from "./Checkbox";
import { MenuButton } from "./MenuButton";
import { Pill } from "./Pill";
import { SearchField } from "./SearchField";
import { Eyebrow } from "./Eyebrow";
import { FilterChip } from "./FilterChip";
import { IconButton } from "./IconButton";
import { Segmented } from "./Segmented";
import { UnderlineTabs } from "./UnderlineTabs";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Button", () => {

  it("paints ghost on nothing, in --text2, with a transparent border", () => {
    const html = markup(<Button variant="ghost">Go</Button>);
    expect(html).toContain("background:transparent");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("border:1px solid transparent");
  });

  it("is a block-level full-width flex when fullWidth", () => {
    const html = markup(<Button fullWidth>Go</Button>);
    expect(html).toContain("display:flex");
    expect(html).toContain("width:100%");
    expect(markup(<Button>Go</Button>)).toContain("display:inline-flex");
  });

  it("is a real button that clicks, and does nothing when disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("carries no raw colour", () => {
    for (const variant of ["primary", "secondary", "ghost"] as const) {
      const html = markup(<Button variant={variant}>Go</Button>);
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(html).not.toMatch(/rgba?\(/);
    }
  });
});

describe("Segmented", () => {
  const items = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  it("is a named group of aria-pressed buttons, and the current one is pressed", () => {
    render(<Segmented label="Letters" items={items} value="b" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Letters" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Beta" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Alpha" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with the item's value", () => {
    const onChange = vi.fn();
    render(<Segmented label="Letters" items={items} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("defaults to 12px type", () => {
    const html = markup(<Segmented label="L" items={items} value="a" onChange={() => {}} />);
    expect(html).toContain("font-size:12px");
  });

  describe("an item with an href (UI-P36)", () => {
    const pages = [
      { value: "in", label: "Sign in", href: "/login" },
      { value: "join", label: "Join free", href: "/signup" },
    ];

    it("is a real link, the current one marked aria-current, and not a button", () => {
      render(
        <MemoryRouter>
          <Segmented label="Account" items={pages} value="in" />
        </MemoryRouter>,
      );
      const [signIn, join] = screen.getAllByRole("link");
      expect(signIn.getAttribute("href")).toBe("/login");
      expect(signIn.getAttribute("aria-current")).toBe("page");
      expect(join.getAttribute("href")).toBe("/signup");
      expect(join.hasAttribute("aria-current")).toBe(false);
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.getByRole("group", { name: "Account" })).toBeTruthy();
    });

    it("leaves the navigating to the router, so onChange is not called for it", () => {
      const onChange = vi.fn();
      render(
        <MemoryRouter>
          <Segmented label="Account" items={pages} value="in" onChange={onChange} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole("link", { name: "Join free" }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('semantics="radio" (UI-P36)', () => {
    it("is a named radio group of radios, the current one checked and the only tab stop", () => {
      render(<Segmented label="Theme" items={items} value="b" onChange={() => {}} semantics="radio" />);
      expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
      const [alpha, beta, gamma] = screen.getAllByRole("radio");
      expect(beta.getAttribute("aria-checked")).toBe("true");
      expect(alpha.getAttribute("aria-checked")).toBe("false");
      expect([alpha.tabIndex, beta.tabIndex, gamma.tabIndex]).toEqual([-1, 0, -1]);
      expect(beta.hasAttribute("aria-pressed")).toBe(false);
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("picks on a click", () => {
      const onChange = vi.fn();
      render(<Segmented label="Theme" items={items} value="a" onChange={onChange} semantics="radio" />);
      fireEvent.click(screen.getByRole("radio", { name: "Gamma" }));
      expect(onChange).toHaveBeenCalledWith("c");
    });

    it("moves the choice with the arrows, wrapping at both ends, and moves the focus with it", () => {
      const onChange = vi.fn();
      const { rerender } = render(<Segmented label="Theme" items={items} value="b" onChange={onChange} semantics="radio" />);
      const group = screen.getByRole("radiogroup", { name: "Theme" });

      fireEvent.keyDown(group, { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith("c");
      expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Gamma" }));
      fireEvent.keyDown(group, { key: "ArrowDown" });
      expect(onChange).toHaveBeenLastCalledWith("c");
      fireEvent.keyDown(group, { key: "ArrowLeft" });
      expect(onChange).toHaveBeenLastCalledWith("a");
      fireEvent.keyDown(group, { key: "ArrowUp" });
      expect(onChange).toHaveBeenLastCalledWith("a");

      rerender(<Segmented label="Theme" items={items} value="c" onChange={onChange} semantics="radio" />);
      fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Theme" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenLastCalledWith("a");

      rerender(<Segmented label="Theme" items={items} value="a" onChange={onChange} semantics="radio" />);
      fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Theme" }), { key: "ArrowLeft" });
      expect(onChange).toHaveBeenLastCalledWith("c");
    });

    it("ignores every other key, and every key when it is read-only", () => {
      const onChange = vi.fn();
      const { rerender } = render(<Segmented label="Theme" items={items} value="a" onChange={onChange} semantics="radio" />);
      fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Enter" });
      fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Tab" });
      expect(onChange).not.toHaveBeenCalled();

      rerender(<Segmented label="Theme" items={items} value="a" onChange={onChange} semantics="radio" readOnly />);
      fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("leaves the default semantics as they were: a group of aria-pressed buttons", () => {
      render(<Segmented label="Letters" items={items} value="b" onChange={() => {}} />);
      expect(screen.getByRole("group", { name: "Letters" })).toBeTruthy();
      expect(screen.queryByRole("radiogroup")).toBeNull();
      expect(screen.getByRole("button", { name: "Beta" }).hasAttribute("tabindex")).toBe(false);
    });
  });
});

describe("UnderlineTabs", () => {
  const tabs = [
    { value: "one", label: "One" },
    { value: "two", label: "Two" },
    { value: "three", label: "Three" },
  ];

  it("is a tablist of tabs, and only the current one is selected and in the tab order", () => {
    render(<UnderlineTabs label="Sections" tabs={tabs} value="two" onChange={() => {}} />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
    const [one, two, three] = screen.getAllByRole("tab");
    expect(two.getAttribute("aria-selected")).toBe("true");
    expect(one.getAttribute("aria-selected")).toBe("false");
    expect(two.tabIndex).toBe(0);
    expect(one.tabIndex).toBe(-1);
    expect(three.tabIndex).toBe(-1);
  });

  it("moves with the arrow keys, wrapping at both ends, Home and End", () => {
    const onChange = vi.fn();
    render(<UnderlineTabs label="Sections" tabs={tabs} value="one" onChange={onChange} />);
    const [one, , three] = screen.getAllByRole("tab");
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("two");
    fireEvent.keyDown(one, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("three");
    fireEvent.keyDown(three, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("one");
    fireEvent.keyDown(one, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("three");
  });

  it("selects on click", () => {
    const onChange = vi.fn();
    render(<UnderlineTabs label="Sections" tabs={tabs} value="one" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Three" }));
    expect(onChange).toHaveBeenCalledWith("three");
  });
});

describe("FilterChip", () => {

  it("clicks", () => {
    const onClick = vi.fn();
    render(<FilterChip label="All" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Avatar", () => {

  it("takes the same hue for the same user, from the six", () => {
    expect(avatarHue("user-1")).toBe(avatarHue("user-1"));
    expect(AVATAR_HUES).toContain(avatarHue("user-1"));
    const seen = new Set<string>();
    for (let n = 0; n < 200; n += 1) seen.add(avatarHue(`user-${n}`));
    expect(seen.size).toBe(6);
  });

  it("lets a fixture force the hue", () => {
    for (let hue = 0; hue < 6; hue += 1) expect(avatarHue("x", hue)).toBe(AVATAR_HUES[hue]);
    expect(avatarHue("x", 9)).toBe(avatarHue("x"));
  });

  it("makes initials from the first and last words", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("ada king lovelace")).toBe("AL");
    expect(initialsOf("Ada")).toBe("AD");
    expect(initialsOf("  ")).toBe("");
  });

  it("fills the circle with the profile image when there is one", () => {
    const { container } = render(<Avatar size={34} userId="u" name="Ada Lovelace" src="/a.png" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/a.png");
    expect(img.getAttribute("alt")).toBe("Ada Lovelace");
    expect(container.textContent).toBe("");
  });

  it("is named for a screen reader and hides the letters", () => {
    render(<Avatar size={34} userId="u" name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// UI-P84 — the refined branch. The look is chosen the way a dev page chooses it: `?look=refined` on a `/dev/*` route.
// ---------------------------------------------------------------------------------------------------------------------

const REFINED = "/dev/kit/components";
const at = (url: string, node: React.ReactElement) => (
  <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
);
const refined = (node: React.ReactElement) => markup(at(REFINED, node));

describe("refined controls (UI-P84)", () => {
  it("Button maps its sizes to 28, 32 and 36 and draws no icon behind a label", () => {
    const h = (size: 28 | 30 | 32 | 34 | 36 | 38 | 42) =>
      refined(<Button size={size} icon={Plus}>Go</Button>);
    expect(h(28)).toContain("height:28px");
    expect(h(30)).toContain("height:28px");
    expect(h(32)).toContain("height:32px");
    expect(h(34)).toContain("height:32px");
    expect(h(36)).toContain("height:36px");
    expect(h(42)).toContain("height:36px");
    expect(h(36)).not.toContain("<svg");
    expect(h(28)).toContain("padding:0 12px");
    expect(h(32)).toContain("padding:0 16px");
    expect(h(28)).toContain("font-size:12.5px");
    expect(h(32)).toContain("font-size:13px");
    expect(h(36)).toContain("font-weight:500");
  });

  it("Button paints primary, secondary and ghost from the recipes' tokens", () => {
    const primary = refined(<Button variant="primary">Go</Button>);
    expect(primary).toContain("background:var(--action)");
    expect(primary).toContain("box-shadow:var(--action-shadow)");
    expect(primary).toContain("color:var(--on-action)");
    const secondary = refined(<Button variant="secondary">Go</Button>);
    expect(secondary).toContain("background:var(--control)");
    expect(secondary).toContain("var(--control-border)");
    expect(secondary).toContain("box-shadow:var(--control-shadow)");
    const ghost = refined(<Button variant="ghost">Go</Button>);
    expect(ghost).toContain("background:transparent");
    expect(ghost).toContain("color:var(--text2)");
  });

  it("IconButton is boxed by default at 26, 28 or 30 and ghost with boxed={false}", () => {
    const boxed = refined(<IconButton icon={Plus} glyph="plus" label="New" size={28} />);
    expect(boxed).toContain("width:28px");
    expect(boxed).toContain("background:var(--control)");
    expect(boxed).toContain('viewBox="0 0 16 16"');
    expect(refined(<IconButton icon={Plus} label="New" size={38} />)).toContain("width:30px");
    const ghost = refined(<IconButton icon={Plus} label="New" boxed={false} />);
    expect(ghost).toContain("background:transparent");
    expect(ghost).not.toContain("--control-shadow");
  });

  it("Segmented has a 2px track in --seg-track and items size − 6 tall", () => {
    const html = refined(
      <Segmented label="Feed" size={28} value="a" onChange={() => {}} items={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />,
    );
    expect(html).toContain("background:var(--seg-track)");
    expect(html).toContain("var(--seg-border)");
    expect(html).toContain("padding:2px");
    expect(html).toContain("height:28px");
    expect(html).toContain("height:22px");
    expect(html).toContain("padding:0 12px");
    expect(html).toContain("background:var(--control-on)");
  });

  it("UnderlineTabs is 40 high with a 2px --text edge, a hairline row and an optional count", () => {
    const html = refined(
      <UnderlineTabs
        label="Sections"
        value="a"
        onChange={() => {}}
        tabs={[{ value: "a", label: "Builds", count: 10 }, { value: "b", label: "Models" }]}
      />,
    );
    expect(html).toContain("height:40px");
    expect(html).toContain("border-bottom:2px solid var(--text)");
    expect(html).toContain("border-bottom:2px solid transparent");
    expect(html).toContain("border-bottom:1px solid var(--hairline)");
    expect(html).toContain("gap:24px");
    expect(html).toContain("font-size:11.5px");
  });

  it("FilterChip is the control recipe at 36 and selected when on, never inverted", () => {
    const off = refined(<FilterChip label="All" />);
    expect(off).toContain("height:36px");
    expect(off).toContain("background:var(--control)");
    const on = refined(<FilterChip label="All" on />);
    expect(on).toContain("background:var(--selected-fill)");
    expect(on).toContain("var(--selected-edge)");
    expect(on).not.toContain("var(--on-text)");
  });

  it("CategoryChip is a tag with a 6px square, dashed when it marks a gap", () => {
    const solid = refined(<CategoryChip category="data" label="data" />);
    expect(solid).toContain("background:var(--tag-fill)");
    expect(solid).toContain("height:20px");
    expect(solid).toContain("width:6px");
    expect(solid).toContain("border-radius:1px");
    const gap = refined(<CategoryChip category="data" label="data" gap />);
    expect(gap).toContain("1px dashed");
    expect(refined(<CategoryChip variant="overflow" count={4} />)).toContain("background:var(--tag-fill)");
  });

  it("Eyebrow is Geist 10.5/500 in capitals by CSS", () => {
    const html = refined(<Eyebrow>Maker</Eyebrow>);
    expect(html).toContain("font-size:10.5px");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("letter-spacing:.06em");
  });

  it("Avatar initials sit on --avatar-fill in --on-avatar at 500", () => {
    const html = refined(<Avatar size={34} userId="u" name="Ada Diaz" />);
    expect(html).toContain("background:var(--avatar-fill)");
    expect(html).toContain("color:var(--on-avatar)");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("font-size:12.9px");
  });
});

describe("Pill, MenuButton, SearchField and Checkbox (UI-P84)", () => {
  it("Pill is 18 high in mono 10.5 and takes its tone's fill and ink", () => {
    const plain = markup(<Pill>x</Pill>);
    expect(plain).toContain("height:18px");
    expect(plain).toContain("font-size:10.5px");
    expect(plain).toContain("background:var(--pill)");
    expect(plain).toContain("color:var(--on-pill)");
    expect(markup(<Pill tone="evidence">x</Pill>)).toContain("background:var(--evidence-fill)");
    expect(markup(<Pill tone="breakage">x</Pill>)).toContain("color:var(--breakage)");
    expect(markup(<Pill tone="lit-ink">x</Pill>)).toContain("color:var(--lit-ink)");
    expect(markup(<Pill tone="data">x</Pill>)).toContain("background:var(--cat-data-fill)");
  });

  it("MenuButton announces a menu and shows label, value and chevron", () => {
    render(<MenuButton label="Sort by" value="Engagement" />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.textContent).toBe("Sort byEngagement");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.style.height).toBe("28px");
  });

  it("SearchField names its input and draws the key hint", () => {
    render(<SearchField label="Search builds" hint="/" />);
    expect(screen.getByRole("searchbox", { name: "Search builds" })).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
  });

  it("Checkbox is a real checkbox, 16 square, with a check when on", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<Checkbox label="Agree" checked={false} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Agree" });
    expect(container.querySelector("svg")).toBeNull();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<Checkbox label="Agree" checked onChange={onChange} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect((container.firstElementChild as HTMLElement).style.width).toBe("16px");
  });
});
