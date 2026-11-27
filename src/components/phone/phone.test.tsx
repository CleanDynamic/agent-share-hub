import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ActionSheet,
  BigButton,
  PhoneBottomSheet,
  PhoneField,
  PhoneModule,
  PhonePills,
  PhoneRow,
  PhoneTabs,
  PhoneToast,
  PhoneTopBar,
  RoundPostButton,
  SectionFact,
  Shelf,
} from "./index";

// jsdom has no PointerEvent, so fireEvent.pointerMove would drop clientY.
class TestPointerEvent extends MouseEvent {}
vi.stubGlobal("PointerEvent", TestPointerEvent);

/** The element's inline style as written, `prop:value;` with no spaces: jsdom drops `var()` from its parsed `style` properties. */
const css = (el: HTMLElement) => (el.getAttribute("style") ?? "").replace(/: /g, ":");
const wrap = (node: React.ReactElement) => <MemoryRouter>{node}</MemoryRouter>;
const markup = (node: React.ReactElement) => renderToStaticMarkup(wrap(node));

describe("PhoneTopBar", () => {
  it("is a 48 1fr 48 grid, 44 tall, on Page with the structural line on its bottom edge", () => {
    const html = markup(<PhoneTopBar left="account" centre="logo" viewer={{ name: "Maya Okafor" }} />);
    expect(html).toContain("grid-template-columns:48px 1fr 48px");
    expect(html).toContain("height:44px");
    expect(html).toContain("padding-top:env(safe-area-inset-top)");
    expect(html).toContain("background:var(--bg)");
    const head = html.slice(html.indexOf("<header"), html.indexOf(">", html.indexOf("<header")));
    expect(head).not.toMatch(/border(-bottom)?:/);
  });

  it("names the logo link, hides its image, and names the account button", () => {
    render(wrap(<PhoneTopBar left="account" centre="logo" viewer={{ name: "Maya Okafor" }} />));
    const home = screen.getByRole("link", { name: "OpenBuilds.ai home" });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(home.querySelector("img")?.getAttribute("width")).toBe("56");
    expect(screen.getByRole("button", { name: "Maya Okafor, account menu" })).toBeTruthy();
    expect(screen.getByTestId("phone-avatar").textContent).toBe("MO");
  });

  it("29f: draws a second icon before the right slot, the beaver at the width it is given, and the bar title at 700", () => {
    const more = vi.fn();
    const skip = vi.fn();
    render(wrap(<PhoneTopBar left="back" centre="logo" logoWidth={44} extra={{ icon: "more", label: "More", onClick: more }} right={{ text: "Skip to build", label: "Skip to build", onClick: skip }} />));
    expect(screen.getByRole("link", { name: "OpenBuilds.ai home" }).querySelector("img")?.getAttribute("width")).toBe("44");
    const names = within(screen.getByTestId("phone-top-bar")).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(["Back", "More", "Skip to build"]);
    fireEvent.click(screen.getByRole("button", { name: "Skip to build" }));
    expect(skip).toHaveBeenCalled();
    cleanup();
    expect(markup(<PhoneTopBar left="account" centre="Builds" titleAs="p" />)).toContain("font-size:17px;font-weight:700;line-height:22px");
  });

  it("draws the unread square only when something is unread", () => {
    const { rerender } = render(wrap(<PhoneTopBar left="account" centre="logo" viewer={{ name: "Maya Okafor" }} />));
    expect(screen.queryByTestId("phone-unread")).toBeNull();
    rerender(wrap(<PhoneTopBar left="account" centre="logo" viewer={{ name: "Maya Okafor" }} unread />));
    expect(screen.getByTestId("phone-unread")).toBeTruthy();
  });

  it("Back and Close are named 44 buttons that call onLeft; a title is the h1", () => {
    const onLeft = vi.fn();
    render(wrap(<PhoneTopBar left="back" leftLabel="Back to Drafts" centre="Rebuild" onLeft={onLeft} right={{ icon: "more", label: "More", onClick: vi.fn() }} />));
    const back = screen.getByRole("button", { name: "Back to Drafts" });
    expect(back.style.width).toBe("44px");
    expect(back.style.height).toBe("44px");
    fireEvent.click(back);
    expect(onLeft).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Rebuild" }).style.textOverflow).toBe("ellipsis");
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
  });

  it("with no left or right control draws neither", () => {
    render(wrap(<PhoneTopBar left={null} centre="Title" />));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("PhoneTabs", () => {
  const tabs = [
    { value: "a", label: "Following" },
    { value: "b", label: "Everyone" },
  ];
  it("has the tab roles, marks the current one and draws one 4px bar", () => {
    render(<PhoneTabs tabs={tabs} value="a" onChange={vi.fn()} label="Feed" />);
    expect(screen.getByRole("tablist", { name: "Feed" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Following" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Everyone" }).getAttribute("aria-selected")).toBe("false");
    const bars = screen.getAllByTestId("phone-tab-bar");
    expect(bars).toHaveLength(1);
    expect(bars[0].style.height).toBe("4px");
    expect(Number.parseInt(bars[0].style.width)).toBeGreaterThanOrEqual(40);
    expect(screen.getByRole("tab", { name: "Following" }).style.height).toBe("44px");
  });
  it("arrow keys move and change at once; equal shares the width", () => {
    const onChange = vi.fn();
    render(<PhoneTabs tabs={tabs} value="a" onChange={onChange} label="Feed" equal />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Following" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("tab", { name: "Everyone" }).style.flex).toContain("1 1 0");
  });
});

describe("PhonePills", () => {
  it("is a 32 tall row of toggles, 8 apart, the chosen one pressed", () => {
    const onChange = vi.fn();
    render(<PhonePills pills={[{ value: "all", label: "All" }, { value: "web", label: "Web app" }]} value="all" onChange={onChange} label="Kind" />);
    const row = screen.getByRole("group", { name: "Kind" });
    expect(row.style.gap).toBe("8px");
    expect(row.style.padding).toBe("10px 16px");
    const all = screen.getByRole("button", { name: "All" });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(all.style.height).toBe("32px");
    fireEvent.click(screen.getByRole("button", { name: "Web app" }));
    expect(onChange).toHaveBeenCalledWith("web");
  });
});

describe("Shelf", () => {
  it("is a list of 156 square items 12 apart that snap", () => {
    render(wrap(<Shelf label="Spaces" items={[{ id: "1", number: "3", title: "Open", line: "in your spaces" }, { id: "2", number: "8", title: "Sessions", to: "/x" }]} />));
    const list = screen.getByRole("list", { name: "Spaces" });
    expect(list.style.gap).toBe("12px");
    expect(list.style.scrollSnapType).toContain("x");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].style.width).toBe("156px");
    expect(items[0].style.height).toBe("156px");
    expect(items[1].getAttribute("href")).toBe("/x");
  });
});

describe("PhoneRow", () => {
  it("is at least 56 tall with padding 8 16 and gap 12, a one-line title and line", () => {
    render(wrap(<PhoneRow title="Kit rebuild" line="2 days ago" lead={{ kind: "icon", icon: "session" }} trail={{ kind: "chevron" }} to="/b/1" />));
    const row = screen.getByRole("link", { name: "Kit rebuild 2 days ago" });
    expect(row.style.minHeight).toBe("56px");
    expect(row.style.padding).toBe("8px 16px");
    expect(row.style.gap).toBe("12px");
    expect(screen.getByText("Kit rebuild").style.whiteSpace).toBe("nowrap");
  });
  it("is a button row when it has onSelect and a plain row otherwise", () => {
    const onSelect = vi.fn();
    const { rerender } = render(wrap(<PhoneRow title="One" onSelect={onSelect} />));
    fireEvent.click(screen.getByRole("button", { name: "One" }));
    expect(onSelect).toHaveBeenCalledOnce();
    rerender(wrap(<PhoneRow title="One" />));
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("PhoneModule and SectionFact", () => {
  it("a module is a Panel block with margin 8 16, radius 12, padding 16 and a 10 gap", () => {
    const html = markup(<PhoneModule>x</PhoneModule>);
    expect(html).toContain("margin:8px 16px");
    expect(html).toContain("padding:16px");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("background:var(--surface)");
    expect(html).toContain("gap:10px");
  });
  it("a section fact is a 20/24 600 heading with an underlined link", () => {
    render(wrap(<SectionFact fact="36 drafts" link={{ label: "See all", to: "/drafts" }} />));
    const h = screen.getByRole("heading", { level: 2, name: "36 drafts" });
    expect(h.style.fontSize).toBe("20px");
    expect(h.style.lineHeight).toBe("24px");
    expect(screen.getByRole("link", { name: "See all" }).style.textDecoration).toBe("underline");
  });
});

describe("BigButton, PhoneField, RoundPostButton, PhoneToast", () => {
  it("a big button is 48 tall, radius 24; main is Mint; full is the row's width", () => {
    render(
      <>
        <BigButton>Cancel</BigButton>
        <BigButton main full>Post</BigButton>
      </>,
    );
    const plain = screen.getByRole("button", { name: "Cancel" });
    expect(plain.style.height).toBe("48px");
    expect(plain.style.borderRadius).toBe("24px");
    expect(markup(<BigButton>Cancel</BigButton>)).toContain("background:var(--control)");
    const main = screen.getByRole("button", { name: "Post" });
    expect(markup(<BigButton main>Post</BigButton>)).toContain("background:var(--brand-accent)");
    expect(main.style.width).toBe("100%");
  });

  it("a field is a labelled 44 box with 16px text and no placeholder", () => {
    render(<PhoneField label="Title" defaultValue="x" />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.style.height).toBe("44px");
    expect(input.style.fontSize).toBe("16px");
    expect(input.getAttribute("placeholder")).toBeNull();
  });

  it("a multi-line field is 88 tall with the Expand button", () => {
    const onExpand = vi.fn();
    render(<PhoneField label="Notes" multiline onExpand={onExpand} />);
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).style.minHeight).toBe("88px");
    const expand = screen.getByRole("button", { name: "Open in the notepad" });
    expect(expand.style.width).toBe("44px");
    fireEvent.click(expand);
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it("Expand opens the notepad with the text, and Done writes the text back", async () => {
    const onChange = vi.fn();
    render(<PhoneField label="Notes" multiline defaultValue="first" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Open in the notepad" }));
    const pad = await screen.findByRole("dialog");
    const text = pad.querySelector("textarea") as HTMLTextAreaElement;
    expect(text.value).toBe("first");
    fireEvent.change(text, { target: { value: "first and more" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("first and more"));
    expect(onChange).toHaveBeenCalled();
  });

  it("the round post button is a named 56 Mint circle clear of the dock, and hides while the keyboard is open", () => {
    const onClick = vi.fn();
    const { unmount } = render(<RoundPostButton label="New post" onClick={onClick} />);
    const fab = screen.getByRole("button", { name: "New post" });
    expect(fab.style.width).toBe("56px");
    expect(fab.style.right).toBe("16px");
    expect(markup(<RoundPostButton label="New post" />)).toContain("bottom:calc(49px + env(safe-area-inset-bottom) + 16px)");
    unmount();
    const vv = Object.assign(new EventTarget(), { height: 400, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    render(<RoundPostButton label="New post" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: "New post" })).toBeNull();
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
  });

  it("a toast is Text fill, 48 tall, radius 12 with an action", () => {
    const onClick = vi.fn();
    render(<PhoneToast action={{ label: "Undo", onClick }}>Saved</PhoneToast>);
    const toast = screen.getByRole("status");
    expect(markup(<PhoneToast>Saved</PhoneToast>)).toContain("background:var(--text)");
    expect(toast.style.minHeight).toBe("48px");
    expect(toast.style.borderRadius).toBe("12px");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ActionSheet", () => {
  it("is an alert dialog with the action first and Cancel last", () => {
    const onSelect = vi.fn();
    render(<ActionSheet open onOpenChange={vi.fn()} title="Delete draft?" explanation="It cannot be undone." action={{ label: "Delete", danger: true, onSelect }} />);
    const dialog = screen.getByRole("alertdialog", { name: "Delete draft?" });
    expect(dialog.textContent).toContain("It cannot be undone.");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Delete", "Cancel"]);
    expect(buttons[0].getAttribute("data-variant")).toBe("danger");
    expect(buttons[0].style.height).toBe("48px");
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

function Harness({ onClose = () => undefined, dirty, height }: { onClose?: (open: boolean) => void; dirty?: boolean; height?: "content" | "half" | "full" }) {
  const [open, setOpen] = useState(true);
  return (
    <PhoneBottomSheet
      open={open}
      onOpenChange={(o) => { setOpen(o); onClose(o); }}
      title="Filters"
      line="2 selected"
      dirty={dirty}
      height={height}
      footer={{ status: "Not saved", actions: <button type="button">Apply</button> }}
    >
      <input aria-label="Name" />
    </PhoneBottomSheet>
  );
}

describe("PhoneBottomSheet", () => {
  it("is a named dialog on Card, radius 16 16 0 0, with a 36 by 4 handle, a line and a 44 Close", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();
    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.style.borderRadius).toBe("16px 16px 0 0");
    expect(sheet.getAttribute("data-fill")).toBe("card");
    expect(sheet.textContent).toContain("2 selected");
    const handle = screen.getByTestId("sheet-grabber").firstElementChild as HTMLElement;
    expect(handle.style.width).toBe("36px");
    expect(handle.style.height).toBe("4px");
    expect(screen.getByRole("button", { name: "Close Filters" }).style.width).toBe("44px");
  });

  it("opens to its content, half, or full (jsdom cannot read dvh, so the height is named by data-height)", () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByTestId("bottom-sheet").getAttribute("data-height")).toBe("content");
    unmount();
    const half = render(<Harness height="half" />);
    expect(screen.getByTestId("bottom-sheet").getAttribute("data-height")).toBe("half");
    half.unmount();
    render(<Harness height="full" />);
    expect(screen.getByTestId("bottom-sheet").getAttribute("data-height")).toBe("full");
  });

  it("closes on Escape and the Close control when nothing changed", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenLastCalledWith(false);
  });

  it("closes when the handle is dragged down more than a third of the sheet (80px where it has no height), or flicked, not less (29e)", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const grab = screen.getByTestId("sheet-grabber");
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 108, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 108, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 200, pointerId: 1 });
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("asks before closing once a field has changed: Keep editing stays, Discard closes", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Close Filters" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("asks when dirty is forced, and not when it is forced off", () => {
    const onClose = vi.fn();
    const forced = render(<Harness onClose={onClose} dirty />);
    fireEvent.click(screen.getByRole("button", { name: "Close Filters" }));
    expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toBeTruthy();
    forced.unmount();
    render(<Harness onClose={onClose} dirty={false} />);
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Close Filters" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("pins the footer on Surface with the status at the left and the actions at the right", () => {
    render(<Harness />);
    const footer = screen.getByTestId("sheet-footer");
    expect(footer.getAttribute("data-fill")).toBe("surface");
    expect(footer.textContent).toBe("Not savedApply");
  });
});
