// PT-07 — the preview (its column drawing, and the sheet the composer opens it in) and the composer's toolbar.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostPreview } from "@/components/post/PostPreview";
import { DESKTOP_TOOL_SIZE, PostToolbar, STYLE_HEIGHT, TOOL_SIZE } from "@/components/post/editor/PostToolbar";
import { LINK_SENTENCE } from "@/components/post/editor/FormatBar";
import { POST_LIMIT_SENTENCE } from "@/lib/build/threadEditor";
import { PREVIEW_NOTE, previewScale } from "@/lib/build/postPreview";
import type { ThreadDoc } from "@/lib/build/thread";
import type { Build } from "@/lib/build/types";

import { brk, doc, mountPostTab, p, startOf } from "./postTabKit";
import type { PostDraft } from "./PostTab";

// jsdom has no hit testing; ProseMirror asks for it when an element reports a size.
(document as unknown as { elementFromPoint: () => null }).elementFromPoint ??= () => null;

const MAKER = { id: "u1", name: "Ada Lovelace", handle: "ada", avatar: null };
const DRAFT: PostDraft = {
  build: { id: "b1", creator_id: "u1", slug: "engine", title: "Engine", made_with: ["Claude Code"], models_used: ["gpt-4o"] } as unknown as Build,
  title: "A bakery site",
  maker: MAKER,
};

const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const preview = () => screen.getByRole("region", { name: "Preview" });

/** The preview as a column, drawn on its own: the composer opens it as a sheet, the column is its other drawing. */
function column(content: ThreadDoc, draft: PostDraft = DRAFT) {
  return render(<PostPreview doc={content} build={draft.build} title={draft.title} maker={draft.maker} media={new Map()} src={new Map()} />);
}

/** Adds a break and a post after the last block, through the editor, as typing would. */
function addPost(editor: Editor, words: string) {
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size, [{ type: "postBreak" }, { type: "paragraph", content: [{ type: "text", text: words }] }]);
  });
}

function removeFirstBreak(editor: Editor) {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.type.name === "postBreak") at = pos;
    return false;
  });
  act(() => {
    editor.view.dispatch(editor.state.tr.delete(at, at + 1));
  });
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the preview", () => {
  it("is a column headed Preview with a Phone and Desktop switch 22 high on one line", () => {
    column(doc(p("Hello")));
    const region = preview();
    expect([region.style.flex, region.style.maxWidth, region.style.gap]).toEqual(["1 1 280px", "320px", "16px"]);
    const head = within(region).getByRole("heading", { name: "Preview" });
    expect([head.style.fontSize, head.style.fontWeight]).toEqual(["13.5px", "500"]);
    expect((head.parentElement as HTMLElement).style.flexWrap).toBe("nowrap");
    const switcher = within(region).getByRole("group", { name: "Preview width" });
    expect(switcher.style.height).toBe("22px");
    expect(within(switcher).getAllByRole("button").map((button) => button.textContent)).toEqual(["Phone", "Desktop"]);
  });

  it("draws the maker, the tool marks, the age now, post 1 closed, and the build line with Draft in place of the plaque", () => {
    column(doc(p("First post words"), brk, p("Second post words")));
    const item = within(preview()).getByRole("article");
    expect(within(item).getByTestId("feed-author-name").textContent).toBe("Ada Lovelace");
    expect(item.textContent).toContain("@ada · now");
    expect(within(item).getByRole("img", { name: "Made with Claude Code" })).toBeTruthy();
    expect(within(item).getByText("First post words")).toBeTruthy();
    expect(item.querySelector('[data-thread-mode="closed"]')).not.toBeNull();
    expect(within(item).getByRole("button", { name: /Show more/ }).textContent).toContain("1 more post");
    expect(within(item).getByTestId("feed-build-title").textContent).toBe("A bakery site");
    expect(within(item).getByTestId("feed-draft").textContent).toBe("Draft");
    // No plaque, no action row, nothing that links away.
    expect(item.querySelector("[data-plaque]")).toBeNull();
    expect(within(item).queryByRole("button", { name: /like|save|rebuild/i })).toBeNull();
    expect(within(item).queryByRole("link")).toBeNull();
  });

  it("says the note under a 1px line, 12 down, in 12px", () => {
    column(doc(p("Hello")));
    const note = screen.getByText(PREVIEW_NOTE);
    expect(PREVIEW_NOTE).toBe("Updates as you type. Everything above the first post break is what people see before Show more.");
    expect([note.style.fontSize, note.style.paddingTop]).toEqual(["12px", "12px"]);
    // jsdom drops a border written as var(), so the line is read from the markup as the server would send it.
    const html = renderToStaticMarkup(<PostPreview doc={doc(p("Hello"))} build={DRAFT.build} title="T" maker={MAKER} media={new Map()} src={new Map()} />);
    expect(html).toContain("border-top:1px solid var(--hairline)");
    expect(html).toContain("padding-top:12px");
    // No card, box or border around the item.
    const item = within(preview()).getByRole("article");
    expect(item.style.border).toBe("");
    expect(item.style.borderRadius).toBe("");
    expect(item.style.boxShadow).toBe("");
  });

  it("shows post 1 and the right count of more posts as breaks are added and removed, as the editor changes", () => {
    const { editor } = mountPostTab(doc(p("Alpha words")), {}, { draft: DRAFT });
    const sheet = () => screen.getByRole("dialog", { name: "Preview" });
    const look = () => {
      fireEvent.click(within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Preview" }));
      return within(sheet()).queryByRole("button", { name: /Show more/ });
    };
    const close = () => fireEvent.click(within(sheet()).getByRole("button", { name: "Close" }));
    expect(look()).toBeNull();
    expect(within(sheet()).getByText("Alpha words")).toBeTruthy();
    close();

    addPost(editor, "Beta words");
    expect(look()?.textContent).toContain("1 more post");
    close();

    addPost(editor, "Gamma words");
    addPost(editor, "Delta words");
    expect(look()?.textContent).toContain("3 more posts");
    close();

    removeFirstBreak(editor);
    expect(look()?.textContent).toContain("2 more posts");
    expect(json(editor).content.filter((block) => block.type === "postBreak")).toHaveLength(2);
  });

  it("opens the rest in place with Show more, asking for nothing", () => {
    column(doc(p("First"), brk, p("Second")));
    fireEvent.click(within(preview()).getByRole("button", { name: /Show more/ }));
    expect(within(preview()).getByRole("button", { name: /Show less/ })).toBeTruthy();
    expect(within(preview()).getByText("Second")).toBeTruthy();
  });

  it("follows the title as typed, and says Untitled build before there is one", () => {
    column(doc(p("Hello")), { ...DRAFT, title: "" });
    expect(within(preview()).getByTestId("feed-build-title").textContent).toBe("Untitled build");
  });

  it("switches between Phone and Desktop; Desktop is laid out at 628 and scaled to the column", () => {
    column(doc(p("Hello")));
    expect(preview().getAttribute("data-preview-width")).toBe("phone");
    expect(within(preview()).getByRole("button", { name: "Phone" }).getAttribute("aria-pressed")).toBe("true");
    expect(preview().querySelector("[data-preview-scaler]")).toBeNull();

    fireEvent.click(within(preview()).getByRole("button", { name: "Desktop" }));
    expect(preview().getAttribute("data-preview-width")).toBe("desktop");
    expect(within(preview()).getByRole("button", { name: "Desktop" }).getAttribute("aria-pressed")).toBe("true");
    const scaler = preview().querySelector("[data-preview-scaler]") as HTMLElement;
    const sized = scaler.firstElementChild as HTMLElement;
    expect(sized.style.width).toBe("628px");
    expect(sized.style.transformOrigin).toBe("top left");
    expect(sized.style.transform).toMatch(/^scale\(/);

    fireEvent.click(within(preview()).getByRole("button", { name: "Phone" }));
    expect(preview().querySelector("[data-preview-scaler]")).toBeNull();
  });

  it("scales by the column over 628, never above 1, and reserves the scaled height", () => {
    expect(previewScale(314)).toBe(0.5);
    expect(previewScale(320)).toBeCloseTo(0.5096, 3);
    expect(previewScale(900)).toBe(1);
    expect(previewScale(0)).toBe(1);

    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get");
    width.mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-preview-scaler") ? 314 : 0;
    });
    height.mockImplementation(function (this: HTMLElement) {
      return this.style.width === "628px" ? 400 : 0;
    });
    column(doc(p("Hello")));
    fireEvent.click(within(preview()).getByRole("button", { name: "Desktop" }));
    const scaler = preview().querySelector("[data-preview-scaler]") as HTMLElement;
    expect(scaler.getAttribute("data-scale")).toBe("0.500");
    expect((scaler.firstElementChild as HTMLElement).style.transform).toBe("scale(0.5)");
    expect(scaler.style.height).toBe("200px");
  });

  it("is the sheet's phone item alone, with no head and no note", () => {
    render(<PostPreview variant="sheet" doc={doc(p("Hello"))} build={DRAFT.build} title="T" maker={MAKER} media={new Map()} src={new Map()} />);
    expect(screen.queryByRole("heading", { name: "Preview" })).toBeNull();
    expect(screen.queryByText(PREVIEW_NOTE)).toBeNull();
    expect(screen.getByTestId("post-preview").getAttribute("data-preview-width")).toBe("phone");
  });

  it("is not drawn beside the composer on either width: X's composer has no preview column", () => {
    mountPostTab(doc(p("Hello")), {}, { draft: DRAFT });
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
    cleanup();
    mountPostTab(doc(p("Hello")), { phone: true }, { draft: DRAFT });
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
  });
});

describe("the preview sheet", () => {
  it("opens from the toolbar's Preview on both widths, as a sheet titled Preview holding the phone item", () => {
    for (const phone of [false, true]) {
      mountPostTab(doc(p("First"), brk, p("Second")), { phone }, { draft: DRAFT });
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Preview" }));
      const sheet = screen.getByRole("dialog", { name: "Preview" });
      expect(within(sheet).getByTestId("post-preview").getAttribute("data-preview-width")).toBe("phone");
      expect(within(sheet).getByTestId("feed-author-name").textContent).toBe("Ada Lovelace");
      cleanup();
    }
  });

  it("is held by the caller when it passes previewOpen", () => {
    mountPostTab(doc(p("First"), brk, p("Second")), { phone: true }, { draft: DRAFT, previewOpen: true, onPreviewOpenChange: vi.fn() });
    const sheet = screen.getByRole("dialog", { name: "Preview" });
    expect(within(sheet).getByRole("article")).toBeTruthy();
    expect(within(sheet).getByTestId("feed-author-name").textContent).toBe("Ada Lovelace");
    expect(within(sheet).getByRole("button", { name: /Show more/ }).textContent).toContain("1 more post");
  });

  it("is closed until it is asked for", () => {
    mountPostTab(doc(p("Hello")), { phone: true }, { draft: DRAFT });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks to close from its Close button", () => {
    const onPreviewOpenChange = vi.fn();
    mountPostTab(doc(p("Hello")), { phone: true }, { draft: DRAFT, previewOpen: true, onPreviewOpenChange });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Preview" })).getByRole("button", { name: "Close" }));
    expect(onPreviewOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("the toolbar", () => {
  const toolbar = () => screen.getByTestId("post-toolbar");
  const tools = () => within(toolbar()).getAllByRole("button");
  const press = (name: string) => fireEvent.click(within(toolbar()).getByRole("button", { name }));
  const mountDesk = (content = doc(p("hello world"), p("")), extra: Parameters<typeof mountPostTab>[2] = {}) => mountPostTab(content, {}, { draft: DRAFT, ...extra });
  const mountPhone = (content = doc(p("hello world"), p("")), extra: Parameters<typeof mountPostTab>[2] = {}) => mountPostTab(content, { phone: true }, { draft: DRAFT, ...extra });

  it("is X's row of buttons, in order, each named and 36 square on a desktop", () => {
    mountDesk();
    expect(tools().map((button) => button.getAttribute("aria-label"))).toEqual(["Picture or video", "Bulleted list", "Numbered list", "Text size", "Preview", "Add another post"]);
    for (const button of tools()) {
      // CA-07: the + is round and 32; every other tool is 36.
      const side = button.getAttribute("aria-label") === "Add another post" ? 32 : DESKTOP_TOOL_SIZE;
      expect([button.style.width, button.style.height]).toEqual([`${side}px`, `${side}px`]);
      expect(button.getAttribute("title")).toBe(button.getAttribute("aria-label"));
    }
    expect(DESKTOP_TOOL_SIZE).toBe(36);
    expect(within(toolbar()).getByRole("button", { name: "Text size" }).textContent).toBe("Aa");
  });

  it("is 44 square on a phone, with the same buttons", () => {
    mountPhone();
    expect(tools().map((button) => button.getAttribute("aria-label"))).toEqual(["Picture or video", "Bulleted list", "Numbered list", "Text size", "Preview", "Add another post"]);
    for (const button of tools()) expect([button.style.width, button.style.height]).toEqual([`${TOOL_SIZE}px`, `${TOOL_SIZE}px`]);
    expect(TOOL_SIZE).toBe(44);
  });

  it("sits under the words with no line above it, as X has none, in the page, never docked", () => {
    const { editor } = mountPhone();
    expect(toolbar().style.position).toBe("");
    // jsdom drops colours written as var(); the line is read from the markup.
    const html = renderToStaticMarkup(<PostToolbar editor={editor} phone onInsertPicture={vi.fn()} notice={vi.fn()} />);
    expect(html).not.toContain("border-top:1px solid var(--hairline)");
    expect(html).not.toContain("position:fixed");
  });

  it("asks for files with Picture or video (CA-07: Row of pictures is gone)", () => {
    const onInsertPicture = vi.fn();
    const { editor } = mountDesk(doc(p("")), { onInsertPicture });
    expect(within(toolbar()).queryByRole("button", { name: "Row of pictures" })).toBeNull();
    press("Picture or video");
    expect(onInsertPicture).toHaveBeenCalledWith(editor);
  });

  it("makes a bulleted and a numbered list, and sinks the one that is on", () => {
    const { editor } = mountDesk(doc(p("text")));
    act(() => {
      editor.commands.setTextSelection(2);
    });
    press("Bulleted list");
    expect(json(editor).content[0].type).toBe("bulletList");
    expect(within(toolbar()).getByRole("button", { name: "Bulleted list" }).getAttribute("aria-pressed")).toBe("true");
    press("Numbered list");
    expect(json(editor).content[0].type).toBe("orderedList");
  });

  it("keeps the editor focused: a press is a cancelled mouse-down", () => {
    mountDesk();
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    within(toolbar()).getByRole("button", { name: "Bulleted list" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the desktop's format bar off a phone", () => {
    const { editor } = mountPhone();
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
    });
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
  });

  describe("Text size", () => {
    it("opens a row of Title, Heading, Body, Small and Code, the current one selected", () => {
      const { editor } = mountPhone();
      act(() => {
        editor.commands.setTextSelection(3);
      });
      press("Text size");
      const row = screen.getByRole("group", { name: "Text size" });
      const buttons = within(row).getAllByRole("button");
      expect(buttons.map((button) => button.textContent)).toEqual(["Title", "Heading", "Body", "Small", "Code"]);
      for (const button of buttons) expect(button.style.height).toBe(`${STYLE_HEIGHT}px`);
      expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "false"]);
      expect(row.style.overflowX).toBe("auto");
      // Each in its own phone size.
      expect(within(row).getByText("Title").style.fontSize).toBe("24px");
      expect(within(row).getByText("Heading").style.fontSize).toBe("18px");
      expect(within(row).getByText("Body").style.fontSize).toBe("16px");
      expect(within(row).getByText("Small").style.fontSize).toBe("13px");
    });

    it("is 36 high on a desktop, with no Bold, Italic or Link: the bar over a selection has those", () => {
      mountDesk();
      press("Text size");
      for (const button of within(screen.getByRole("group", { name: "Text size" })).getAllByRole("button")) expect(button.style.height).toBe("36px");
      expect(screen.queryByRole("group", { name: "Format" })).toBeNull();
    });

    it("applies the style to the block, then closes", () => {
      const { editor } = mountPhone(doc(p("first"), p("second")));
      act(() => {
        editor.commands.setTextSelection(startOf(editor, 1) + 1);
      });
      const apply = (name: string) => {
        if (!screen.queryByRole("group", { name: "Text size" })) press("Text size");
        fireEvent.click(within(screen.getByRole("group", { name: "Text size" })).getByRole("button", { name }));
      };
      apply("Title");
      expect(json(editor).content[1]).toMatchObject({ type: "heading", attrs: { level: 1 } });
      expect(json(editor).content[0].type).toBe("paragraph");
      expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
      apply("Heading");
      expect(json(editor).content[1]).toMatchObject({ type: "heading", attrs: { level: 2 } });
      apply("Code");
      expect(json(editor).content[1].type).toBe("codeBlock");
      apply("Small");
      expect(json(editor).content[1]).toMatchObject({ type: "paragraph", attrs: { size: "small" } });
      apply("Body");
      expect(json(editor).content[1].type).toBe("paragraph");
      expect((json(editor).content[1] as { attrs?: { size?: string } }).attrs?.size ?? "body").toBe("body");
    });

    it("closes when Text size is pressed again", () => {
      mountPhone();
      press("Text size");
      expect(within(toolbar()).getByRole("button", { name: "Text size" }).getAttribute("aria-expanded")).toBe("true");
      press("Text size");
      expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
    });

    it("holds Bold, Italic, Underline and Link on a phone, and toggles the marks", () => {
      const { editor } = mountPhone(doc(p("hello world")));
      act(() => {
        editor.commands.setTextSelection({ from: 1, to: 6 });
      });
      press("Text size");
      const marks = screen.getByRole("group", { name: "Format" });
      expect(within(marks).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Bold", "Italic", "Underline", "Link"]);
      fireEvent.click(within(marks).getByRole("button", { name: "Bold" }));
      expect(editor.isActive("bold")).toBe(true);
      press("Text size");
      fireEvent.click(within(screen.getByRole("group", { name: "Format" })).getByRole("button", { name: "Italic" }));
      press("Text size");
      fireEvent.click(within(screen.getByRole("group", { name: "Format" })).getByRole("button", { name: "Underline" }));
      expect(editor.isActive("italic") && editor.isActive("underline")).toBe(true);
    });
  });

  describe("Link on a phone", () => {
    it("refuses an address that is not http, https or mailto, and links the selection otherwise", () => {
      const { editor } = mountPhone(doc(p("hello world")));
      act(() => {
        editor.commands.setTextSelection({ from: 1, to: 6 });
      });
      press("Text size");
      fireEvent.click(within(screen.getByRole("group", { name: "Format" })).getByRole("button", { name: "Link" }));
      const form = screen.getByRole("form", { name: "Link" });
      const field = within(form).getByRole("textbox", { name: "Link address" }) as HTMLInputElement;
      expect(field.style.fontSize).toBe("16px");
      fireEvent.change(field, { target: { value: "javascript:alert(1)" } });
      fireEvent.submit(form);
      expect(within(form).getByRole("alert").textContent).toBe(LINK_SENTENCE);
      expect(editor.isActive("link")).toBe(false);
      fireEvent.change(field, { target: { value: "https://example.com" } });
      fireEvent.submit(form);
      expect(editor.getAttributes("link").href).toBe("https://example.com");
      expect(screen.queryByRole("form", { name: "Link" })).toBeNull();
    });
  });

  describe("Add another post", () => {
    it("is off while the post the caret is in is empty, as X's + is", () => {
      mountDesk(doc(p("")));
      expect((within(toolbar()).getByRole("button", { name: "Add another post" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("adds a post after the one the caret is in, not in the middle of it, and puts the caret there", () => {
      const { editor } = mountDesk(doc(p("one"), p("one more"), brk, p("two")));
      act(() => {
        editor.commands.setTextSelection(2);
      });
      press("Add another post");
      expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "postBreak", "paragraph", "postBreak", "paragraph"]);
      expect(editor.state.selection.$from.index(0)).toBe(3);
      expect((within(toolbar()).getByRole("button", { name: "Add another post" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("makes the empty line after a list the new post's first line", () => {
      const { editor } = mountDesk(doc({ type: "bulletList", content: [{ type: "listItem", content: [p("item")] }] } as never, p("")));
      act(() => {
        editor.commands.setTextSelection(3);
      });
      press("Add another post");
      expect(json(editor).content.map((block) => block.type)).toEqual(["bulletList", "postBreak", "paragraph"]);
    });

    it("says why when the thread already holds ten posts", async () => {
      const posts = Array.from({ length: 9 }, (_, index) => [brk, p(`post ${index + 2}`)]).flat();
      mountDesk(doc(p("post 1"), ...posts));
      press("Add another post");
      expect(await screen.findByText(POST_LIMIT_SENTENCE)).toBeTruthy();
    });
  });
});
