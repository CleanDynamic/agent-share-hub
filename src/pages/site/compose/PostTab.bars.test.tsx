// PT-05 — what is drawn over the editor: the format bar and the slash menu.

import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThreadDoc } from "@/lib/build/thread";
import { postRuns } from "@/lib/build/threadEditor";

import { brk, doc, mountPostTab as mount, p } from "./postTabKit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const json = (editor: Editor) => editor.getJSON() as ThreadDoc;

/** jsdom will not focus a contenteditable, and says its document never has focus; a browser does both. */
function focus(editor: Editor) {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  editor.view.dom.tabIndex = 0;
  act(() => {
    editor.view.dom.focus();
  });
}

/** Selects "hello" in a paragraph that reads "hello world", with the editor focused. */
function select(editor: Editor, from = 1, to = 6) {
  focus(editor);
  act(() => {
    editor.commands.setTextSelection({ from, to });
  });
}

const bar = () => screen.getByRole("toolbar", { name: "Format" });

describe("the format bar", () => {
  it("shows over a text selection and not over a caret", () => {
    const { editor } = mount(doc(p("hello world")));
    focus(editor);
    act(() => {
      editor.commands.setTextSelection(3);
    });
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
    select(editor);
    expect(bar()).toBeTruthy();
  });

  it("is in order: text style, a divider, Bold, Italic, Underline, a divider, Bulleted list, Numbered list, Link", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    const names = within(bar())
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(["Text style", "Bold", "Italic", "Underline", "Bulleted list", "Numbered list", "Link"]);
    expect(bar().querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
    expect(within(bar()).getByRole("button", { name: "Text style" }).textContent).toBe("Body");
  });

  it("has 30 square buttons, radius 6, on an --inverse bar of radius 8, padding 4, gap 2", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    const bold = within(bar()).getByRole("button", { name: "Bold" });
    expect([bold.style.width, bold.style.height, bold.style.borderRadius]).toEqual(["30px", "30px", "6px"]);
    expect([bar().style.borderRadius, bar().style.padding, bar().style.gap]).toEqual(["8px", "4px", "2px"]);
  });

  it("draws B in bold and U underlined in Geist, and I as a drawn glyph, never italic type", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    const letter = (name: string) => within(bar()).getByRole("button", { name }).querySelector("span") as HTMLElement;
    expect(letter("Bold").style.fontWeight).toBe("700");
    expect(within(bar()).getByRole("button", { name: "Italic" }).querySelector("svg")).not.toBeNull();
    expect(within(bar()).getByRole("button", { name: "Italic" }).innerHTML).not.toContain("italic");
    expect(letter("Underline").style.textDecoration).toBe("underline");
    expect(letter("Bold").getAttribute("style")).toContain("'Geist'");
  });

  it("toggles Bold, Italic and Underline, and says so in aria-pressed", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    for (const [name, mark] of [
      ["Bold", "bold"],
      ["Italic", "italic"],
      ["Underline", "underline"],
    ] as const) {
      const button = () => within(bar()).getByRole("button", { name });
      expect(button().getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(button());
      expect(button().getAttribute("aria-pressed")).toBe("true");
      expect(JSON.stringify(json(editor))).toContain(`"type":"${mark}"`);
    }
  });

  it("makes a bulleted and a numbered list", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    fireEvent.click(within(bar()).getByRole("button", { name: "Bulleted list" }));
    expect(json(editor).content[0].type).toBe("bulletList");
    expect(within(bar()).getByRole("button", { name: "Bulleted list" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(bar()).getByRole("button", { name: "Numbered list" }));
    expect(json(editor).content[0].type).toBe("orderedList");
  });

  it("answers Cmd or Ctrl with B, I and U", () => {
    const { editor, dom } = mount(doc(p("hello world")));
    select(editor);
    for (const [key, mark] of [
      ["b", "bold"],
      ["i", "italic"],
      ["u", "underline"],
    ]) {
      fireEvent.keyDown(dom, { key, ctrlKey: true });
      expect(JSON.stringify(json(editor))).toContain(`"type":"${mark}"`);
    }
  });

  it("lists Title, Heading, Body, Small and Code, each in its own style, and applies one", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    fireEvent.keyDown(within(bar()).getByRole("button", { name: "Text style" }), { key: "Enter" });
    const menu = screen.getByRole("menu", { name: "Text style" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Title", "Heading", "Body", "Small", "Code"]);
    const sizes = items.map((item) => (item.querySelector("span") as HTMLElement).style.fontSize);
    expect(sizes).toEqual(["28px", "20px", "16px", "13px", "13px"]);
    fireEvent.click(items[0]);
    expect(json(editor).content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
  });

  it("makes a block Small, and reads it back in the menu", () => {
    const { editor } = mount(doc(p("hello world")));
    select(editor);
    fireEvent.keyDown(within(bar()).getByRole("button", { name: "Text style" }), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("menu", { name: "Text style" })).getByRole("menuitem", { name: "Small" }));
    expect(json(editor).content[0]).toMatchObject({ type: "paragraph", attrs: { size: "small" } });
    select(editor);
    expect(within(bar()).getByRole("button", { name: "Text style" }).textContent).toBe("Small");
  });

  describe("the link", () => {
    const open = (editor: Editor) => {
      select(editor);
      fireEvent.click(within(bar()).getByRole("button", { name: "Link" }));
      return screen.getByRole("form", { name: "Link" });
    };
    const type = (form: HTMLElement, value: string) => fireEvent.change(within(form).getByLabelText("Link address"), { target: { value } });

    it("opens a small popover with an address field and Save", () => {
      const { editor } = mount(doc(p("hello world")));
      const form = open(editor);
      expect(within(form).getByLabelText("Link address")).toBe(document.activeElement);
      expect(within(form).getByRole("button", { name: "Save" })).toBeTruthy();
      expect(within(form).queryByRole("button", { name: "Remove" })).toBeNull();
    });

    it("refuses anything but http, https and mailto, with a sentence", () => {
      const { editor } = mount(doc(p("hello world")));
      const form = open(editor);
      for (const bad of ["ftp://files.example.com", "javascript:alert(1)", "example.com", ""]) {
        type(form, bad);
        fireEvent.submit(form);
        expect(within(form).getByRole("alert").textContent).toBe("Use an address that starts with http://, https:// or mailto:");
        expect(JSON.stringify(json(editor))).not.toContain('"link"');
      }
    });

    it("saves an https address and a mailto one", () => {
      const { editor } = mount(doc(p("hello world")));
      let form = open(editor);
      type(form, "https://example.com/a");
      fireEvent.submit(form);
      expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
      expect(JSON.stringify(json(editor))).toContain('"href":"https://example.com/a"');

      form = open(editor);
      expect((within(form).getByLabelText("Link address") as HTMLInputElement).value).toBe("https://example.com/a");
      type(form, "mailto:me@example.com");
      fireEvent.submit(form);
      expect(JSON.stringify(json(editor))).toContain('"href":"mailto:me@example.com"');
    });

    it("removes a link with Remove", () => {
      const { editor } = mount(doc(p("hello world", [{ type: "link", attrs: { href: "https://example.com/a" } }])));
      const form = open(editor);
      fireEvent.click(within(form).getByRole("button", { name: "Remove" }));
      expect(JSON.stringify(json(editor))).not.toContain('"link"');
    });

    it("opens on Cmd or Ctrl with K, and closes on Escape", () => {
      const { editor, dom } = mount(doc(p("hello world")));
      select(editor);
      fireEvent.keyDown(dom, { key: "k", ctrlKey: true });
      const form = screen.getByRole("form", { name: "Link" });
      fireEvent.keyDown(form, { key: "Escape" });
      expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
    });

    it("does not open on Cmd or Ctrl with K when nothing is selected", () => {
      const { editor, dom } = mount(doc(p("hello world")));
      focus(editor);
      act(() => {
        editor.commands.setTextSelection(3);
      });
      fireEvent.keyDown(dom, { key: "k", ctrlKey: true });
      expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
    });
  });

  describe("where it sits", () => {
    const rect = (top: number, bottom: number, left = 100, right = 180) => ({ top, bottom, left, right });

    it("is 8 above the selection", () => {
      const { editor } = mount(doc(p("hello world")));
      vi.spyOn(editor.view, "coordsAtPos").mockReturnValue(rect(300, 320));
      select(editor);
      expect(bar().style.top).toBe(`${300 - 8 - 38}px`);
    });

    it("goes below the selection when there is no room above", () => {
      const { editor } = mount(doc(p("hello world")));
      vi.spyOn(editor.view, "coordsAtPos").mockReturnValue(rect(20, 40));
      select(editor);
      expect(bar().style.top).toBe("48px");
    });

    it("goes below the selection rather than cover a post's Title line", () => {
      const { editor } = mount(
        doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title line" }] }, p("hello world")),
      );
      const title = document.querySelector('[data-heading="1"]') as HTMLElement;
      title.getBoundingClientRect = () => ({ top: 240, bottom: 280, left: 0, right: 600, width: 600, height: 40, x: 0, y: 240, toJSON: () => ({}) });
      vi.spyOn(editor.view, "coordsAtPos").mockReturnValue(rect(300, 320));
      select(editor, 13, 18);
      expect(bar().style.top).toBe("328px");
    });

    it("is not drawn on a phone", () => {
      const { editor } = mount(doc(p("hello world")), { phone: true });
      select(editor);
      expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
    });
  });
});

describe("the slash menu", () => {
  const typeSlash = (editor: Editor, query = "") => {
    act(() => {
      editor.commands.focus("end");
      editor.commands.insertContent(`/${query}`);
    });
  };
  const listbox = () => screen.getByRole("listbox", { name: "Insert" });

  it("opens on / in an empty paragraph, the picture item first (CA-07: no row of pictures)", () => {
    const { editor } = mount(doc(p("")));
    typeSlash(editor);
    const options = within(listbox()).getAllByRole("option");
    expect(options.map((option) => option.querySelector("span")?.textContent)).toEqual(["Picture or video", "Bulleted list", "Numbered list", "Title", "Heading", "Code", "New post"]);
    expect(options[0].style.height).toBe("40px");
    expect(options[1].querySelectorAll("span")[1].textContent).toBe("A list with dots");
  });

  it("lists the picture item first once there is a way to insert a picture", () => {
    const onInsertPicture = vi.fn();
    const { editor } = mount(doc(p("")), {}, { onInsertPicture });
    typeSlash(editor);
    const names = within(listbox())
      .getAllByRole("option")
      .map((option) => option.querySelector("span")?.textContent);
    expect(names).toEqual(["Picture or video", "Bulleted list", "Numbered list", "Title", "Heading", "Code", "New post"]);
    fireEvent.click(within(listbox()).getByRole("option", { name: /Picture or video/ }));
    expect(onInsertPicture).toHaveBeenCalledWith(editor);
    expect(json(editor).content[0]).toMatchObject({ type: "paragraph" });
    expect(editor.getText()).toBe("");
  });

  it("does not open in a paragraph that has other text, nor mid-line", () => {
    const { editor } = mount(doc(p("hello")));
    act(() => {
      editor.commands.focus("end");
      editor.commands.insertContent(" /");
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("narrows as you type, and closes when nothing matches", () => {
    const { editor } = mount(doc(p("")));
    typeSlash(editor, "he");
    expect(within(listbox()).getAllByRole("option")).toHaveLength(1);
    act(() => {
      editor.commands.insertContent("zz");
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("chooses with the arrow keys and Enter, taking the slash away", () => {
    const { editor, dom } = mount(doc(p("")));
    typeSlash(editor);
    for (let press = 0; press < 2; press++) fireEvent.keyDown(dom, { key: "ArrowDown" });
    expect(within(listbox()).getAllByRole("option")[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(json(editor).content[0].type).toBe("orderedList");
    expect(editor.getText()).not.toContain("/");
  });

  it("closes on Escape and leaves the slash", () => {
    const { editor, dom } = mount(doc(p("")));
    typeSlash(editor);
    fireEvent.keyDown(dom, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(editor.getText()).toContain("/");
  });

  it("makes a Title, a Heading and Code", () => {
    for (const [query, expected] of [
      ["title", { type: "heading", attrs: { level: 1 } }],
      ["heading", { type: "heading", attrs: { level: 2 } }],
      ["code", { type: "codeBlock" }],
    ] as const) {
      const { editor, dom } = mount(doc(p("")));
      typeSlash(editor, query);
      fireEvent.keyDown(dom, { key: "Enter" });
      expect(json(editor).content[0]).toMatchObject(expected);
      cleanup();
    }
  });

  it("starts the next post with New post, and the caret goes into it", () => {
    const { editor, dom } = mount(doc(p("first post"), p("")));
    typeSlash(editor, "new");
    fireEvent.keyDown(dom, { key: "Enter" });
    const result = json(editor);
    expect(result.content.map((block) => block.type)).toEqual(["paragraph", "postBreak", "paragraph"]);
    expect(postRuns(result)).toHaveLength(2);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(editor.state.selection.$from.index(0)).toBe(2);
  });

  it("refuses an 11th post with a sentence and leaves the thread as it was", () => {
    const nine = Array.from({ length: 9 }, (_, index) => [p(`post ${index + 1}`), brk]).flat();
    const { editor, dom } = mount(doc(...nine, p("")));
    expect(postRuns(json(editor))).toHaveLength(10);
    typeSlash(editor, "new");
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(screen.getByTestId("post-tab").querySelector("p[role=status]")?.textContent).toBe("Posts: 10 max");
    expect(postRuns(json(editor))).toHaveLength(10);
  });

  it("is a window of radius 8, with no blur", () => {
    const { editor } = mount(doc(p("")));
    typeSlash(editor);
    expect(listbox().style.borderRadius).toBe("8px");
    expect(listbox().getAttribute("style") ?? "").not.toContain("blur");
  });
});
