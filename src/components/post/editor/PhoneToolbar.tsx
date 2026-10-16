// PhoneToolbar: the writing toolbar of the Post tab below 768px (PT-07).
//
// Docked to the bottom of the screen and carried above the on-screen keyboard (useKeyboardInset). Eight 44px buttons
// across the width: Text size, Bold, Italic, Underline, Bulleted list, Numbered list, Link, and Add. Text size and Link
// open a row above the buttons; Add opens a BottomSheet of the blocks a slash would offer on a desktop.
//
// IT NEVER TAKES FOCUS FROM THE EDITOR: a press is a cancelled mouse-down, so the keyboard stays up. The one place focus
// moves is the link address, which is a field. The desktop's bar over a selection (FormatBar) is not drawn on a phone.

import { useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { Button } from "@/components/brand/Button";
import { postType } from "@/components/post/postType";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { linkAllowed, type ThreadDoc } from "@/lib/build/thread";
import { canStartPost, POST_LIMIT_SENTENCE } from "@/lib/build/threadEditor";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, PRESSED, SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { text, wellField } from "@/pages/site/compose/refinedStyles";

import { currentStyle, LINK_SENTENCE, setTextStyle, TEXT_STYLES, type TextStyleName } from "./FormatBar";
import type { InsertPicture } from "./SlashMenu";
import { useKeyboardInset } from "./useKeyboardInset";

/** A button is 44 square: the touch size. */
export const TOOL_SIZE = 44;
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
}

const NONE: Tools = { style: "Body", bold: false, italic: false, underline: false, bullet: false, ordered: false, link: false, href: "" };

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
  };
}

/** Starts the next post after the block the caret is in. Said in a sentence when the thread already holds ten. */
export function startNewPost(editor: Editor, notice: (sentence: string) => void): void {
  if (!canStartPost(editor.getJSON() as ThreadDoc)) {
    notice(POST_LIMIT_SENTENCE);
    return;
  }
  const { state, view } = editor;
  const { $from } = state.selection;
  const { postBreak, paragraph } = state.schema.nodes;
  const index = $from.depth > 0 ? $from.index(0) : Math.max(0, state.doc.childCount - 1);
  const block = state.doc.maybeChild(index);
  if (!block) return;
  let start = 0;
  for (let at = 0; at < index; at++) start += state.doc.child(at).nodeSize;
  const isEmpty = (node: typeof block | null) => Boolean(node && node.type.name === "paragraph" && node.content.size === 0);
  const empty = isEmpty(block);
  // The empty paragraph the editor keeps after a list or a picture is the next post's first line.
  const spare = !empty && isEmpty(state.doc.maybeChild(index + 1));
  const tr = state.tr;
  if (empty) tr.replaceWith(start, start + block.nodeSize, [postBreak.create(), paragraph.create()]);
  else if (spare) tr.insert(start + block.nodeSize, postBreak.create());
  else tr.insert(start + block.nodeSize, [postBreak.create(), paragraph.create()]);
  // The caret goes to the empty paragraph after the break.
  const caret = (empty ? start : start + block.nodeSize) + postBreak.create().nodeSize + 1;
  tr.setSelection(TextSelection.create(tr.doc, caret));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

// --- the buttons -------------------------------------------------------------------------

function ToolButton({
  label,
  pressed = false,
  expanded,
  boxed = false,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  expanded?: boolean;
  /** The control fill and its border: the Add button. */
  boxed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const sunk = pressed || state.pressed;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={expanded === undefined ? pressed : undefined}
      aria-expanded={expanded}
      // A cancelled mouse-down keeps the editor focused, and so the keyboard up.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...handlers}
      style={{
        width: TOOL_SIZE,
        height: TOOL_SIZE,
        flex: "none",
        padding: 0,
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: t.text,
        border: "1px solid transparent",
        background: "transparent",
        ...(boxed ? CONTROL : null),
        // Pressed sinks to the well.
        ...(sunk ? PRESSED : null),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

const letter: CSSProperties = { fontFamily: FIGTREE, fontSize: 16, lineHeight: 1, color: "inherit" };

function Tool({ glyph }: { glyph: GlyphName }) {
  return <Glyph name={glyph} size={16} />;
}

// --- the rows above the buttons -------------------------------------------------------------

const rowBase: CSSProperties = { boxSizing: "border-box", borderBottom: `1px solid ${t.hairline}` };

/** A style's own type, at its phone size. */
function phoneStyle(name: TextStyleName): CSSProperties {
  const scale = postType(true);
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

function StyleButton({ name, current, onChoose }: { name: TextStyleName; current: boolean; onChoose: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={current}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      {...handlers}
      style={{
        height: STYLE_HEIGHT,
        flex: "none",
        minWidth: TOOL_SIZE,
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
      <span style={phoneStyle(name)}>{name}</span>
    </button>
  );
}

export function TextSizeRow({ editor, current, onDone }: { editor: Editor; current: TextStyleName; onDone: () => void }) {
  return (
    <div
      role="group"
      aria-label="Text size"
      data-testid="phone-text-size"
      style={{ ...rowBase, display: "flex", gap: 8, padding: "12px 8px 8px", overflowX: "auto" }}
    >
      {TEXT_STYLES.map((name) => (
        <StyleButton
          key={name}
          name={name}
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

function LinkRow({ editor, href, hasLink, onDone }: { editor: Editor; href: string; hasLink: boolean; onDone: () => void }) {
  const [value, setValue] = useState(href);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

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
      style={{ ...rowBase, display: "flex", flexDirection: "column", gap: 8, padding: "12px 8px 8px" }}
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

// --- the Add sheet ----------------------------------------------------------------------------

type AddId = "picture" | "row" | "bullet" | "ordered" | "newPost";

const ADD_ITEMS: readonly { id: AddId; name: string; line: string }[] = [
  { id: "picture", name: "Picture or video", line: "One picture or a short video" },
  { id: "row", name: "Row of pictures", line: "Two or three side by side" },
  { id: "bullet", name: "Bulleted list", line: "A list with dots" },
  { id: "ordered", name: "Numbered list", line: "A list with numbers" },
  { id: "newPost", name: "New post", line: "Start the next post in the thread" },
];

function AddItem({ name, line, onChoose }: { name: string; line: string; onChoose: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onChoose}
      {...handlers}
      style={{
        minHeight: STYLE_HEIGHT,
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: 6,
        border: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        textAlign: "left",
        cursor: "pointer",
        // Hover is a step in colour; pressed sinks to the well.
        background: state.pressed ? t.well : state.hovered ? t.tile : "transparent",
        ...ring(state.focusVisible),
      }}
    >
      <span style={text(14, 500, t.text)}>{name}</span>
      <span style={text(12, 400, t.text2)}>{line}</span>
    </button>
  );
}

// --- the toolbar ---------------------------------------------------------------------------------

export function PhoneToolbar({
  editor,
  onInsertPicture,
  notice,
}: {
  editor: Editor | null;
  onInsertPicture: InsertPicture;
  notice: (sentence: string) => void;
}) {
  const inset = useKeyboardInset();
  const tools = useEditorState({ editor, selector: ({ editor: current }) => readTools(current) }) ?? NONE;
  const [panel, setPanel] = useState<"size" | "link" | null>(null);
  const [adding, setAdding] = useState(false);

  if (!editor) return null;

  const toggle = (name: "size" | "link") => setPanel((open) => (open === name ? null : name));
  const run = (command: () => void) => () => {
    command();
    setPanel(null);
  };

  const add = (id: AddId) => {
    setAdding(false);
    // After the sheet has let go of focus, so the editor and the file chooser are not fighting it.
    window.setTimeout(() => {
      if (id === "picture" || id === "row") onInsertPicture(id === "row" ? "row" : "single", editor);
      else if (id === "bullet") editor.chain().focus().toggleBulletList().run();
      else if (id === "ordered") editor.chain().focus().toggleOrderedList().run();
      else startNewPost(editor, notice);
    }, 0);
  };

  return (
    <>
      <div
        role="group"
        aria-label="Format"
        data-testid="phone-toolbar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          // Above the keyboard: the visual viewport's inset.
          bottom: inset,
          zIndex: 35,
          boxSizing: "border-box",
          background: t.module,
          borderTop: `1px solid ${t.hairline}`,
          boxShadow: t.sheetShadow,
        }}
      >
        {panel === "size" ? <TextSizeRow editor={editor} current={tools.style} onDone={() => setPanel(null)} /> : null}
        {panel === "link" ? <LinkRow editor={editor} href={tools.href} hasLink={tools.link} onDone={() => setPanel(null)} /> : null}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px 12px", overflowX: "auto" }}>
          <ToolButton label="Text size" expanded={panel === "size"} onClick={() => toggle("size")}>
            <span style={{ ...letter, fontWeight: 500 }}>Aa</span>
          </ToolButton>
          <ToolButton label="Bold" pressed={tools.bold} onClick={run(() => editor.chain().focus().toggleBold().run())}>
            <span style={{ ...letter, fontWeight: 700 }}>B</span>
          </ToolButton>
          <ToolButton label="Italic" pressed={tools.italic} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
            <Tool glyph="italic" />
          </ToolButton>
          <ToolButton label="Underline" pressed={tools.underline} onClick={run(() => editor.chain().focus().toggleUnderline().run())}>
            <span style={{ ...letter, fontWeight: 500, textDecoration: "underline" }}>U</span>
          </ToolButton>
          <ToolButton label="Bulleted list" pressed={tools.bullet} onClick={run(() => editor.chain().focus().toggleBulletList().run())}>
            <Tool glyph="listBullet" />
          </ToolButton>
          <ToolButton label="Numbered list" pressed={tools.ordered} onClick={run(() => editor.chain().focus().toggleOrderedList().run())}>
            <Tool glyph="listNumber" />
          </ToolButton>
          <ToolButton label="Link" pressed={tools.link} expanded={panel === "link"} onClick={() => toggle("link")}>
            <Tool glyph="link" />
          </ToolButton>
          <ToolButton label="Add" boxed expanded={adding} onClick={() => setAdding(true)}>
            <Tool glyph="plus" />
          </ToolButton>
        </div>
        {inset === 0 ? <div aria-hidden="true" style={{ height: "env(safe-area-inset-bottom)" }} /> : null}
      </div>
      <BottomSheet open={adding} onOpenChange={setAdding} title="Add">
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {ADD_ITEMS.map((item) => (
            <AddItem key={item.id} name={item.name} line={item.line} onChoose={() => add(item.id)} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

export default PhoneToolbar;
