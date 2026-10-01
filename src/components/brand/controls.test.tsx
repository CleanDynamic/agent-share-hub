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
import { describe, expect, it, vi } from "vitest";

import { Avatar, AVATAR_HUES, avatarHue, initialsOf } from "./Avatar";
import { Button } from "./Button";
import { Eyebrow } from "./Eyebrow";
import { FilterChip } from "./FilterChip";
import { IconButton } from "./IconButton";
import { Segmented } from "./Segmented";
import { UnderlineTabs } from "./UnderlineTabs";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Button", () => {
  it("is 36px tall at 13px by default, with the reference's padding, radius and gap", () => {
    const html = markup(<Button>Go</Button>);
    expect(html).toContain("height:36px");
    expect(html).toContain("font-size:13px");
    expect(html).toContain("padding:0 14px");
    expect(html).toContain("border-radius:var(--r-control)");
    expect(html).toContain("gap:7px");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain('type="button"');
  });

  it("paints primary in --action on --on-action with a 1px --action border, weight 600", () => {
    const html = markup(<Button variant="primary">Go</Button>);
    expect(html).toContain("background:var(--action)");
    expect(html).toContain("color:var(--on-action)");
    expect(html).toContain("border:1px solid var(--action)");
    expect(html).toContain("font-weight:600");
  });

  it("paints secondary on glass-2 with a --line hairline, weight 500", () => {
    const html = markup(<Button variant="secondary">Go</Button>);
    expect(html).toContain("background:var(--glass-2)");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("border:1px solid var(--line)");
    expect(html).toContain("font-weight:500");
  });

  it("paints ghost on nothing, in --text2, with a transparent border", () => {
    const html = markup(<Button variant="ghost">Go</Button>);
    expect(html).toContain("background:transparent");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("border:1px solid transparent");
  });

  it.each([
    [28, 11],
    [30, 12],
    [32, 12],
    [34, 12],
    [36, 13],
    [38, 13],
    [42, 14],
    [44, 13],
    [46, 15],
    [48, 14],
    [48, 15],
  ] as const)("renders the %i/%i pair", (size, fontSize) => {
    const html = markup(<Button size={size} fontSize={fontSize}>Go</Button>);
    expect(html).toContain(`height:${size}px`);
    expect(html).toContain(`font-size:${fontSize}px`);
  });

  it("draws its icon at 15px and stroke 1.8, before the label", () => {
    const { container } = render(<Button icon={Plus}>Add</Button>);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("15");
    expect(svg.getAttribute("stroke-width")).toBe("1.8");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("button")!.firstElementChild).toBe(svg);
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

describe("IconButton", () => {
  it("is square, named by its label, 16px at stroke 1.6", () => {
    const { container } = render(<IconButton icon={Plus} label="Add" size={38} />);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button.getAttribute("aria-label")).toBe("Add");
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("stroke-width")).toBe("1.6");
    const html = markup(<IconButton icon={Plus} label="Add" size={38} />);
    expect(html).toContain("width:38px");
    expect(html).toContain("height:38px");
    expect(html).toContain("border-radius:var(--r-control)");
    expect(html).toContain("background:var(--glass-2)");
    expect(html).toContain("border:1px solid var(--line)");
    expect(html).toContain("color:var(--text2)");
  });

  it.each([30, 34, 38] as const)("is %ipx square", (size) => {
    const html = markup(<IconButton icon={Plus} label="Add" size={size} />);
    expect(html).toContain(`width:${size}px;height:${size}px`);
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

  it("draws the track and the items to the reference", () => {
    const html = markup(<Segmented label="L" items={items} value="a" onChange={() => {}} size={36} fontSize={12} />);
    expect(html).toContain("display:inline-flex;gap:2px;padding:4px");
    expect(html).toContain("border-radius:var(--r-control)");
    expect(html).toContain("background:var(--glass-2)");
    expect(html).toContain("border:1px solid var(--line)");
    expect(html).toContain("height:28px"); // size − 8
    expect(html).toContain("padding:0 12px");
    expect(html).toContain("border-radius:var(--r-chip)");
    // current: --text on --on-text, 600. Others: transparent --text2, 500.
    expect(html).toContain("background:var(--text);color:var(--on-text);font-weight:600");
    expect(html).toContain("background:transparent;color:var(--text2);font-weight:500");
  });

  it.each([
    [30, 22],
    [32, 24],
    [34, 26],
    [36, 28],
    [38, 30],
  ] as const)("a %ipx track has %ipx items", (size, item) => {
    const html = markup(<Segmented label="L" items={items} value="a" onChange={() => {}} size={size} />);
    expect(html).toContain(`height:${item}px`);
  });

  it("defaults to 12px type", () => {
    const html = markup(<Segmented label="L" items={items} value="a" onChange={() => {}} />);
    expect(html).toContain("font-size:12px");
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

  it("draws the row, the current tab and the others to the reference", () => {
    const html = markup(<UnderlineTabs label="S" tabs={tabs} value="one" onChange={() => {}} />);
    expect(html).toContain("display:flex;gap:24px;align-items:flex-end;border-bottom:1px solid var(--line)");
    expect(html).toContain("border-bottom:2px solid var(--action)");
    expect(html).toContain("padding-bottom:10px");
    expect(html).toContain("padding-bottom:12px");
    expect(html).toContain("font-size:14px");
    expect(html).toContain("font-weight:600");
    expect(html).toContain("color:var(--text);");
    expect(html).toContain("color:var(--text2)");
  });

  it.each([12, 13, 14] as const)("sets %ipx type", (fontSize) => {
    const html = markup(<UnderlineTabs label="S" tabs={tabs} value="one" onChange={() => {}} fontSize={fontSize} />);
    expect(html).toContain(`font-size:${fontSize}px`);
  });
});

describe("FilterChip", () => {
  it("is 36px, radius 10, Figtree 13/500, glass when off and the inverse when on", () => {
    const off = markup(<FilterChip label="Proven" />);
    expect(off).toContain("height:36px");
    expect(off).toContain("padding:0 12px");
    expect(off).toContain("border-radius:var(--r-media)");
    expect(off).toContain("font-size:13px;font-weight:500");
    expect(off).toContain("background:var(--glass-2);color:var(--text);border:1px solid var(--line)");
    const on = markup(<FilterChip label="All" on />);
    expect(on).toContain("background:var(--text);color:var(--on-text);border:1px solid var(--text)");
  });

  it("carries its count in DM Mono 10px at 70%, and says whether it is on", () => {
    const { container } = render(<FilterChip label="Proven" count={512} on />);
    expect(screen.getByRole("button", { name: /Proven/ }).getAttribute("aria-pressed")).toBe("true");
    const count = container.querySelector("span")!;
    expect(count.textContent).toBe("512");
    expect(count.style.fontSize).toBe("10px");
    expect(count.style.opacity).toBe("0.7");
  });

  it("clicks", () => {
    const onClick = vi.fn();
    render(<FilterChip label="All" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Eyebrow", () => {
  it("is DM Mono 11px upper case at .09em in --label, on one line", () => {
    const html = markup(<Eyebrow>Maker</Eyebrow>);
    expect(html).toContain("font-size:11px");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("letter-spacing:0.09em");
    expect(html).toContain("color:var(--label)");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("DM Mono");
  });

  it("is 10px inside a panel", () => {
    expect(markup(<Eyebrow size={10}>Maker</Eyebrow>)).toContain("font-size:10px");
  });
});

describe("Avatar", () => {
  it.each([
    [22, 8],
    [28, 10],
    [34, 12],
    [78, 29],
    [110, 41],
  ] as const)("a %ipx avatar sets %ipx initials", (size, font) => {
    const html = markup(<Avatar size={size} userId="u" name="Ada Lovelace" />);
    expect(html).toContain(`width:${size}px;height:${size}px`);
    expect(html).toContain(`font-size:${font}px`);
    expect(html).toContain("border-radius:var(--r-full)");
    expect(html).toContain("font-weight:600");
    expect(html).toContain("color:#F7F8F9");
  });

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
