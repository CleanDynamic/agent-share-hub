// extensions: what the composer's post editor is made of (PT-05).
//
// ONLY WHAT thread.ts ALLOWS. The nodes are paragraph (with a size), heading
// (levels 1 and 2: a Title and a Heading), codeBlock, bulletList, orderedList,
// listItem, hardBreak, postBreak, and postMedia and postMediaRow, which are here
// so a thread that already holds pictures opens and saves with them intact
// (PT-06 draws them properly). The marks are bold, italic, underline and link.
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

import { Extension, mergeAttributes, Node as TipNode, type Editor } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { LIST_INDENT, LIST_ITEM_GAP, BLOCK_GAP, postType } from "@/components/post/postType";
import { countLabel, COUNT_SHOWN_FROM } from "@/lib/build/threadEditor";
import { linkAllowed, POST_BODY_MAX } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { applyStyle, styleString } from "./styleString";

/** The words in the editor's empty last paragraph. */
export const PLACEHOLDER = "Type / for a picture, a list, a row of pictures or a new post";

/** What a break reads after "Post 2", for the first break only. */
export const FIRST_BREAK_NOTE = "readers reach this with Show more";

/** Handles the React side hands the extensions. */
export interface PostEditorControls {
  /** The slash menu's key handler: true when it took the key. Null while the menu is closed. */
  slashKey: { current: ((event: KeyboardEvent) => boolean) | null };
  /** Opens the link popover over the selection: true when it did. Null while there is no format bar. */
  openLink: { current: (() => boolean) | null };
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

// 48 above and 32 below the label, in steps of the spacing scale: the editor's 12 gap, then 24 and 12 above, 20 below.
const breakRow = { display: "flex", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 12, marginBottom: 20, userSelect: "none" } as const;
const breakRule = { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 0, borderTopWidth: 1, borderTopStyle: "dashed", borderTopColor: t.line } as const;
const breakLabel = { fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, lineHeight: "normal", color: t.text2, whiteSpace: "nowrap", borderRadius: 4, padding: "2px 6px" } as const;

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

  const before = document.createElement("span");
  before.setAttribute("aria-hidden", "true");
  applyStyle(before, breakRule);
  const label = document.createElement("span");
  applyStyle(label, breakLabel);
  const after = document.createElement("span");
  after.setAttribute("aria-hidden", "true");
  applyStyle(after, breakRule);
  dom.append(before, label, after);

  let shown = -1;
  const show = (number: number) => {
    if (number === shown) return;
    shown = number;
    dom.setAttribute("data-post-number", String(number));
    dom.setAttribute("aria-label", `Post ${number} starts here`);
    const name = document.createElement("span");
    name.textContent = `Post ${number}`;
    applyStyle(name, { fontWeight: 500, color: t.text });
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

// --- pictures, until PT-06 -----------------------------------------------------

const pictureTile = {
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 96,
  padding: 12,
  borderRadius: 6,
  background: t.tile,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.tileBorder,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 400,
  color: t.text2,
} as const;

/**
 * A picture already in the thread. PT-06 gives it its picture, its caption and
 * its handles; here it is an atom that keeps every attribute, so a thread that
 * has pictures is saved with them.
 */
export const PostMediaNode = TipNode.create({
  name: "postMedia",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      mediaId: { default: "" },
      width: { default: 100 },
      w: { default: null },
      h: { default: null },
      alt: { default: "" },
      caption: { default: "" },
    };
  },

  parseHTML: () => [],
  renderHTML: ({ node }) => ["figure", { "data-post-media": String(node.attrs.mediaId ?? "") }],

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("figure");
      dom.setAttribute("data-post-media", String(node.attrs.mediaId ?? ""));
      dom.contentEditable = "false";
      dom.style.margin = "0";
      const tile = document.createElement("div");
      applyStyle(tile, pictureTile);
      tile.textContent = typeof node.attrs.alt === "string" && node.attrs.alt ? node.attrs.alt : "Picture";
      dom.append(tile);
      return {
        dom,
        selectNode: () => applyStyle(tile, { background: t.well }),
        deselectNode: () => tile.style.setProperty("background", t.tile),
        ignoreMutation: () => true,
      };
    };
  },
});

/** Two or three pictures side by side. */
export const PostMediaRowNode = TipNode.create({
  name: "postMediaRow",
  group: "block",
  content: "postMedia{2,3}",
  isolating: true,
  draggable: false,

  parseHTML: () => [],
  renderHTML: () => ["div", { "data-post-media-row": "", style: styleString({ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 8 }) }, 0],
});

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

function placeholderElement(): HTMLElement {
  const dom = document.createElement("span");
  dom.setAttribute("data-post-placeholder", "");
  dom.setAttribute("aria-hidden", "true");
  dom.contentEditable = "false";
  // Zero wide, so it takes no room and the caret sits at the start of the line; the words spill out over the empty line.
  applyStyle(dom, { display: "inline-block", width: 0, whiteSpace: "nowrap", pointerEvents: "none", userSelect: "none", color: t.label });
  dom.textContent = PLACEHOLDER;
  return dom;
}

/** The count under a post's last block once it passes 900, and the words in an empty last paragraph. */
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

            const last = doc.lastChild;
            if (last && last.type.name === "paragraph" && last.content.size === 0) {
              found.push(Decoration.widget(doc.content.size - last.nodeSize + 1, placeholderElement, { side: -1, key: "post-placeholder", ignoreSelection: true }));
            }
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
      minHeight: 240,
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
    PostBreak,
    PostMediaNode,
    PostMediaRowNode,
    PostChrome,
    postKeys(controls),
  ];
}

