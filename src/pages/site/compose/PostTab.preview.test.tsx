// PT-07 — the preview beside the editor, and the phone's toolbar.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostPreview } from "@/components/post/PostPreview";
import { PhoneToolbar, STYLE_HEIGHT, TextSizeRow, TOOL_SIZE } from "@/components/post/editor/PhoneToolbar";
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
  it("sits in the column beside the editor, headed Preview with a Phone and Desktop switch 22 high on one line", () => {
    mountPostTab(doc(p("Hello")), {}, { draft: DRAFT });
    const column = preview();
    expect([column.style.flex, column.style.maxWidth, column.style.gap]).toEqual(["1 1 280px", "320px", "16px"]);
    const head = within(column).getByRole("heading", { name: "Preview" });
    expect([head.style.fontSize, head.style.fontWeight]).toEqual(["13.5px", "500"]);
    expect((head.parentElement as HTMLElement).style.flexWrap).toBe("nowrap");
    const switcher = within(column).getByRole("group", { name: "Preview width" });
    expect(switcher.style.height).toBe("22px");
    expect(within(switcher).getAllByRole("button").map((button) => button.textContent)).toEqual(["Phone", "Desktop"]);
  });

  it("draws the maker, the tool marks, the age now, post 1 closed, and the build line with Draft in place of the plaque", () => {
    mountPostTab(doc(p("First post words"), brk, p("Second post words")), {}, { draft: DRAFT });
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
    mountPostTab(doc(p("Hello")), {}, { draft: DRAFT });
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
    const toggle = () => within(preview()).queryByRole("button", { name: /Show more/ });
    expect(toggle()).toBeNull();
    expect(within(preview()).getByText("Alpha words")).toBeTruthy();

    addPost(editor, "Beta words");
    expect(toggle()?.textContent).toContain("1 more post");
    expect(toggle()?.textContent).not.toContain("posts");

    addPost(editor, "Gamma words");
    addPost(editor, "Delta words");
    expect(toggle()?.textContent).toContain("3 more posts");
    expect(within(preview()).getByText("Alpha words")).toBeTruthy();

    removeFirstBreak(editor);
    expect(toggle()?.textContent).toContain("2 more posts");
    expect(json(editor).content.filter((block) => block.type === "postBreak")).toHaveLength(2);
  });

  it("opens the rest in place with Show more, asking for nothing", () => {
    mountPostTab(doc(p("First"), brk, p("Second")), {}, { draft: DRAFT });
    fireEvent.click(within(preview()).getByRole("button", { name: /Show more/ }));
    expect(within(preview()).getByRole("button", { name: /Show less/ })).toBeTruthy();
    expect(within(preview()).getByText("Second")).toBeTruthy();
  });

  it("follows the title as typed, and says Untitled build before there is one", () => {
    mountPostTab(doc(p("Hello")), {}, { draft: { ...DRAFT, title: "" } });
    expect(within(preview()).getByTestId("feed-build-title").textContent).toBe("Untitled build");
  });

  it("switches between Phone and Desktop; Desktop is laid out at 628 and scaled to the column", () => {
    mountPostTab(doc(p("Hello")), {}, { draft: DRAFT });
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
    mountPostTab(doc(p("Hello")), {}, { draft: DRAFT });
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

  it("is not in the column on a phone", () => {
    mountPostTab(doc(p("Hello")), { phone: true }, { draft: DRAFT });
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
  });
});

describe("the preview sheet on a phone", () => {
  it("opens as a sheet titled Preview holding the phone item", () => {
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

describe("the phone toolbar", () => {
  const toolbar = () => screen.getByRole("group", { name: "Format" });
  const mountPhone = (content = doc(p("hello world"), p("")), extra: Parameters<typeof mountPostTab>[2] = {}) => mountPostTab(content, { phone: true }, { draft: DRAFT, ...extra });

  it("has eight named buttons, in order, each 44 square", () => {
    mountPhone();
    const buttons = within(toolbar()).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Text size", "Bold", "Italic", "Underline", "Bulleted list", "Numbered list", "Link", "Add"]);
    for (const button of buttons) expect([button.style.width, button.style.height]).toEqual([`${TOOL_SIZE}px`, `${TOOL_SIZE}px`]);
    expect(TOOL_SIZE).toBe(44);
    expect(within(toolbar()).getByRole("button", { name: "Text size" }).textContent).toBe("Aa");
  });

  it("spreads across the width with 8px at the sides, 4 above and 12 below, on the module with a top border and the sheet shadow", () => {
    const { editor } = mountPhone();
    const row = within(toolbar()).getByRole("button", { name: "Bold" }).parentElement as HTMLElement;
    expect([row.style.justifyContent, row.style.padding]).toEqual(["space-between", "4px 8px 12px"]);
    expect([toolbar().style.left, toolbar().style.right, toolbar().style.position]).toEqual(["0px", "0px", "fixed"]);
    // jsdom drops colours written as var(); the toolbar's skin is read from the markup.
    const html = renderToStaticMarkup(<PhoneToolbar editor={editor} onInsertPicture={vi.fn()} notice={vi.fn()} />);
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("border-top:1px solid var(--hairline)");
    expect(html).toContain("box-shadow:var(--sheet-shadow)");
  });

  it("is not drawn on a desktop, nor is the desktop's format bar drawn on a phone", () => {
    mountPostTab(doc(p("hello world")), {}, { draft: DRAFT });
    expect(screen.queryByRole("group", { name: "Format" })).toBeNull();
    cleanup();
    const { editor } = mountPhone();
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
    });
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
  });

  it("toggles Bold, Italic, Underline and the two lists on the block, and sinks the buttons that are on", () => {
    const { editor } = mountPhone(doc(p("hello world")));
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
    });
    const press = (name: string) => fireEvent.click(within(toolbar()).getByRole("button", { name }));
    press("Bold");
    expect(editor.isActive("bold")).toBe(true);
    expect(within(toolbar()).getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    press("Italic");
    press("Underline");
    expect(editor.isActive("italic") && editor.isActive("underline")).toBe(true);
    press("Bulleted list");
    expect(json(editor).content[0].type).toBe("bulletList");
    press("Numbered list");
    expect(json(editor).content[0].type).toBe("orderedList");
  });

  it("keeps the editor focused: a press is a cancelled mouse-down", () => {
    mountPhone();
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    within(toolbar()).getByRole("button", { name: "Bold" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  describe("Text size", () => {
    it("opens a row of Title, Heading, Body, Small and Code, 52 high, the current one selected", () => {
      const { editor } = mountPhone();
      act(() => {
        editor.commands.setTextSelection(3);
      });
      fireEvent.click(within(toolbar()).getByRole("button", { name: "Text size" }));
      const row = screen.getByRole("group", { name: "Text size" });
      const buttons = within(row).getAllByRole("button");
      expect(buttons.map((button) => button.textContent)).toEqual(["Title", "Heading", "Body", "Small", "Code"]);
      for (const button of buttons) expect(button.style.height).toBe(`${STYLE_HEIGHT}px`);
      expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "false"]);
      expect(row.style.padding).toBe("12px 8px 8px");
      expect(row.style.overflowX).toBe("auto");
      expect(renderToStaticMarkup(<TextSizeRow editor={editor} current="Body" onDone={vi.fn()} />)).toContain("border-bottom:1px solid var(--hairline)");
      // Each in its own phone size.
      expect(within(row).getByText("Title").style.fontSize).toBe("24px");
      expect(within(row).getByText("Heading").style.fontSize).toBe("18px");
      expect(within(row).getByText("Body").style.fontSize).toBe("16px");
      expect(within(row).getByText("Small").style.fontSize).toBe("13px");
    });

    it("applies the style to the block, then closes", () => {
      const { editor } = mountPhone(doc(p("first"), p("second")));
      act(() => {
        editor.commands.setTextSelection(startOf(editor, 1) + 1);
      });
      const apply = (name: string) => {
        if (!screen.queryByRole("group", { name: "Text size" })) fireEvent.click(within(toolbar()).getByRole("button", { name: "Text size" }));
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
      const button = within(toolbar()).getByRole("button", { name: "Text size" });
      fireEvent.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(button);
      expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
    });
  });

  describe("Link", () => {
    it("refuses an address that is not http, https or mailto, and links the selection otherwise", () => {
      const { editor } = mountPhone(doc(p("hello world")));
      act(() => {
        editor.commands.setTextSelection({ from: 1, to: 6 });
      });
      fireEvent.click(within(toolbar()).getByRole("button", { name: "Link" }));
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

  describe("Add", () => {
    const open = () => {
      fireEvent.click(within(toolbar()).getByRole("button", { name: "Add" }));
      return screen.getByRole("dialog", { name: "Add" });
    };

    it("opens a sheet of Picture or video, Row of pictures, Bulleted list, Numbered list and New post", () => {
      mountPhone();
      const sheet = open();
      expect(within(sheet).getAllByRole("button").filter((button) => button.getAttribute("aria-label") !== "Close").map((button) => button.querySelector("span")?.textContent)).toEqual([
        "Picture or video",
        "Row of pictures",
        "Bulleted list",
        "Numbered list",
        "New post",
      ]);
    });

    it("asks for files with Picture or video and Row of pictures", async () => {
      const onInsertPicture = vi.fn();
      const { editor } = mountPhone(doc(p("")), { onInsertPicture });
      fireEvent.click(within(open()).getByRole("button", { name: /Row of pictures/ }));
      await waitFor(() => expect(onInsertPicture).toHaveBeenCalledWith("row", editor));
      fireEvent.click(within(open()).getByRole("button", { name: /Picture or video/ }));
      await waitFor(() => expect(onInsertPicture).toHaveBeenCalledWith("single", editor));
    });

    it("makes a list, and starts a new post after the block the caret is in", async () => {
      const { editor } = mountPhone(doc(p("text")));
      fireEvent.click(within(open()).getByRole("button", { name: /Bulleted list/ }));
      await waitFor(() => expect(json(editor).content[0].type).toBe("bulletList"));
      fireEvent.click(within(open()).getByRole("button", { name: /Numbered list/ }));
      await waitFor(() => expect(json(editor).content[0].type).toBe("orderedList"));
      fireEvent.click(within(open()).getByRole("button", { name: /New post/ }));
      await waitFor(() => expect(json(editor).content.map((block) => block.type)).toEqual(["orderedList", "postBreak", "paragraph"]));
    });

    it("says why when the thread already holds ten posts", async () => {
      const posts = Array.from({ length: 9 }, (_, index) => [brk, p(`post ${index + 2}`)]).flat();
      mountPhone(doc(p("post 1"), ...posts));
      fireEvent.click(within(open()).getByRole("button", { name: /New post/ }));
      expect(await screen.findByText(POST_LIMIT_SENTENCE)).toBeTruthy();
    });
  });

  describe("above the keyboard", () => {
    function viewport(height: number, offsetTop = 0) {
      const listeners: Record<string, Set<() => void>> = {};
      const mock = {
        height,
        offsetTop,
        addEventListener: (type: string, fn: () => void) => (listeners[type] ??= new Set()).add(fn),
        removeEventListener: (type: string, fn: () => void) => listeners[type]?.delete(fn),
      };
      vi.stubGlobal("visualViewport", mock);
      Object.defineProperty(window, "visualViewport", { configurable: true, value: mock });
      return {
        set(next: { height?: number; offsetTop?: number }) {
          Object.assign(mock, next);
          act(() => {
            for (const type of ["resize", "scroll"]) listeners[type]?.forEach((fn) => fn());
          });
        },
      };
    }

    beforeEach(() => {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    });
    afterEach(() => {
      Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    });

    it("sits at the bottom when nothing covers the page", () => {
      viewport(800);
      mountPhone();
      expect(toolbar().style.bottom).toBe("0px");
    });

    it("rides up by what the keyboard covers, and follows it as it opens, resizes and closes", () => {
      const keyboard = viewport(800);
      mountPhone();
      keyboard.set({ height: 500 });
      expect(toolbar().style.bottom).toBe("300px");
      keyboard.set({ height: 440 });
      expect(toolbar().style.bottom).toBe("360px");
      keyboard.set({ height: 800 });
      expect(toolbar().style.bottom).toBe("0px");
    });

    it("counts the visual viewport's scroll, as a page scrolled under the keyboard moves it", () => {
      const keyboard = viewport(500);
      mountPhone();
      expect(toolbar().style.bottom).toBe("300px");
      keyboard.set({ offsetTop: 120 });
      expect(toolbar().style.bottom).toBe("180px");
    });

    it("never goes below the bottom, and needs no visualViewport", () => {
      const keyboard = viewport(900);
      mountPhone();
      expect(toolbar().style.bottom).toBe("0px");
      keyboard.set({ height: 800, offsetTop: 50 });
      expect(toolbar().style.bottom).toBe("0px");
      cleanup();
      Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
      mountPhone();
      expect(toolbar().style.bottom).toBe("0px");
    });
  });
});
