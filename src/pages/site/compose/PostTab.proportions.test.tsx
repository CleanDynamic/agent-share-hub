// CA-07 P1 — the composer's post in X's proportions: the type, the avatar and the gap beside it, the posts that fade
// back, the row that adds a post, the remove button and the character ring.

import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CharacterRing, RING_SIZE } from "@/components/post/editor/PostToolbar";
import { DIM_MS, DIMMED_OPACITY } from "@/components/post/editor/extensions";
import { postType } from "@/components/post/postType";
import { MAX_THREAD_POSTS, type ThreadDoc } from "@/lib/build/thread";
import { postRuns } from "@/lib/build/threadEditor";
import { render } from "@testing-library/react";

import { FIRST_LINE_DROP, RAIL_AVATAR, RAIL_GAP } from "./PostTab";
import { brk, doc, mountPostTab as mount, p, startOf } from "./postTabKit";

const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock("@/lib/theme/motion", async (original) => ({ ...(await original<typeof import("@/lib/theme/motion")>()), prefersReducedMotion: () => motion.reduce }));

afterEach(() => {
  cleanup();
  motion.reduce = false;
});

const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const breaks = (editor: Editor) => json(editor).content.filter((block) => block.type === "postBreak").length;
const topBlocks = () => Array.from((document.querySelector('[contenteditable="true"]') as HTMLElement).children) as HTMLElement[];
const avatarSlots = () => Array.from(screen.getByTestId("thread-rail").querySelectorAll("[data-rail-avatar]")) as HTMLElement[];

function focusAt(editor: Editor, index: number) {
  act(() => {
    editor.commands.setTextSelection(startOf(editor, index));
    // TipTap's focus waits a frame; the plugin listens for the element's own focus event.
    (editor.view.dom as HTMLElement).dispatchEvent(new FocusEvent("focus"));
  });
}

describe("sizes", () => {
  it("sets the composer's words at 20 / 1.25, 18 on a phone, and leaves the readers' body as it was", () => {
    expect([postType(false).composer.fontSize, postType(false).composer.lineHeight]).toEqual([20, 1.25]);
    expect([postType(true).composer.fontSize, postType(true).composer.lineHeight]).toEqual([18, 1.25]);
    expect([postType(false).body.fontSize, postType(false).body.lineHeight]).toEqual([16, 1.55]);
    mount(doc(p("words")), { phone: true });
    expect((document.querySelector('[data-size="body"]') as HTMLElement).style.fontSize).toBe("18px");
  });

  it("draws a list in the composer's size too", () => {
    mount(doc({ type: "bulletList", content: [{ type: "listItem", content: [p("one") as never] }] } as never));
    expect((document.querySelector("ul") as HTMLElement).style.fontSize).toBe("20px");
  });

  it("is a 40 avatar (36 on a phone), 12 from the words on both, the first line 8 below the avatar's top", () => {
    expect(RAIL_AVATAR).toEqual({ desktop: 40, phone: 36 });
    expect(RAIL_GAP).toEqual({ desktop: 12, phone: 12 });
    expect(FIRST_LINE_DROP).toBe(8);
    mount(doc(p("words")));
    expect(screen.getByTestId("post-words").style.paddingTop).toBe("8px");
  });
});

describe("the posts not being written", () => {
  const three = doc(p("one"), brk, p("two"), brk, p("three"));

  it("fade to half strength while the second is written: their words, their avatars and their part of the line", () => {
    const { editor } = mount(three);
    focusAt(editor, 2);
    const [first, , second, , third] = topBlocks();
    expect(first.hasAttribute("data-dimmed")).toBe(true);
    expect(first.style.opacity).toBe(String(DIMMED_OPACITY));
    expect(second.hasAttribute("data-dimmed")).toBe(false);
    expect(third.style.opacity).toBe("0.5");
    expect(avatarSlots().map((slot) => slot.style.opacity)).toEqual(["0.5", "1", "0.5"]);
  });

  it("follow the selection into another post", () => {
    const { editor } = mount(three);
    focusAt(editor, 2);
    focusAt(editor, 4);
    const blocks = topBlocks();
    expect([blocks[0], blocks[2], blocks[4]].map((block) => block.hasAttribute("data-dimmed"))).toEqual([true, true, false]);
    expect(avatarSlots().map((slot) => slot.style.opacity)).toEqual(["0.5", "0.5", "1"]);
  });

  it("are at full strength again once the editor loses focus", () => {
    const { editor } = mount(three);
    focusAt(editor, 2);
    act(() => {
      editor.commands.blur();
      (editor.view.dom as HTMLElement).dispatchEvent(new FocusEvent("blur"));
    });
    expect(topBlocks().some((block) => block.hasAttribute("data-dimmed"))).toBe(false);
    expect(avatarSlots().map((slot) => slot.style.opacity)).toEqual(["1", "1", "1"]);
  });

  it("fade over 150ms, and with no transition when less motion is asked for", () => {
    const { editor, view } = mount(three);
    focusAt(editor, 2);
    expect(topBlocks()[0].style.transition).toContain(`${DIM_MS}ms`);
    view.unmount();
    motion.reduce = true;
    const again = mount(three);
    focusAt(again.editor, 2);
    expect(topBlocks()[0].style.transition).toBe("none");
  });
});

describe("the row that adds a post", () => {
  it("is gone: only the toolbar's + starts another post", () => {
    mount(doc(p("one")));
    expect(screen.queryByTestId("add-post-row")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Add another post" })).toHaveLength(1);
  });
});

describe("removing a post", () => {
  it("is a 28 × at the right of the focused post's first line, only when there are two posts or more", () => {
    const one = mount(doc(p("only")));
    focusAt(one.editor, 0);
    expect(screen.queryByRole("button", { name: "Remove this post" })).toBeNull();
    one.view.unmount();
    const { editor } = mount(doc(p("one"), brk, p("two")));
    expect(screen.queryByRole("button", { name: "Remove this post" })).toBeNull();
    focusAt(editor, 2);
    const remove = screen.getByRole("button", { name: "Remove this post" });
    expect([remove.style.width, remove.style.right, remove.style.position]).toEqual(["28px", "0px", "absolute"]);
  });

  it("takes the post and the break before it out in one step, and Undo puts them back", () => {
    const { editor } = mount(doc(p("one"), brk, p("two"), brk, p("three")));
    focusAt(editor, 2);
    fireEvent.click(screen.getByRole("button", { name: "Remove this post" }));
    expect(editor.getText()).not.toContain("two");
    expect(breaks(editor)).toBe(1);
    // The caret is at the end of the post before.
    expect(editor.state.selection.$from.parent.textContent).toBe("one");
    expect(editor.state.selection.$from.parentOffset).toBe(3);
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).toContain("two");
    expect(breaks(editor)).toBe(2);
  });

  it("takes the break after it for the first post", () => {
    const { editor } = mount(doc(p("one"), brk, p("two")));
    focusAt(editor, 0);
    fireEvent.click(screen.getByRole("button", { name: "Remove this post" }));
    expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph"]);
    expect(editor.getText()).toBe("two");
  });
});

describe("the character ring", () => {
  it("sits between Preview and the divider, counting the post the caret is in", () => {
    const { editor } = mount(doc(p("a".repeat(10)), brk, p("b".repeat(990))), {}, { draft: { build: null, title: "", maker: null } });
    const toolbar = screen.getByTestId("post-toolbar");
    const ring = within(toolbar).getByTestId("character-ring");
    expect(ring.previousElementSibling?.getAttribute("aria-label")).toBe("Preview");
    expect((ring.nextElementSibling?.nextElementSibling as HTMLElement).getAttribute("aria-hidden")).toBe("true");
    focusAt(editor, 0);
    expect(within(toolbar).getByTestId("character-ring").getAttribute("aria-label")).toBe("990 characters left. Pictures do not count.");
    focusAt(editor, 2);
    expect(within(toolbar).getByTestId("character-ring").getAttribute("aria-label")).toBe("10 characters left. Pictures do not count.");
  });

  it("is 20 across, a --hairline track and a --text2 fill, the number inside from 20 left", () => {
    const { container, rerender } = render(<CharacterRing left={500} />);
    const ring = container.querySelector("[data-testid=character-ring]") as HTMLElement;
    expect(ring.style.width).toBe(`${RING_SIZE}px`);
    const [track, fill] = Array.from(ring.querySelectorAll("circle"));
    expect(track.getAttribute("style")).toContain("var(--hairline)");
    expect(fill.getAttribute("style")).toContain("var(--text2)");
    expect(ring.querySelector("[data-ring-number]")).toBeNull();
    rerender(<CharacterRing left={20} />);
    expect(container.querySelector("[data-ring-number]")?.textContent).toBe("20");
  });

  it("turns the error colour below 0, and speaks only at 20, 10 and 0", () => {
    const { container, rerender } = render(<CharacterRing left={21} />);
    const said = () => (container.querySelector("[data-testid=character-ring-said]") as HTMLElement).textContent;
    expect(said()).toBe("");
    rerender(<CharacterRing left={20} />);
    expect(said()).toBe("20 characters left. Pictures do not count.");
    rerender(<CharacterRing left={15} />);
    expect(said()).toBe("20 characters left. Pictures do not count.");
    rerender(<CharacterRing left={0} />);
    expect(said()).toBe("0 characters left. Pictures do not count.");
    rerender(<CharacterRing left={-3} />);
    // jsdom drops a var() colour from a React style, so the ring says which ink it chose.
    expect((container.querySelector("[data-testid=character-ring]") as HTMLElement).getAttribute("data-ink")).toBe("breakage");
    expect((container.querySelector("[data-ring-fill]") as SVGElement).getAttribute("style")).toContain("var(--breakage)");
  });
});

describe("the + button", () => {
  it("is round, 32, on the control recipe", () => {
    mount(doc(p("one")));
    const add = within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Add another post" });
    expect([add.style.width, add.style.borderRadius]).toEqual(["32px", "999px"]);
    expect(add.getAttribute("style")).toContain("var(--control-shadow)");
  });
});
