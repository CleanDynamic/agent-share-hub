// PostBody: one post's nodes as React elements (PT-03).
//
// ONLY WHAT thread.ts ALLOWS. A node or mark type outside THREAD_NODE_TYPES and
// THREAD_MARK_TYPES is skipped, so a document from a newer editor, or one
// someone hand-wrote into the database, cannot put anything on the page that
// the checker would have refused. Nothing here sets innerHTML.
//
// LINKS. Only http, https and mailto render as links (linkAllowed, the same
// test checkThread applies on save). Any other href draws its text plain.
// CA-06: words that point at a part are a RefLink, drawn as one only inside a
// PostRefsProvider (the build page); anywhere else they are plain words.
//
// PICTURES (CA-07) are one PostMediaGrid after the words; `toGrids` reads an old
// post's pictures, between the lines or in rows, in that shape before drawing.
//
// HEADINGS ARE PARAGRAPHS. The page's own h1 stays the only h1, so a Title or
// Heading in a post is a p with the heading style. `realHeadings` turns them
// into h2 and h3 for a surface that wants an outline; it never emits an h1.

import { Fragment, type CSSProperties, type ReactNode } from "react";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import { linkAllowed, parseRefTo, toGrids, type Post } from "@/lib/build/thread";

import { PostMediaGrid } from "./media/PostMediaGrid";
import { RefLink } from "./RefLinks";
import { BLOCK_GAP, LIST_INDENT, LIST_ITEM_GAP, postType, type PostTypeScale } from "./postType";

export interface PostBodyProps {
  post: Post;
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  capTall?: boolean;
  phone?: boolean;
  /** Draw Title and Heading as h2 and h3 instead of p. Never an h1. */
  realHeadings?: boolean;
  /** Right padding on the first text block, so a counter at the end of its line has room. */
  firstLineInset?: number;
}

// The wire format is untrusted, so every read goes through these.
type Loose = { type?: unknown; text?: unknown; marks?: unknown; attrs?: unknown; content?: unknown };

const isNode = (value: unknown): value is Loose => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const childrenOf = (node: Loose): Loose[] => (Array.isArray(node.content) ? node.content.filter(isNode) : []);
const attrsOf = (node: Loose): Record<string, unknown> => (isNode(node.attrs) ? (node.attrs as Record<string, unknown>) : {});

/** Marks wrap text from the outside in: link, then bold, italic, underline. */
function renderText(node: Loose, key: number): ReactNode {
  let out: ReactNode = typeof node.text === "string" ? node.text : "";
  if (out === "") return null;

  const marks = (Array.isArray(node.marks) ? node.marks.filter(isNode) : []) as Loose[];
  const has = (type: string) => marks.some((mark) => mark.type === type);

  // Applied inside out, so the link ends up outermost.
  if (has("underline")) out = <u>{out}</u>;
  if (has("italic")) out = <em>{out}</em>;
  if (has("bold")) out = <strong>{out}</strong>;
  const link = marks.find((mark) => mark.type === "link");
  if (link) {
    const href = attrsOf(link).href;
    if (linkAllowed(href)) {
      out = (
        <a
          href={(href as string).trim()}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          {out}
        </a>
      );
    }
  }
  // CA-06: words that point at a part. A web link and a reference never share words (checkThread).
  const ref = link ? undefined : marks.find((mark) => mark.type === "ref");
  const to = ref ? attrsOf(ref).to : undefined;
  if (ref && parseRefTo(to)) out = <RefLink to={to as string}>{out}</RefLink>;
  return <Fragment key={key}>{out}</Fragment>;
}

function renderInline(nodes: Loose[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return renderText(node, index);
    if (node.type === "hardBreak") return <br key={index} />;
    return null;
  });
}

interface Ctx {
  scale: PostTypeScale;
  props: PostBodyProps;
}

function renderList(node: Loose, ctx: Ctx, key: number, nested: boolean): ReactNode {
  const ordered = node.type === "orderedList";
  const items = childrenOf(node).filter((child) => child.type === "listItem");
  if (items.length === 0) return null;

  // The reset stylesheet strips markers, so they are asked for.
  const style: CSSProperties = {
    margin: nested ? `${LIST_ITEM_GAP}px 0 0` : 0,
    paddingLeft: LIST_INDENT,
    listStyleType: ordered ? "decimal" : "disc",
    listStylePosition: "outside",
    ...ctx.scale.body,
  };
  const children = items.map((item, index) => (
    <li key={index} style={{ marginTop: index === 0 ? 0 : LIST_ITEM_GAP }}>
      {childrenOf(item).map((child, childIndex) => {
        if (child.type === "paragraph") {
          const small = attrsOf(child).size === "small";
          return (
            <p key={childIndex} style={{ ...(small ? ctx.scale.small : ctx.scale.body), marginTop: childIndex === 0 ? 0 : LIST_ITEM_GAP }}>
              {renderInline(childrenOf(child))}
            </p>
          );
        }
        if (child.type === "bulletList" || child.type === "orderedList") return renderList(child, ctx, childIndex, true);
        return null;
      })}
    </li>
  ));

  if (ordered) {
    const start = attrsOf(node).start;
    return (
      <ol key={key} start={typeof start === "number" && Number.isFinite(start) ? start : undefined} style={style}>
        {children}
      </ol>
    );
  }
  return (
    <ul key={key} style={style}>
      {children}
    </ul>
  );
}

function renderBlock(node: Loose, ctx: Ctx, key: number, inset: number): ReactNode {
  const { scale, props } = ctx;
  const pad: CSSProperties = inset ? { paddingRight: inset } : {};

  switch (node.type) {
    case "paragraph": {
      const content = childrenOf(node);
      if (content.length === 0) return null;
      const small = attrsOf(node).size === "small";
      return (
        <p key={key} style={{ ...(small ? scale.small : scale.body), ...pad }}>
          {renderInline(content)}
        </p>
      );
    }
    case "heading": {
      const title = attrsOf(node).level === 1;
      const style = { ...(title ? scale.title : scale.heading), ...pad };
      const content = renderInline(childrenOf(node));
      if (props.realHeadings) {
        return title ? (
          <h2 key={key} style={style}>
            {content}
          </h2>
        ) : (
          <h3 key={key} style={style}>
            {content}
          </h3>
        );
      }
      return (
        <p key={key} style={style}>
          {content}
        </p>
      );
    }
    case "codeBlock": {
      const code = childrenOf(node)
        .map((child) => (child.type === "text" && typeof child.text === "string" ? child.text : ""))
        .join("");
      // A scroll region has to be reachable by keyboard.
      return (
        <pre key={key} tabIndex={0} style={scale.code}>
          <code>{code}</code>
        </pre>
      );
    }
    case "bulletList":
    case "orderedList":
      return renderList(node, ctx, key, false);
    case "postMediaGrid":
      // CA-07: a post's pictures, one grid after its words. Captions stay in the saved data and are not drawn.
      return <PostMediaGrid key={key} pictures={childrenOf(node).filter((child) => child.type === "postMedia")} mediaById={props.mediaById} srcByPath={props.srcByPath} phone={props.phone} />;
    default:
      // Unknown, or a postBreak that splitThread should have taken out.
      return null;
  }
}

const TEXT_BLOCKS = new Set(["paragraph", "heading"]);

export function PostBody(props: PostBodyProps) {
  const ctx: Ctx = { scale: postType(Boolean(props.phone)), props };
  // CA-07: an old post's pictures, between the lines or in rows, are read as one grid at its end. Nothing is saved.
  const content = Array.isArray(props.post?.content) ? props.post.content : [];
  const blocks = toGrids({ type: "doc", content }).content.filter(isNode) as Loose[];
  const first = blocks[0];

  return (
    <div data-post-body="" style={{ display: "flex", flexDirection: "column", gap: BLOCK_GAP }}>
      {blocks.map((node, index) =>
        renderBlock(node, ctx, index, index === 0 && typeof first.type === "string" && TEXT_BLOCKS.has(first.type) ? (props.firstLineInset ?? 0) : 0),
      )}
    </div>
  );
}
