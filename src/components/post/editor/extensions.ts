// extensions: what the composer's post editor is made of (PT-05).
//
// ONLY WHAT thread.ts ALLOWS. The nodes are paragraph (with a size), heading
// (levels 1 and 2: a Title and a Heading), codeBlock, bulletList, orderedList,
// listItem, hardBreak, postBreak, and postMedia and postMediaRow, which PT-06
// draws as the published post draws them, with a size control, a caption and
// a row of buttons. The marks are bold, italic, underline, link and ref (CA-06: words that point at a part).
// Blockquote, horizontal rule, strike, inline code and the other heading levels
// are switched off, so a table, an image or a quote pasted in arrives as plain
// paragraphs: the schema has nowhere else to put it.
//
// IT LOOKS LIKE THE PUBLISHED POST because it is drawn from the same numbers:
// every block takes its style from postType.ts, as PostBody does.
//
// ProseMirror draws these elements, not React, and the site has no stylesheet
// for them, so styles go on as style attributes and node views build their
// elements by hand. No class names.

import { Extension, Mark, mergeAttributes, Node as TipNode, ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection, Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { LIST_INDENT, LIST_ITEM_GAP, BLOCK_GAP, postType } from "@/components/post/postType";
import { countLabel, COUNT_SHOWN_FROM } from "@/lib/build/threadEditor";
import { linkAllowed, parseRefTo, POST_BODY_MAX } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";

import { GridView, type PictureOptions } from "./GridView";
import { picturePlugin, type PictureHost } from "./pictures";
import { focusRing } from "@/lib/theme/focus";
import { REF_COPY, refNumberStyle, refPaint, refWordsStyle, type RefPaint } from "@/components/post/RefLinks";

import { opensOnAt } from "./references";
import { applyStyle, styleString } from "./styleString";

/** The words in an empty first post, as X's composer asks "What's happening?". */
export const PLACEHOLDER = "What did you build?";

/** The words in an empty post after the first. */
export const NEXT_PLACEHOLDER = "Add another post";

/** Handles the React side hands the extensions. */
export interface PostEditorControls {
  /** The slash menu's key handler: true when it took the key. Null while the menu is closed. */
  slashKey: { current: ((event: KeyboardEvent) => boolean) | null };
  /** Opens the link popover over the selection: true when it did. Null while there is no format bar. */
  openLink: { current: (() => boolean) | null };
  /** The pictures: the store the node views read, and what the editor's uploads call back into (PT-06). */
  pictures: PictureHost;
  /** CA-06 P2: a typed @ opens the reference picker: true when it did. Null while the post links to nothing. */
  openRefs?: { current: ((typed: true) => boolean) | null };
  /** CA-06 P3: how each link is painted, and what pointing at one or clicking it does. Null: plain fills, no card. */
  refs?: { current: RefHandlers | null };
}

/** CA-06 P3: what the editor's links ask of the composer. */
export interface RefHandlers {
  paint: (to: string) => RefPaint;
  /** The words were clicked, or Enter pressed on them: bring the part in. */
  onGo: (to: string, el: HTMLElement) => void;
  /** The pointer came onto a link (el) or left it (null). */
  onHover: (to: string, el: HTMLElement | null) => void;
}

// --- breaks -------------------------------------------------------------------

/**
 * Backspace on a break, or at the start of the post after one: the break goes
 * and the two posts are one. The text of the post after is not touched.
 */
export function removeBreakBefore(editor: Editor): boolean {
  const { state } = editor;
  const { selection } = state;

  if (selection instanceof NodeSelection && selection.node.type.name === "postBreak") {
    return editor
      .chain()
      .command(({ tr }) => {
        tr.delete(selection.from, selection.to);
        return true;
      })
      .run();
  }

  if (!selection.empty) return false;
  const { $from } = selection;
  if ($from.depth !== 1 || $from.parentOffset !== 0) return false;
  const index = $from.index(0);
  if (index === 0) return false;
  const before = state.doc.child(index - 1);
  if (before.type.name !== "postBreak") return false;
  const at = $from.before(1) - before.nodeSize;
  return editor
    .chain()
    .command(({ tr }) => {
      tr.delete(at, at + before.nodeSize);
      return true;
    })
    .run();
}

// CA-07: no words between posts, as X's thread composer has none. The break keeps its name for a screen reader ("Post 2
// starts here") and draws nothing: 0 high, pulled up 4 so the next post's avatar sits 12 under the post before it (the
// editor's 12 gap above and below, less the 4, less the 8 the words sit below the avatar's top). The avatar and the
// thread line beside the next post are drawn by the composer's rail (ThreadRail), which reads where each break ends.
const breakRow = { display: "block", height: 0, marginTop: -4, userSelect: "none" } as const;

/** The number a break's decoration carries, or 0. */
function numberOf(decorations: readonly { spec?: { postNumber?: number } }[]): number {
  for (const decoration of decorations) if (typeof decoration.spec?.postNumber === "number") return decoration.spec.postNumber;
  return 0;
}

function breakView(initial: readonly { spec?: { postNumber?: number } }[]) {
  const dom = document.createElement("div");
  dom.setAttribute("data-post-break", "");
  dom.setAttribute("role", "separator");
  dom.contentEditable = "false";
  applyStyle(dom, breakRow);

  let shown = -1;
  const show = (number: number) => {
    if (number === shown) return;
    shown = number;
    dom.setAttribute("data-post-number", String(number));
    dom.setAttribute("aria-label", `Post ${number} starts here`);
  };
  show(numberOf(initial));

  return {
    dom,
    update(node: { type: { name: string } }, decorations: readonly { spec?: { postNumber?: number } }[]) {
      if (node.type.name !== "postBreak") return false;
      show(numberOf(decorations));
      return true;
    },
    ignoreMutation: () => true,
  };
}

/** A line between two posts. Atom, so Backspace and arrow keys treat it as one thing. */
export const PostBreak = TipNode.create({
  name: "postBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML: () => [{ tag: "div[data-post-break]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ "data-post-break": "" }, HTMLAttributes)],

  addNodeView() {
    return ({ decorations }) => breakView(decorations as never);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("postBreakNumbers"),
        props: {
          // The first break starts Post 2. The number rides on a decoration so a break's label
          // follows the posts when one is added, removed or moved before it.
          decorations: (state) => {
            const found: Decoration[] = [];
            let number = 1;
            state.doc.forEach((node, offset) => {
              if (node.type.name !== "postBreak") return;
              number += 1;
              found.push(Decoration.node(offset, offset + node.nodeSize, {}, { postNumber: number }));
            });
            return DecorationSet.create(state.doc, found);
          },
        },
      }),
    ];
  },
});

// --- the post being written (CA-07) -------------------------------------------------

/** Posts the writer is not in fade back to this, as X's thread composer does. */
export const DIMMED_OPACITY = 0.5;
/** How long the fade takes; none under reduced motion. */
export const DIM_MS = 150;

export const postFocusKey = new PluginKey<{ focused: boolean }>("postFocus");

/** The post (counting from 0, breaks included) that holds the top-level block at `index`. */
export function postOfIndex(doc: { forEach: (fn: (node: { type: { name: string } }, offset: number, index: number) => void) => void }, index: number): number {
  let post = 0;
  let found = 0;
  doc.forEach((node, _offset, at) => {
    if (at > index) return;
    if (node.type.name === "postBreak" && at < index) post += 1;
    if (at === index) found = node.type.name === "postBreak" ? post + 1 : post;
  });
  return found;
}

/** The post the selection is in, or -1 while the editor does not have focus. */
export function focusedPost(state: EditorState): number {
  if (!postFocusKey.getState(state)?.focused) return -1;
  const { selection, doc } = state;
  const index = selection.$from.depth > 0 || selection instanceof NodeSelection ? selection.$from.index(0) : doc.childCount - 1;
  return postOfIndex(doc, Math.max(0, Math.min(index, doc.childCount - 1)));
}

/** The transition the fading parts take: 150ms, or none when the reader asked for less motion. */
export function dimTransition(): string {
  return prefersReducedMotion() ? "none" : `opacity ${DIM_MS}ms ${STANDARD}`;
}

/**
 * Every top-level block outside the post holding the selection is drawn at half strength, while the editor has focus.
 * A decoration, so nothing in the document changes; `data-dimmed` marks it (the editor has no stylesheet for a class).
 */
const PostFocus = Extension.create({
  name: "postFocus",
  addProseMirrorPlugins() {
    return [
      new Plugin<{ focused: boolean }>({
        key: postFocusKey,
        state: {
          init: () => ({ focused: false }),
          apply: (tr, value) => {
            const meta = tr.getMeta(postFocusKey) as { focused: boolean } | undefined;
            return meta ?? value;
          },
        },
        props: {
          handleDOMEvents: {
            focus: (view) => {
              view.dispatch(view.state.tr.setMeta(postFocusKey, { focused: true }).setMeta("addToHistory", false));
              return false;
            },
            blur: (view) => {
              view.dispatch(view.state.tr.setMeta(postFocusKey, { focused: false }).setMeta("addToHistory", false));
              return false;
            },
          },
          decorations: (state) => {
            const current = focusedPost(state);
            if (current < 0) return null;
            const found: Decoration[] = [];
            const style = styleString({ opacity: DIMMED_OPACITY, transition: dimTransition() });
            let post = 0;
            state.doc.forEach((node, offset) => {
              if (node.type.name === "postBreak") {
                post += 1;
                return;
              }
              if (post !== current) found.push(Decoration.node(offset, offset + node.nodeSize, { "data-dimmed": "", style }));
            });
            return DecorationSet.create(state.doc, found);
          },
        },
      }),
    ];
  },
});

// --- pictures (PT-06, CA-07) ---------------------------------------------------------

/**
 * A picture or video. CA-07: only ever inside a postMediaGrid, which draws it; it has no view of its own. `uploadId` is
 * the editor's mark on a picture still uploading, never drawn into HTML and never stored (tidyThread drops it when it
 * is null; the save waits while the picture has no mediaId).
 */
export const PostMediaNode = TipNode.create<PictureOptions>({
  name: "postMedia",
  atom: true,
  selectable: false,
  draggable: false,

  addOptions() {
    return { host: null as unknown as PictureHost, phone: false };
  },

  addAttributes() {
    return {
      mediaId: { default: "" },
      width: { default: 100 },
      w: { default: null },
      h: { default: null },
      alt: { default: "" },
      crop: { default: null },
      aspect: { default: null },
      zoom: { default: null },
      warn: { default: [] },
      caption: { default: "" },
      uploadId: { default: null, rendered: false },
      failed: { default: false, rendered: false },
    };
  },

  parseHTML: () => [],
  renderHTML: ({ node }) => ["figure", { "data-post-media": String(node.attrs.mediaId ?? "") }],
});

/**
 * CA-07: a post's pictures, one block after its words. An atom the caret steps over, drawn whole by its React view
 * (GridView), which owns every key, click and drag inside it: ProseMirror draws none of its children and ignores their
 * events. `postMedia+`, not {1,4}, so an old post with five still opens; checkThread names the fifth.
 */
export const PostMediaGridNode = TipNode.create<PictureOptions>({
  name: "postMediaGrid",
  group: "block",
  content: "postMedia+",
  atom: true,
  isolating: true,
  selectable: false,
  draggable: false,

  addOptions() {
    return { host: null as unknown as PictureHost, phone: false };
  },

  addAttributes() {
    return { step: { default: null } };
  },

  parseHTML: () => [],
  renderHTML: () => ["div", { "data-post-media-grid": "" }],

  addNodeView() {
    const make = ReactNodeViewRenderer(GridView, { stopEvent: () => true, ignoreMutation: () => true });
    return (props) => {
      const view = make(props) as unknown as Record<string, unknown>;
      // The view draws the pictures itself; ProseMirror is given nowhere to draw them.
      Object.defineProperty(view, "contentDOM", { get: () => null });
      return view as never;
    };
  },

  addProseMirrorPlugins() {
    return [gridShapePlugin()];
  },
});

/**
 * Keeps each post's pictures in one grid at its end: two grids in a post become one, words typed or pasted after the
 * grid move before it, a grid with nothing in it goes, and a post that is only pictures gets an empty line before them
 * (where its placeholder sits). One fix per pass, until there is nothing to fix.
 */
export function gridShapePlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("postGridShape"),
    appendTransaction: (transactions, _old, state) => {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const tr = state.tr;
      for (let pass = 0; pass < 40; pass++) {
        if (!fixGridShape(tr)) break;
      }
      // An appended transaction joins the history event of the one it follows, so Undo takes both back together.
      return tr.docChanged ? tr : null;
    },
  });
}

/** One fix to the shape, or false when there is none. */
export function fixGridShape(tr: Transaction): boolean {
  const { doc } = tr;
  const { schema } = doc.type;
  type Slot = { node: PMNode; pos: number };
  const posts: Slot[][] = [[]];
  doc.forEach((node, pos) => {
    if (node.type.name === "postBreak") posts.push([]);
    else posts[posts.length - 1].push({ node, pos });
  });
  for (const blocks of posts) {
    const grids = blocks.filter((slot) => slot.node.type.name === "postMediaGrid");
    if (grids.length === 0) continue;
    const empty = grids.find((slot) => slot.node.childCount === 0);
    if (empty) {
      tr.delete(empty.pos, empty.pos + empty.node.nodeSize);
      return true;
    }
    if (grids.length > 1) {
      const [first, second] = grids;
      const children: PMNode[] = [];
      second.node.forEach((child) => children.push(child));
      const step = first.node.attrs.step ?? second.node.attrs.step ?? null;
      tr.delete(second.pos, second.pos + second.node.nodeSize);
      const at = tr.mapping.map(first.pos);
      tr.insert(at + first.node.nodeSize - 1, children);
      if (step !== first.node.attrs.step) tr.setNodeMarkup(at, undefined, { ...first.node.attrs, step });
      return true;
    }
    const grid = grids[0];
    const last = blocks[blocks.length - 1];
    if (last !== grid) {
      const end = last.pos + last.node.nodeSize;
      tr.insert(end, grid.node.copy(grid.node.content));
      tr.delete(grid.pos, grid.pos + grid.node.nodeSize);
      return true;
    }
    if (blocks.length === 1) {
      tr.insert(grid.pos, schema.nodes.paragraph.create());
      return true;
    }
  }
  return false;
}

/** Files dropped on the editor or pasted into it become pictures; a block dragged inside it is moved. */
function postPictures(controls: PostEditorControls) {
  return Extension.create({
    name: "postPictures",
    addProseMirrorPlugins() {
      return [picturePlugin(controls.pictures)];
    },
  });
}

// --- text ---------------------------------------------------------------------

/** The paragraph's size, "body" or "small", drawn as postType draws it. */
function paragraphSize(phone: boolean) {
  const scale = postType(phone);
  return Extension.create({
    name: "postSize",
    addGlobalAttributes() {
      return [
        {
          types: ["paragraph"],
          attributes: {
            size: {
              default: "body",
              parseHTML: (element: HTMLElement) => (element.getAttribute("data-size") === "small" ? "small" : "body"),
              renderHTML: (attributes: Record<string, unknown>) => ({
                "data-size": attributes.size === "small" ? "small" : "body",
                style: styleString(attributes.size === "small" ? scale.small : scale.composer),
              }),
            },
          },
        },
      ];
    },
  });
}

/**
 * Title and Heading. They are drawn as paragraphs (data-heading), as PostBody
 * draws them: the page's own h1 stays the only one. External h1 and h2 still
 * paste in as Title and Heading.
 */
function postHeading(phone: boolean) {
  const scale = postType(phone);
  return Heading.extend({
    parseHTML() {
      return [
        { tag: 'p[data-heading="1"]', attrs: { level: 1 }, priority: 60 },
        { tag: 'p[data-heading="2"]', attrs: { level: 2 }, priority: 60 },
        ...(this.parent?.() ?? []),
      ];
    },
    renderHTML({ node, HTMLAttributes }) {
      const level = node.attrs.level === 1 ? 1 : 2;
      return ["p", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-heading": String(level), style: styleString(level === 1 ? scale.title : scale.heading) }), 0];
    },
  }).configure({ levels: [1, 2] });
}

/** Links: http, https and mailto, and the address is all a link stores. */
const PostLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("href"),
        renderHTML: (attributes: Record<string, unknown>) => (attributes.href ? { href: attributes.href as string } : {}),
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: false,
  linkOnPaste: true,
  defaultProtocol: "https",
  protocols: ["mailto"],
  isAllowedUri: (url) => linkAllowed(url),
  HTMLAttributes: {
    target: null,
    rel: "noopener noreferrer nofollow ugc",
    style: styleString({ color: "inherit", textDecoration: "underline" }),
  },
});

/**
 * CA-06 P1: words that point at a tile or a session. Only `to` is stored. Not inclusive, so typing at either edge
 * writes plain words; it excludes a web link, so a word is never both. Drawn as a span the keyboard can reach; the
 * fill and the target's number are decorations (PostRefLook, P3), so they follow the target without touching the text.
 */
export const PostRef = Mark.create({
  name: "ref",
  // Outermost, so bold words inside a link do not split it in two.
  priority: 1001,
  inclusive: false,
  // Itself too: words point at one part, so a second ref replaces the first.
  excludes: "ref link",
  spanning: true,

  addAttributes() {
    return {
      to: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-ref"),
        renderHTML: (attributes: Record<string, unknown>) => (attributes.to ? { "data-ref": attributes.to as string } : {}),
      },
    };
  },

  parseHTML: () => [{ tag: "span[data-ref]", getAttrs: (element) => (parseRefTo((element as HTMLElement).getAttribute("data-ref")) ? null : false) }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { role: "link", tabindex: "0" }), 0],
});

/** The plain paint, until the composer says what a link points at. */
const PLAIN_PAINT = refPaint({ colour: null, number: "" }, "noon");

/** Paints one link's words and number from the composer's handlers. Its attributes are its own (ignoreMutation). */
function paintRef(dom: HTMLElement, controls: PostEditorControls, strong = false) {
  const to = dom.getAttribute("data-ref") ?? "";
  const paint = controls.refs?.current?.paint(to) ?? PLAIN_PAINT;
  const words = dom.firstElementChild as HTMLElement | null;
  const number = dom.lastElementChild as HTMLElement | null;
  if (!words || !number) return;
  words.setAttribute("style", styleString(refWordsStyle(paint, strong && !paint.gone)));
  number.textContent = paint.number;
  number.setAttribute("style", styleString(refNumberStyle));
  if (paint.gone) {
    dom.removeAttribute("tabindex");
    dom.removeAttribute("role");
    dom.setAttribute("title", REF_COPY.gone);
    dom.setAttribute("data-ref-gone", "");
  } else {
    dom.setAttribute("tabindex", "0");
    dom.setAttribute("role", "link");
    dom.removeAttribute("title");
    dom.removeAttribute("data-ref-gone");
  }
}

/** A link in the editor: the words (ProseMirror's) on their fill, then the number (the composer's). */
function refMarkView(to: string, controls: PostEditorControls) {
  const dom = document.createElement("span");
  dom.setAttribute("data-ref", to);
  const words = document.createElement("span");
  const number = document.createElement("span");
  number.contentEditable = "false";
  number.setAttribute("aria-hidden", "true");
  number.setAttribute("data-ref-number", "");
  dom.append(words, number);
  paintRef(dom, controls);

  const gone = () => dom.hasAttribute("data-ref-gone");
  const go = () => {
    if (!gone()) controls.refs?.current?.onGo(to, dom);
  };
  const ring = (on: boolean) => {
    for (const [key, value] of Object.entries(focusRing)) dom.style.setProperty(key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), on ? `${value}${typeof value === "number" ? "px" : ""}` : "");
  };
  dom.addEventListener("click", () => {
    // A drag that ends on the words selects them; only a plain click goes.
    if (window.getSelection()?.isCollapsed ?? true) go();
  });
  dom.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target !== dom) return;
    event.preventDefault();
    event.stopPropagation();
    go();
  });
  dom.addEventListener("mouseenter", () => {
    paintRef(dom, controls, true);
    if (!gone()) controls.refs?.current?.onHover(to, dom);
  });
  dom.addEventListener("mouseleave", () => {
    paintRef(dom, controls);
    controls.refs?.current?.onHover(to, null);
  });
  dom.addEventListener("focus", () => {
    paintRef(dom, controls, true);
    ring(true);
  });
  dom.addEventListener("blur", () => {
    paintRef(dom, controls);
    ring(false);
  });

  return {
    dom,
    contentDOM: words,
    ignoreMutation: (mutation: MutationRecord | { type: "selection"; target: Node }) =>
      mutation.type === "attributes" || (mutation.type !== "selection" && (mutation.target === number || number.contains(mutation.target))),
  };
}

/** Draws every link through refMarkView, and paints them again whenever the editor or the composer changes. */
function postRefLook(controls: PostEditorControls) {
  return Extension.create({
    name: "postRefLook",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("postRefLook"),
          props: {
            markViews: {
              ref: (mark) => refMarkView(String(mark.attrs.to ?? ""), controls),
            },
          },
          view: () => ({
            update: (view) => repaintRefs(view.dom, controls),
          }),
        }),
      ];
    },
  });
}

/**
 * Every link painted again: a colour, a name or a part changed. Straight on the DOM, with no transaction, so nothing
 * in the document moves (a transaction would let the trailing paragraph rule add a block to an untouched post).
 */
export function repaintRefs(root: HTMLElement, controls: PostEditorControls): void {
  root.querySelectorAll<HTMLElement>("span[data-ref]").forEach((dom) => paintRef(dom, controls, dom === document.activeElement));
}

// --- what is drawn around the text ---------------------------------------------

function counterElement(length: number): HTMLElement {
  const dom = document.createElement("div");
  dom.setAttribute("data-post-count", "");
  dom.contentEditable = "false";
  dom.textContent = countLabel(length) ?? "";
  applyStyle(dom, {
    fontFamily: FIGTREE,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "normal",
    // Over the limit the count steps up from t.label to t.text.
    color: length > POST_BODY_MAX ? t.text : t.label,
    fontVariantNumeric: "tabular-nums",
    userSelect: "none",
  });
  return dom;
}

function placeholderElement(words: string): HTMLElement {
  const dom = document.createElement("span");
  dom.setAttribute("data-post-placeholder", "");
  dom.setAttribute("aria-hidden", "true");
  dom.contentEditable = "false";
  // Zero wide, so it takes no room and the caret sits at the start of the line; the words spill out over the empty line.
  applyStyle(dom, { display: "inline-block", width: 0, whiteSpace: "nowrap", pointerEvents: "none", userSelect: "none", color: t.label });
  dom.textContent = words;
  return dom;
}

/** The count under a post's last block once it passes 900, and the words in a post that is one empty paragraph. */
const PostChrome = Extension.create({
  name: "postChrome",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("postChrome"),
        props: {
          decorations: (state) => {
            const found: Decoration[] = [];
            const { doc } = state;

            let length = 0;
            let end = -1;
            const close = () => {
              const shown = length;
              const at = end;
              if (shown > COUNT_SHOWN_FROM && at >= 0) {
                found.push(Decoration.widget(at, () => counterElement(shown), { side: -1, key: `count-${at}-${shown}`, ignoreSelection: true }));
              }
              length = 0;
              end = -1;
            };
            doc.forEach((node, offset) => {
              if (node.type.name === "postBreak") return close();
              length += [...node.textContent].length;
              end = offset + node.nodeSize;
            });
            close();

            // A post that is one empty paragraph asks for its words: the first as X asks, the rest as "Add another post".
            let post = 0;
            let blocks = 0;
            let empty = -1;
            const ask = () => {
              if (blocks !== 1 || empty < 0) return;
              const words = post === 0 ? PLACEHOLDER : NEXT_PLACEHOLDER;
              found.push(Decoration.widget(empty + 1, () => placeholderElement(words), { side: -1, key: `post-placeholder-${post}`, ignoreSelection: true }));
            };
            doc.forEach((node, offset) => {
              if (node.type.name === "postBreak") {
                ask();
                post += 1;
                blocks = 0;
                empty = -1;
                return;
              }
              blocks += 1;
              empty = node.type.name === "paragraph" && node.content.size === 0 ? offset : -1;
            });
            ask();
            return DecorationSet.create(doc, found);
          },
        },
      }),
    ];
  },
});

// --- keys ----------------------------------------------------------------------

function postKeys(controls: PostEditorControls) {
  return Extension.create({
    name: "postKeys",
    priority: 1000,

    addKeyboardShortcuts() {
      return {
        Backspace: () => removeBreakBefore(this.editor),
        "Mod-k": () => controls.openLink.current?.() ?? false,
      };
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("postSlashKeys"),
          props: {
            handleKeyDown: (_view: EditorView, event: KeyboardEvent) => controls.slashKey.current?.(event) ?? false,
            // CA-06 P2: @ at the start of a block or after a space opens the reference picker in its place.
            handleTextInput: (view: EditorView, from: number, to: number, typed: string) => {
              if (typed !== "@" || from !== to || !controls.openRefs?.current) return false;
              if (!opensOnAt({ state: view.state } as Pick<Editor, "state">, from)) return false;
              return controls.openRefs.current(true);
            },
          },
        }),
      ];
    },
  });
}

// --- the set ---------------------------------------------------------------------

/** The editor's whole attribute set: the root element, drawn like PostBody's column. */
export function editorAttributes(): Record<string, string> {
  return {
    "aria-label": "The thread",
    style: styleString({
      // 16 at the root, so a phone does not zoom the page when the editor takes focus.
      fontFamily: FIGTREE,
      fontSize: 16,
      display: "flex",
      flexDirection: "column",
      gap: BLOCK_GAP,
      minHeight: 48,
      outline: "none",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      fontVariantLigatures: "none",
    }),
  };
}

/** Every extension of the post editor. `phone` is below 768px, as postType takes it. */
export function postExtensions(phone: boolean, controls: PostEditorControls) {
  const scale = postType(phone);
  const list = (ordered: boolean) =>
    styleString({
      ...scale.composer,
      margin: 0,
      paddingLeft: LIST_INDENT,
      listStyleType: ordered ? "decimal" : "disc",
      listStylePosition: "outside",
      display: "flex",
      flexDirection: "column",
      gap: LIST_ITEM_GAP,
    });

  return [
    StarterKit.configure({
      blockquote: false,
      horizontalRule: false,
      strike: false,
      code: false,
      gapcursor: false,
      heading: false,
      // CA-07: a post ends with its pictures; the editor keeps no empty line after them.
      trailingNode: { notAfter: ["postMediaGrid"] },
      link: false,
      codeBlock: { HTMLAttributes: { style: styleString(scale.code) } },
      bulletList: { HTMLAttributes: { style: list(false) } },
      orderedList: { HTMLAttributes: { style: list(true) } },
    }),
    postHeading(phone),
    paragraphSize(phone),
    PostLink,
    PostRef,
    PostBreak,
    PostMediaNode.configure({ host: controls.pictures, phone }),
    PostMediaGridNode.configure({ host: controls.pictures, phone }),
    postPictures(controls),
    PostChrome,
    PostFocus,
    postKeys(controls),
    postRefLook(controls),
  ];
}

