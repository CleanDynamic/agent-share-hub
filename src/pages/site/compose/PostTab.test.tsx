// PT-05 — the composer's post, run in jsdom: what it allows, what survives a save, the breaks, the thread rail, the
// count and the layout.

import { act, cleanup, fireEvent, screen } from "@testing-library/react";
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
    expect(rows[0].getAttribute("aria-label")).toBe("Post 2 starts here");
    // A quiet line, as X has between posts: no rule, the label alone, 11.5 in --label.
    expect(rows[0].style.minHeight).toBe("20px");
    expect(rows[0].querySelectorAll("span[aria-hidden]")).toHaveLength(0);
    expect(rows[0].getAttribute("style")).not.toContain("dashed");
    const label = rows[0].firstElementChild as HTMLElement;
    expect(label.style.fontSize).toBe("11.5px");
    expect(label.getAttribute("style")).toContain("color:var(--label)");
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

describe("the thread rail", () => {
  it("draws the maker's avatar beside the first post, and one more for every post after it, as X does", () => {
    mount(doc(p("one"), brk, p("two"), brk, p("three")), {}, { draft: { build: null, title: "", maker: { id: "u1", name: "Sam Rivera", handle: "sam", avatar: null } } });
    const rail = screen.getByTestId("thread-rail");
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    const avatars = rail.querySelectorAll('[data-ui="avatar"]');
    expect(avatars).toHaveLength(3);
    expect(avatars[0].textContent).toBe("SR");
    expect((avatars[0] as HTMLElement).style.width).toBe("36px");
  });

  it("is one avatar for a one-post thread, 32 on a phone", () => {
    mount(doc(p("only")), { phone: true });
    const avatars = screen.getByTestId("thread-rail").querySelectorAll('[data-ui="avatar"]');
    expect(avatars).toHaveLength(1);
    expect((avatars[0] as HTMLElement).style.width).toBe("32px");
  });

  it("follows the posts as a break is added", () => {
    const { editor } = mount(doc(p("one")));
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size, [{ type: "postBreak" }, { type: "paragraph" }]);
    });
    expect(screen.getByTestId("thread-rail").querySelectorAll('[data-ui="avatar"]')).toHaveLength(2);
  });
});

describe("the layout", () => {
  it("is X's composer: the avatar, the words beside it, then the toolbar under the words; no outline and no preview column", () => {
    mount(doc(p("")));
    const tab = screen.getByTestId("post-tab");
    expect(tab.style.flexDirection).toBe("column");
    const row = tab.firstElementChild as HTMLElement;
    expect(row.style.gap).toBe("24px");
    expect(row.firstElementChild).toBe(screen.getByTestId("thread-rail"));
    expect(row.contains(document.querySelector('[contenteditable="true"]'))).toBe(true);
    const toolbar = screen.getByTestId("post-toolbar");
    expect((toolbar.parentElement as HTMLElement).style.marginLeft).toBe("60px");
    expect(screen.queryByRole("navigation", { name: "Posts" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
  });

  it("gives the toolbar the whole width on a phone, with 12 between the avatar and the words", () => {
    mount(doc(p("")), { phone: true });
    expect((screen.getByTestId("post-tab").firstElementChild as HTMLElement).style.gap).toBe("12px");
    expect((screen.getByTestId("post-toolbar").parentElement as HTMLElement).style.marginLeft).toBe("0px");
  });

  it("draws text in the published post's type", () => {
    mount(doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] }, p("body text"), { type: "paragraph", attrs: { size: "small" }, content: [{ type: "text", text: "tiny" }] }));
    const title = document.querySelector('[data-heading="1"]') as HTMLElement;
    expect(title.style.fontSize).toBe("28px");
    expect(title.style.fontWeight).toBe("500");
    expect((document.querySelector('[data-size="body"]') as HTMLElement).style.fontSize).toBe("16px");
    expect((document.querySelector('[data-size="small"]') as HTMLElement).style.fontSize).toBe("13px");
  });

  it("asks What did you build? in an empty first post, in --label", () => {
    mount(doc(p("")));
    const words = Array.from(document.querySelectorAll("[data-post-placeholder]")) as HTMLElement[];
    expect(words.map((word) => word.textContent)).toEqual(["What did you build?"]);
    expect(words[0].getAttribute("style")).toContain("color:var(--label)");
  });

  it("says Add another post in every empty post after the first, and nothing in an empty line under words", () => {
    mount(doc(p("written"), p(""), brk, p(""), brk, p("three"), brk, p("")));
    expect(Array.from(document.querySelectorAll("[data-post-placeholder]")).map((word) => word.textContent)).toEqual(["Add another post", "Add another post"]);
  });

  it("shows no words once the post has text", () => {
    mount(doc(p("written")));
    expect(document.querySelector("[data-post-placeholder]")).toBeNull();
  });
});
