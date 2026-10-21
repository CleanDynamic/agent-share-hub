// PostToolbar: the row of buttons along the bottom of the composer's post, as X's composer has (PT-05, PT-07).
//
// Every way into the post is a button here, so nothing has to be typed to find it: Picture or video, Row of pictures,
// Bulleted list, Numbered list and Text size on the left; Preview (an eye), a divider and Add another post (+) on the
// right, every one an icon with its name as a tooltip, as X's are. Text
// size opens a row of the styles above the buttons. A phone has no bar over a selection (FormatBar), so its Text size row
// also holds Bold, Italic, Underline and Link, and Link opens the address row in its place.
//
// Drawn under the editor on both widths, never docked: the composer sits above the build, so the bar belongs to the post.
// IT NEVER TAKES FOCUS FROM THE EDITOR: a press is a cancelled mouse-down, so the caret (and a phone's keyboard) stays.
// The one place focus moves is the link address, which is a field.

import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { Eye } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";
import { postType } from "@/components/post/postType";
import { linkAllowed, MAX_POST_PICTURES, POST_BODY_MAX, type ThreadDoc } from "@/lib/build/thread";
import { canStartPost, POST_LIMIT_SENTENCE, postRuns, runLength } from "@/lib/build/threadEditor";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, CONTROL_HOVER, PRESSED, SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { text, wellField } from "@/pages/site/compose/refinedStyles";

import { currentStyle, LINK_SENTENCE, setTextStyle, TEXT_STYLES, type TextStyleName } from "./FormatBar";
import { gapPos, picturesPerPost, postAtCaret } from "./pictures";
import { REFERENCE_COPY } from "./ReferencePicker";
import type { InsertPicture } from "./SlashMenu";

/** The title "Picture or video" takes while the post holds its four. */
export const POST_FULL_TITLE = `A post holds ${MAX_POST_PICTURES} pictures`;

/** A phone's button is 44 square: the touch size. */
export const TOOL_SIZE = 44;
/** A desktop's button is 36 square, its glyph 18 (CA-07). */
export const DESKTOP_TOOL_SIZE = 36;
/** The glyph in a toolbar button. */
export const TOOL_GLYPH = 18;
/** CA-07: the round + on a desktop. */
export const ADD_SIZE = 32;
/** CA-07: the character ring. */
export const RING_SIZE = 20;
/** The ring shows its number from this many left. */
export const RING_NUMBER_FROM = 20;
/** The text-size row's buttons are 52 high. */
export const STYLE_HEIGHT = 52;

interface Tools {
  style: TextStyleName;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
  link: boolean;
  href: string;
  /** The post the caret is in has something in it, so another can follow it. */
  canAdd: boolean;
  /** CA-07: characters left in the post the caret is in, counted as POST_BODY_MAX is. */
  left: number;
  /** CA-07: the post the caret is in already holds four pictures. */
  postFull: boolean;
}

const NONE: Tools = { style: "Body", bold: false, italic: false, underline: false, bullet: false, ordered: false, link: false, href: "", canAdd: false, left: POST_BODY_MAX, postFull: false };

function readTools(editor: Editor | null): Tools {
  if (!editor || !editor.isEditable) return NONE;
  return {
    style: currentStyle(editor),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
    link: editor.isActive("link"),
    href: (editor.getAttributes("link").href as string | undefined) ?? "",
    canAdd: !postIsEmpty(editor),
    left: charactersLeft(editor),
    postFull: (picturesPerPost(editor.state.doc)[postAtCaret(editor)] ?? 0) >= MAX_POST_PICTURES,
  };
}

/** The top-level index of the block the caret is in, or the last block when there is none. */
function caretIndex(editor: Editor): number {
  const { selection, doc } = editor.state;
  return selection.$from.depth > 0 || selection instanceof NodeSelection ? selection.$from.index(0) : Math.max(0, doc.childCount - 1);
}

/** The first and last top-level index of the post the caret is in. */
function currentPost(editor: Editor): { first: number; last: number } {
  const { doc } = editor.state;
  const at = Math.min(caretIndex(editor), doc.childCount - 1);
  let first = at;
  while (first > 0 && doc.child(first - 1).type.name !== "postBreak") first -= 1;
  // A selected break belongs to the post it starts.
  if (doc.child(at).type.name === "postBreak") first = at + 1;
  let last = Math.max(first, at);
  while (last + 1 < doc.childCount && doc.child(last + 1).type.name !== "postBreak") last += 1;
  return { first, last: Math.min(last, doc.childCount - 1) };
}

const isEmptyParagraph = (node: { type: { name: string }; content: { size: number } } | null | undefined) =>
  Boolean(node && node.type.name === "paragraph" && node.content.size === 0);

/** The post the caret is in is one empty paragraph: X greys out + until something is written. */
function postIsEmpty(editor: Editor): boolean {
  const { doc } = editor.state;
  if (doc.childCount === 0) return true;
  const { first, last } = currentPost(editor);
  return first === last && isEmptyParagraph(doc.maybeChild(first));
}

/**
 * Adds a post after the one the caret is in, as X's + does, and puts the caret in it. The empty paragraph the editor keeps
 * after a list or a picture becomes the new post's first line. Said in a sentence when the thread already holds ten.
 */
export function addPostAfter(editor: Editor, notice: (sentence: string) => void): void {
  if (!canStartPost(editor.getJSON() as ThreadDoc)) {
    notice(POST_LIMIT_SENTENCE);
    return;
  }
  const { state, view } = editor;
  const { postBreak, paragraph } = state.schema.nodes;
  const { first, last } = currentPost(editor);
  const spare = last > first && isEmptyParagraph(state.doc.maybeChild(last));
  const at = gapPos(state.doc, spare ? last : last + 1);
  const tr = state.tr;
  if (spare) tr.insert(at, postBreak.create());
  else tr.insert(at, [postBreak.create(), paragraph.create()]);
  // The caret goes to the empty paragraph after the break.
  tr.setSelection(TextSelection.create(tr.doc, at + postBreak.create().nodeSize + 1));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** Characters left in the post the caret is in: POST_BODY_MAX less its body text, pictures not counted. */
export function charactersLeft(editor: Editor): number {
  const { doc } = editor.state;
  const index = Math.min(caretIndex(editor), doc.childCount - 1);
  let post = 0;
  doc.forEach((node, _offset, at) => {
    if (at < index && node.type.name === "postBreak") post += 1;
  });
  const run = postRuns(editor.getJSON() as ThreadDoc)[post];
  return POST_BODY_MAX - (run ? runLength(run) : 0);
}

/** CA-07: the row after the last post. The empty last post takes the caret; otherwise a post is added after the last. */
export function addPostAtEnd(editor: Editor, notice: (sentence: string) => void): void {
  const { state, view } = editor;
  const last = state.doc.lastChild;
  let first = state.doc.childCount - 1;
  while (first > 0 && state.doc.child(first - 1).type.name !== "postBreak") first -= 1;
  view.dispatch(state.tr.setSelection(TextSelection.atEnd(state.doc)));
  if (first === state.doc.childCount - 1 && isEmptyParagraph(last)) {
    view.focus();
    return;
  }
  addPostAfter(editor, notice);
}

/**
 * CA-07: the post at `index` (counting breaks) taken out with the break before it (the break after it, for the first
 * post), in one transaction so Undo puts it back. The caret goes to the end of the post before, or the start of the
 * one that is now first.
 */
export function removePost(editor: Editor, index: number): void {
  const { state, view } = editor;
  const { doc } = state;
  const breaks: number[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "postBreak") breaks.push(offset);
  });
  if (breaks.length === 0 || index < 0 || index > breaks.length) return;
  const breakSize = doc.nodeAt(breaks[0])?.nodeSize ?? 1;
  const from = index === 0 ? 0 : breaks[index - 1];
  const to = index === 0 ? breaks[0] + breakSize : index < breaks.length ? breaks[index] : doc.content.size;
  const tr = state.tr.delete(from, to);
  const $at = tr.doc.resolve(Math.min(from, tr.doc.content.size));
  tr.setSelection(index === 0 ? TextSelection.near($at, 1) : TextSelection.near($at, -1));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/** CA-07: a 20px ring of the characters left in the post, as X draws it. The number shows from 20 left. */
export function CharacterRing({ left }: { left: number }) {
  const [said, setSaid] = useState("");
  useEffect(() => {
    // Spoken only at 20, 10 and 0, so a screen reader is not read every keystroke.
    if (left === 20 || left === 10 || left === 0) setSaid(`${left} characters left. Pictures do not count.`);
  }, [left]);
  const over = left < 0;
  const stroke = 2;
  const radius = (RING_SIZE - stroke) / 2;
  const around = 2 * Math.PI * radius;
  const used = Math.min(1, Math.max(0, (POST_BODY_MAX - left) / POST_BODY_MAX));
  const ink = over ? t.breakage : t.text2;
  return (
    <>
    <span
      data-testid="character-ring"
      data-left={left}
      data-ink={over ? "breakage" : "text2"}
      role="img"
      aria-label={`${left} characters left. Pictures do not count.`}
      style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" strokeWidth={stroke} style={{ stroke: t.hairline }} />
        <circle
          data-ring-fill=""
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={around}
          strokeDashoffset={around * (1 - (over ? 1 : used))}
          style={{ stroke: ink }}
        />
      </svg>
      {left <= RING_NUMBER_FROM ? (
        <span aria-hidden="true" data-ring-number="" style={{ position: "relative", fontFamily: FIGTREE, fontSize: 10, fontWeight: 500, lineHeight: 1, color: ink, fontVariantNumeric: "tabular-nums" }}>
          {left}
        </span>
      ) : null}
    </span>
    <span role="status" aria-live="polite" data-testid="character-ring-said">
      <VisuallyHidden>{said}</VisuallyHidden>
    </span>
    </>
  );
}

// --- the buttons -------------------------------------------------------------------------

function ToolButton({
  label,
  title,
  size,
  pressed,
  expanded,
  boxed = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  /** The tooltip, when it is not the label. */
  title?: string;
  size: number;
  /** A toggle (Bold, a list): says so in aria-pressed. Absent: an action. */
  pressed?: boolean;
  expanded?: boolean;
  /** The control fill and its border, round: Add another post (CA-07). */
  boxed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const sunk = Boolean(pressed) || (state.pressed && !disabled);
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={expanded === undefined ? pressed : undefined}
      aria-expanded={expanded}
      disabled={disabled}
      // A cancelled mouse-down keeps the editor focused, and so the keyboard up.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...handlers}
      style={{
        width: size,
        height: size,
        flex: "none",
        padding: 0,
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? t.label : t.text2,
        border: "1px solid transparent",
        background: "transparent",
        ...(boxed ? { ...CONTROL, borderRadius: 999 } : null),
        // Hover is a step in colour, never an opacity; pressed sinks to the well.
        ...(state.hovered && !disabled ? CONTROL_HOVER : null),
        ...(sunk ? { ...PRESSED, color: t.text } : null),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

const letter: CSSProperties = { fontFamily: FIGTREE, fontSize: 15, lineHeight: 1, color: "inherit" };

function Tool({ glyph }: { glyph: GlyphName }) {
  return <Glyph name={glyph} size={TOOL_GLYPH} />;
}

// --- the rows above the buttons -------------------------------------------------------------

const rowBase: CSSProperties = { boxSizing: "border-box" };

/** A style's own type, at the size the editor draws it. */
function styleOf(name: TextStyleName, phone: boolean): CSSProperties {
  const scale = postType(phone);
  switch (name) {
    case "Title":
      return { ...scale.title, textWrap: "nowrap" };
    case "Heading":
      return { ...scale.heading, textWrap: "nowrap" };
    case "Small":
      return { ...scale.small, color: t.text2, textWrap: "nowrap" };
    case "Code":
      return { fontFamily: DM_MONO, fontSize: 13, fontWeight: 400, lineHeight: 1.6, color: t.text };
    default:
      return { ...scale.body, textWrap: "nowrap" };
  }
}

function StyleButton({ name, phone, current, onChoose }: { name: TextStyleName; phone: boolean; current: boolean; onChoose: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={current}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      {...handlers}
      style={{
        height: phone ? STYLE_HEIGHT : DESKTOP_TOOL_SIZE,
        flex: "none",
        minWidth: phone ? TOOL_SIZE : DESKTOP_TOOL_SIZE,
        padding: "0 16px",
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        ...CONTROL,
        ...(current ? SELECTED : null),
        ...(state.pressed ? PRESSED : null),
        ...ring(state.focusVisible),
      }}
    >
      <span style={styleOf(name, phone)}>{name}</span>
    </button>
  );
}

export function TextSizeRow({ editor, current, phone, onDone }: { editor: Editor; current: TextStyleName; phone: boolean; onDone: () => void }) {
  return (
    <div
      role="group"
      aria-label="Text size"
      data-testid="post-text-size"
      style={{ ...rowBase, display: "flex", gap: 8, padding: "8px 0", overflowX: "auto" }}
    >
      {TEXT_STYLES.map((name) => (
        <StyleButton
          key={name}
          name={name}
          phone={phone}
          current={name === current}
          onChoose={() => {
            setTextStyle(editor, name);
            onDone();
          }}
        />
      ))}
    </div>
  );
}

/** CA-10 (CA-09 F2): the Link button opens this row and focuses its field in the same tap (`field` is the button's). */
function LinkRow({ editor, href, hasLink, onDone, field }: { editor: Editor; href: string; hasLink: boolean; onDone: () => void; field: RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState(href);
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    const address = value.trim();
    if (!linkAllowed(address)) {
      setProblem(LINK_SENTENCE);
      field.current?.focus();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: address }).run();
    onDone();
  };

  return (
    <form
      aria-label="Link"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onDone();
          editor.commands.focus();
        }
      }}
      style={{ ...rowBase, display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={field}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="Link address"
          placeholder="https://"
          value={value}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "phone-link-problem" : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          // 16px, so the page does not zoom when the field takes focus.
          style={{ ...wellField, flex: 1, minWidth: 0, height: TOOL_SIZE, padding: "0 12px", ...text(16, 400, t.text) }}
        />
        {hasLink ? (
          <Button
            variant="secondary"
            size={44}
            fontSize={13}
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onDone();
            }}
          >
            Remove
          </Button>
        ) : null}
        <Button size={44} fontSize={13} type="submit">
          Save
        </Button>
      </div>
      {problem ? (
        <p id="phone-link-problem" role="alert" style={{ ...text(12, 400, t.text), margin: 0 }}>
          {problem}
        </p>
      ) : null}
    </form>
  );
}

// --- the toolbar ---------------------------------------------------------------------------------

export function PostToolbar({
  editor,
  phone,
  onInsertPicture,
  notice,
  onPreview,
  onReference,
}: {
  editor: Editor | null;
  /** Below 768px: 44 square buttons, and Bold, Italic, Underline and Link in the Text size row. */
  phone: boolean;
  onInsertPicture: InsertPicture;
  notice: (sentence: string) => void;
  /** Opens the draft as the Gallery will draw it. Absent: no Preview button. */
  onPreview?: () => void;
  /** CA-06 P2: @, the picker of the build's tiles and sessions. Absent: no @ button. */
  onReference?: () => void;
}) {
  const tools = useEditorState({ editor, selector: ({ editor: current }) => readTools(current) }) ?? NONE;
  const [panel, setPanel] = useState<"size" | "link" | null>(null);
  const linkField = useRef<HTMLInputElement | null>(null);
  /* Drawn now, then focused, inside the tap: an iPhone raises the keyboard only for a focus in the tap's handler. */
  const openLink = () => {
    flushSync(() => setPanel("link"));
    linkField.current?.focus();
  };

  if (!editor) return null;

  const size = phone ? TOOL_SIZE : DESKTOP_TOOL_SIZE;
  const run = (command: () => void) => () => {
    command();
    setPanel(null);
  };

  return (
    <div data-testid="post-toolbar" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {panel === "size" ? <TextSizeRow editor={editor} current={tools.style} phone={phone} onDone={() => setPanel(null)} /> : null}
      {panel === "size" && phone ? (
        <div role="group" aria-label="Format" style={{ display: "flex", gap: 0, paddingBottom: 8, overflowX: "auto" }}>
          <ToolButton label="Bold" size={size} pressed={tools.bold} onClick={run(() => editor.chain().focus().toggleBold().run())}>
            <span style={{ ...letter, fontWeight: 700 }}>B</span>
          </ToolButton>
          <ToolButton label="Italic" size={size} pressed={tools.italic} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
            <Tool glyph="italic" />
          </ToolButton>
          <ToolButton label="Underline" size={size} pressed={tools.underline} onClick={run(() => editor.chain().focus().toggleUnderline().run())}>
            <span style={{ ...letter, fontWeight: 500, textDecoration: "underline" }}>U</span>
          </ToolButton>
          <ToolButton label="Link" size={size} pressed={tools.link} expanded={false} onClick={openLink}>
            <Tool glyph="link" />
          </ToolButton>
        </div>
      ) : null}
      {panel === "link" ? <LinkRow editor={editor} href={tools.href} hasLink={tools.link} onDone={() => setPanel(null)} field={linkField} /> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: `1px solid ${t.hairline}`, minWidth: 0 }}>
        <div role="group" aria-label="Add to the post" style={{ display: "flex", alignItems: "center", gap: phone ? 0 : 2, flex: "1 1 auto", minWidth: 0, overflowX: "auto" }}>
          <ToolButton
            label="Picture or video"
            title={tools.postFull ? POST_FULL_TITLE : undefined}
            size={size}
            disabled={tools.postFull}
            onClick={run(() => onInsertPicture(editor))}
          >
            <Tool glyph="image" />
          </ToolButton>
          <ToolButton label="Bulleted list" size={size} pressed={tools.bullet} onClick={run(() => editor.chain().focus().toggleBulletList().run())}>
            <Tool glyph="listBullet" />
          </ToolButton>
          <ToolButton label="Numbered list" size={size} pressed={tools.ordered} onClick={run(() => editor.chain().focus().toggleOrderedList().run())}>
            <Tool glyph="listNumber" />
          </ToolButton>
          <ToolButton label="Text size" size={size} expanded={panel === "size" || panel === "link"} onClick={() => setPanel((open) => (open ? null : "size"))}>
            <span style={{ ...letter, fontWeight: 500 }}>Aa</span>
          </ToolButton>
          {onReference ? (
            <ToolButton label={REFERENCE_COPY.button} size={size} onClick={run(onReference)}>
              <Tool glyph="at" />
            </ToolButton>
          ) : null}
        </div>
        {onPreview ? (
          <ToolButton label="Preview" size={size} onClick={onPreview}>
            <Icon lucide={Eye} size={TOOL_GLYPH} />
          </ToolButton>
        ) : null}
        <CharacterRing left={tools.left} />
        <span aria-hidden="true" style={{ width: 1, height: phone ? 28 : 24, background: t.hairline, flex: "none" }} />
        <ToolButton label="Add another post" size={phone ? TOOL_SIZE : ADD_SIZE} boxed disabled={!tools.canAdd} onClick={run(() => addPostAfter(editor, notice))}>
          <Tool glyph="plus" />
        </ToolButton>
      </div>
    </div>
  );
}

export default PostToolbar;
