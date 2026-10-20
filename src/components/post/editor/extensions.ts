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
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { LIST_INDENT, LIST_ITEM_GAP, BLOCK_GAP, ROW_GAP, postType } from "@/components/post/postType";
import { stepWidth } from "@/lib/build/postMedia";
import { countLabel, COUNT_SHOWN_FROM } from "@/lib/build/threadEditor";
import { linkAllowed, parseRefTo, POST_BODY_MAX } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PictureView, type PictureOptions } from "./PictureView";
import { picturePlugin, type PictureHost } from "./pictures";
import { applyStyle, styleString } from "./styleString";

/** The words in an empty first post, as X's composer asks "What's happening?". */
export const PLACEHOLDER = "What did you build?";

/** The words in an empty post after the first. */
export const NEXT_PLACEHOLDER = "Add another post";

/** What a break reads after "Post 2", for the first break only. */
export const FIRST_BREAK_NOTE = "readers reach this with Show more";

/** Handles the React side hands the extensions. */
export interface PostEditorControls {
  /** The slash menu's key handler: true when it took the key. Null while the menu is closed. */
  slashKey: { current: ((event: KeyboardEvent) => boolean) | null };
  /** Opens the link popover over the selection: true when it did. Null while there is no format bar. */
  openLink: { current: (() => boolean) | null };
  /** The pictures: the store the node views read, and what the editor's uploads call back into (PT-06). */
  pictures: PictureHost;
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

// A quiet line between posts, as X's thread composer has: no rule, just the post's number in --label. The avatar and the
// thread line beside the next post are drawn by the composer's rail (ThreadRail), which reads where each break ends.
const breakRow = { display: "flex", alignItems: "center", minHeight: 20, paddingTop: 4, userSelect: "none" } as const;
const breakLabel = { fontFamily: FIGTREE, fontSize: 11.5, fontWeight: 400, lineHeight: "normal", color: t.label, whiteSpace: "nowrap", borderRadius: 4, padding: "2px 6px", marginLeft: -6 } as const;

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

  const label = document.createElement("span");
  applyStyle(label, breakLabel);
  dom.append(label);

  let shown = -1;
  const show = (number: number) => {
    if (number === shown) return;
    shown = number;
    dom.setAttribute("data-post-number", String(number));
    dom.setAttribute("aria-label", `Post ${number} starts here`);
    const name = document.createElement("span");
    name.textContent = `Post ${number}`;
    applyStyle(name, { fontWeight: 500, color: t.text2 });
    label.replaceChildren(name);
    if (number === 2) label.append(` · ${FIRST_BREAK_NOTE}`);
  };
  show(numberOf(initial));

  return {
    dom,
    update(node: { type: { name: string } }, decorations: readonly { spec?: { postNumber?: number } }[]) {
      if (node.type.name !== "postBreak") return false;
      show(numberOf(decorations));
      return true;
    },
    selectNode() {
      applyStyle(label, { background: t.well });
    },
    deselectNode() {
      label.style.removeProperty("background");
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

// --- pictures (PT-06) ------------------------------------------------------------

/**
 * A picture or video. An atom: its node view (PictureView) draws PostMedia with the editor's controls around it.
 * `uploadId` is the editor's mark on a picture still uploading, never drawn into HTML and never stored (tidyThread
 * drops it when it is null; the save waits while the picture has no mediaId).
 */
export const PostMediaNode = TipNode.create<PictureOptions>({
  name: "postMedia",
  group: "block",
  atom: true,
  selectable: true,
  // Draggable from the picture itself (the node view marks it as the handle); the margin handle moves any block.
  draggable: true,

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
      caption: { default: "" },
      uploadId: { default: null, rendered: false },
    };
  },

  parseHTML: () => [],
  renderHTML: ({ node }) => ["figure", { "data-post-media": String(node.attrs.mediaId ?? "") }],

  addNodeView() {
    return ReactNodeViewRenderer(PictureView);
  },

  // [ and ] step a selected picture through Small, Medium, Large and Full. Not inside a row: a row fills the column.
  addKeyboardShortcuts() {
    const step = (direction: 1 | -1) => () => {
      const { state, view } = this.editor;
      const { selection } = state;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== "postMedia") return false;
      if (selection.$from.parent.type.name === "postMediaRow") return false;
      const width = stepWidth(Number(selection.node.attrs.width) || 100, direction);
      view.dispatch(state.tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, width }));
      return true;
    };
    return { "[": step(-1), "]": step(1) };
  },
});

/** Two or three pictures side by side. The children size themselves (PictureView); a selected row gets the picture outline. */
export const PostMediaRowNode = TipNode.create({
  name: "postMediaRow",
  group: "block",
  content: "postMedia{2,3}",
  isolating: true,
  selectable: true,
  draggable: false,

  parseHTML: () => [],
  renderHTML: () => ["div", { "data-post-media-row": "", style: styleString({ display: "flex", gap: ROW_GAP, alignItems: "flex-start" }) }, 0],

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("postMediaRowSelected"),
        props: {
          decorations: (state) => {
            const { selection } = state;
            if (!(selection instanceof NodeSelection) || selection.node.type.name !== "postMediaRow") return null;
            return DecorationSet.create(state.doc, [
              Decoration.node(selection.from, selection.to, { style: styleString({ outline: `1px solid ${t.selectedEdge}`, outlineOffset: 3, borderRadius: 6 }) }),
            ]);
          },
        },
      }),
    ];
  },
});

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
                style: styleString(attributes.size === "small" ? scale.small : scale.body),
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
  inclusive: false,
  excludes: "link",
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
      ...scale.body,
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
    PostMediaRowNode,
    postPictures(controls),
    PostChrome,
    postKeys(controls),
  ];
}

