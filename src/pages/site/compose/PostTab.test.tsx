// PT-05 — the Post tab's editor, run in jsdom: what it allows, what survives a save, the breaks, the outline, the
// count and the layout.

import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkThread, THREAD_MARK_TYPES, THREAD_NODE_TYPES, type ThreadBlock, type ThreadDoc } from "@/lib/build/thread";
import { postRuns, tidyThread } from "@/lib/build/threadEditor";

import { brk, doc, mountPostTab as mount, p, startOf } from "./postTabKit";

afterEach(cleanup);

// jsdom has no ClipboardEvent; ProseMirror's pasteHTML makes one.
vi.stubGlobal(
  "ClipboardEvent",
  class extends Event {
    clipboardData = null;
  },
);

const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const types = (value: unknown, out = new Set<string>()): Set<string> => {
  if (value && typeof value === "object") {
    const node = value as { type?: string; content?: unknown[]; marks?: { type: string }[] };
    if (node.type) out.add(node.type);
    node.marks?.forEach((mark) => out.add(`mark:${mark.type}`));
    node.content?.forEach((child) => types(child, out));
  }
  return out;
};

describe("what the editor allows", () => {
  it("turns a pasted table, image and blockquote into plain paragraphs", () => {
    const { editor } = mount(doc(p("")));
    act(() => {
      editor.view.pasteHTML(
        '<table><tbody><tr><td>cell one</td><td>cell two</td></tr></tbody></table><blockquote>a quoted line</blockquote><img src="https://x.test/a.png" alt="a picture"><hr><p>plain <s>struck</s> <code>coded</code></p>',
      );
    });
    const result = json(editor);
    const seen = types(result);
    for (const name of seen) {
      if (name.startsWith("mark:")) expect(THREAD_MARK_TYPES.has(name.slice(5))).toBe(true);
      else expect(THREAD_NODE_TYPES.has(name)).toBe(true);
    }
    for (const gone of ["table", "tableRow", "tableCell", "blockquote", "image", "horizontalRule"]) expect(seen.has(gone)).toBe(false);
    const text = editor.getText();
    for (const kept of ["cell one", "cell two", "a quoted line", "plain", "struck", "coded"]) expect(text).toContain(kept);
    expect(checkThread(tidyThread(result))).toEqual([]);
  });

  it("drops a pasted link whose address is not http, https or mailto", () => {
    const { editor } = mount(doc(p("")));
    act(() => {
      editor.view.pasteHTML('<p><a href="javascript:alert(1)">bad</a> <a href="https://example.com/ok">good</a></p>');
    });
    const hrefs = JSON.stringify(json(editor));
    expect(hrefs).not.toContain("javascript:");
    expect(hrefs).toContain("https://example.com/ok");
  });

  it("offers a Title and a Heading, and no other level", () => {
    const { editor } = mount(doc(p("")));
    expect(editor.can().setHeading({ level: 1 })).toBe(true);
    expect(editor.can().setHeading({ level: 2 })).toBe(true);
    expect(editor.can().setHeading({ level: 3 as 1 })).toBe(false);
    expect("toggleBlockquote" in editor.commands).toBe(false);
    expect("toggleStrike" in editor.commands).toBe(false);
    expect("setHorizontalRule" in editor.commands).toBe(false);
    expect("toggleCode" in editor.commands).toBe(false);
  });
});

describe("saving and reopening", () => {
  const rich = doc(
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A title" }] },
    p("bold", [{ type: "bold" }]),
    p("italic", [{ type: "italic" }]),
    p("underlined", [{ type: "underline" }]),
    p("a link", [{ type: "link", attrs: { href: "https://example.com/page" } }]),
    { type: "paragraph", attrs: { size: "small" }, content: [{ type: "text", text: "small print" }] },
    { type: "bulletList", content: [{ type: "listItem", content: [p("one")] as never }, { type: "listItem", content: [p("two")] as never }] },
    { type: "orderedList", content: [{ type: "listItem", content: [p("first")] as never }] },
    { type: "codeBlock", content: [{ type: "text", text: "npm run build" }] },
    brk,
    p("second post"),
  );

  it("keeps bold, italic, underline, lists and links through what is saved and read back", () => {
    const first = mount(rich);
    const saved = tidyThread(json(first.editor));
    expect(checkThread(saved)).toEqual([]);
    cleanup();

    const again = mount(JSON.parse(JSON.stringify(saved)) as ThreadDoc);
    const back = tidyThread(json(again.editor));
    expect(back).toEqual(saved);
    const seen = types(back);
    for (const kept of ["mark:bold", "mark:italic", "mark:underline", "mark:link", "bulletList", "orderedList", "listItem", "codeBlock", "heading", "postBreak"]) expect(seen.has(kept)).toBe(true);
    expect(JSON.stringify(back)).toContain("https://example.com/page");
    expect(JSON.stringify(back)).toContain('"size":"small"');
  });

  it("stores a link as its address alone", () => {
    const { editor } = mount(rich);
    const link = JSON.stringify(json(editor)).match(/"type":"link","attrs":(\{[^}]*\})/)?.[1];
    expect(JSON.parse(link as string)).toEqual({ href: "https://example.com/page" });
  });

  it("keeps the pictures of a thread that already has them", () => {
    const picture = { type: "postMedia", attrs: { mediaId: "m1", width: 100, w: 800, h: 600, alt: "", caption: "" } } as ThreadBlock;
    const { editor } = mount(doc(p("above"), picture, brk, p("second")));
    const back = tidyThread(json(editor));
    expect(JSON.stringify(back)).toContain('"mediaId":"m1"');
    expect(back.content.map((block) => block.type)).toEqual(["paragraph", "postMedia", "postBreak", "paragraph"]);
  });

  it("reports an edit as the thread's JSON", () => {
    const { editor, thread } = mount(doc(p("")));
    act(() => {
      editor.commands.insertContent("hello");
    });
    expect(thread.onDoc).toHaveBeenCalled();
    const last = (thread.onDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as ThreadDoc;
    expect(JSON.stringify(last)).toContain("hello");
  });
});

describe("the post break", () => {
  const three = doc(p("one"), brk, p("two"), brk, p("three"));

  it("reads Post 2 with its note the first time, then just the number", () => {
    mount(three);
    const rows = Array.from(document.querySelectorAll("[data-post-break]")) as HTMLElement[];
    expect(rows.map((row) => row.textContent)).toEqual(["Post 2 · readers reach this with Show more", "Post 3"]);
    expect(rows[0].getAttribute("role")).toBe("separator");
    // 48 above the label is the editor's 12 gap, 24 of margin and 12 of padding; 32 below is the gap and 20.
    expect([rows[0].style.marginTop, rows[0].style.paddingTop, rows[0].style.marginBottom]).toEqual(["24px", "12px", "20px"]);
    expect(rows[0].style.gap).toBe("12px");
    const rules = rows[0].querySelectorAll("span[aria-hidden]");
    expect(rules).toHaveLength(2);
    expect(rules[0].getAttribute("style")).toContain("border-top-style:dashed");
    expect(rules[0].getAttribute("style")).toContain("border-top-color:var(--line)");
    expect((rows[0].querySelector("span:not([aria-hidden])") as HTMLElement).style.fontSize).toBe("12px");
  });

  it("is removed by Backspace at the start of the post after it, and the two posts become one", () => {
    const { editor, dom } = mount(three);
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 2));
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    const result = json(editor);
    expect(result.content.filter((block) => block.type === "postBreak")).toHaveLength(1);
    expect(postRuns(result)).toHaveLength(2);
    expect(postRuns(result)[0].blocks).toHaveLength(2);
    expect(editor.getText()).toContain("two");
  });

  it("is removed by Backspace when it is the selected thing", () => {
    const { editor, dom } = mount(three);
    act(() => {
      editor.commands.setNodeSelection(startOf(editor, 1) - 1);
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    expect(json(editor).content.filter((block) => block.type === "postBreak")).toHaveLength(1);
  });

  it("is not touched by Backspace in the middle of a post", () => {
    const { editor, dom } = mount(three);
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 2) + 1);
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    expect(json(editor).content.filter((block) => block.type === "postBreak")).toHaveLength(2);
  });
});

describe("the count", () => {
  it("shows only once a post passes 900, in --label, and turns --text over the limit", () => {
    mount(doc(p("x".repeat(899)), brk, p("y".repeat(912)), brk, p("z".repeat(1001))));
    const counts = Array.from(document.querySelectorAll("[data-post-count]")) as HTMLElement[];
    expect(counts.map((count) => count.textContent)).toEqual(["912 / 1,000", "1,001 / 1,000"]);
    expect(counts[0].getAttribute("style")).toContain("color:var(--label)");
    expect(counts[1].getAttribute("style")).toContain("color:var(--text)");
    expect(counts[0].style.fontSize).toBe("12px");
  });
});

describe("the outline", () => {
  const four = doc(p("Alpha post"), brk, p("Beta post"), brk, p("Gamma post"));
  const rowsOf = () => within(screen.getByRole("navigation", { name: "Posts" })).getAllByRole("button");

  it("lists the posts with their first words, the one the caret is in at 500", () => {
    const { editor } = mount(four);
    expect(rowsOf().map((row) => row.textContent)).toEqual(["1Alpha post", "2Beta post", "3Gamma post"]);
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 2) + 1);
    });
    const after = rowsOf();
    expect(after.map((row) => row.style.fontWeight)).toEqual(["400", "500", "400"]);
    expect(after[1].getAttribute("aria-current")).toBe("true");
    const nav = screen.getByRole("navigation", { name: "Posts" });
    expect(within(nav).getByText("Post 1 shows in the Gallery. A post break starts the next post. Drag a post here to reorder.")).toBeTruthy();
    expect(within(nav).getByRole("heading", { name: "Posts" })).toBeTruthy();
  });

  it("moves a post, its whole run of blocks, when its row is moved", () => {
    const { editor, thread } = mount(doc(p("Alpha post"), p("Alpha two"), brk, p("Beta post"), brk, p("Gamma post")));
    fireEvent.keyDown(rowsOf()[0], { key: "ArrowDown", altKey: true });
    expect(postRuns(json(editor)).map((run) => run.blocks.length)).toEqual([1, 2, 1]);
    expect(editor.getText()).toMatch(/Beta post[\s\S]*Alpha post[\s\S]*Alpha two[\s\S]*Gamma post/);
    expect(thread.onDoc).toHaveBeenCalled();
    expect(rowsOf().map((row) => row.textContent)).toEqual(["1Beta post", "2Alpha post", "3Gamma post"]);
  });

  it("does not move the first post up or the last down", () => {
    const { editor } = mount(four);
    const before = JSON.stringify(json(editor));
    fireEvent.keyDown(rowsOf()[0], { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(rowsOf()[2], { key: "ArrowDown", altKey: true });
    expect(JSON.stringify(json(editor))).toBe(before);
  });

  it("takes the caret to a post when its row is chosen", () => {
    const { editor } = mount(four);
    fireEvent.click(rowsOf()[2]);
    expect(editor.state.selection.$from.parent.textContent).toBe("Gamma post");
  });

  it("is not drawn on a phone, nor is the preview slot", () => {
    mount(four, { phone: true });
    expect(screen.queryByRole("navigation", { name: "Posts" })).toBeNull();
    expect(screen.queryByTestId("post-preview-slot")).toBeNull();
  });
});

describe("the layout", () => {
  it("is a wrapping row with 48 between, 12 above, the editor at most 628 wide and an empty slot for the preview", () => {
    mount(doc(p("")));
    const row = screen.getByTestId("post-tab");
    expect(row.style.flexWrap).toBe("wrap");
    expect(row.style.gap).toBe("48px");
    expect(row.style.paddingTop).toBe("12px");
    const editorColumn = document.querySelector('[contenteditable="true"]')?.parentElement?.parentElement as HTMLElement;
    expect(editorColumn.style.maxWidth).toBe("628px");
    expect(editorColumn.style.flex).toBe("999 1 520px");
    const nav = screen.getByRole("navigation", { name: "Posts" });
    expect(nav.style.flex).toBe("1 1 170px");
    expect(nav.style.maxWidth).toBe("190px");
    // PT-07 fills the slot: the preview, in the same 280 to 320 column.
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(preview.style.flex).toBe("1 1 280px");
    expect(preview.style.maxWidth).toBe("320px");
  });

  it("draws text in the published post's type", () => {
    mount(doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] }, p("body text"), { type: "paragraph", attrs: { size: "small" }, content: [{ type: "text", text: "tiny" }] }));
    const title = document.querySelector('[data-heading="1"]') as HTMLElement;
    expect(title.style.fontSize).toBe("28px");
    expect(title.style.fontWeight).toBe("500");
    expect((document.querySelector('[data-size="body"]') as HTMLElement).style.fontSize).toBe("16px");
    expect((document.querySelector('[data-size="small"]') as HTMLElement).style.fontSize).toBe("13px");
  });

  it("puts the words in an empty last paragraph, in --label", () => {
    mount(doc(p("")));
    const words = document.querySelector("[data-post-placeholder]") as HTMLElement;
    expect(words.textContent).toBe("Type / for a picture, a list, a row of pictures or a new post");
    expect(words.getAttribute("style")).toContain("color:var(--label)");
  });

  it("shows no words once the last paragraph has text", () => {
    mount(doc(p("written")));
    expect(document.querySelector("[data-post-placeholder]")).toBeNull();
  });
});
