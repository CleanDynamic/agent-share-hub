// FormatBar: the bar over a text selection in the Post tab's editor (PT-05).
//
// Text style, Bold, Italic, Underline, Bulleted list, Numbered list, Link. It
// is shown over a non-empty text selection, 8px above it, and below it when
// there is no room above or the bar would cover a post's Title line. It never
// takes focus from the editor: a click on a button is a mouse-down that is
// cancelled, and the menus and the link field hand focus back when they close.
//
// A phone shows nothing here: the bar is PT-07's.

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/brand/Button";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { postType } from "@/components/post/postType";
import { linkAllowed } from "@/lib/build/thread";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { menuItem, menuSurface, text, wellField } from "@/pages/site/compose/refinedStyles";

import type { PostEditorControls } from "./extensions";
import { MenuContent } from "@/pages/site/compose/ComposeMenu";

export type TextStyleName = "Title" | "Heading" | "Body" | "Small" | "Code";

export const TEXT_STYLES: readonly TextStyleName[] = ["Title", "Heading", "Body", "Small", "Code"];

/** The sentence a link address that is not http, https or mailto is refused with. */
export const LINK_SENTENCE = "Use an address that starts with http://, https:// or mailto:";

/** How far above the selection the bar sits, and how tall it is. */
const GAP = 8;
const BAR_HEIGHT = 38;

/** The style the selection is in. */
export function currentStyle(editor: Editor): TextStyleName {
  if (editor.isActive("heading", { level: 1 })) return "Title";
  if (editor.isActive("heading", { level: 2 })) return "Heading";
  if (editor.isActive("codeBlock")) return "Code";
  if (editor.isActive("paragraph", { size: "small" })) return "Small";
  return "Body";
}

/** Sets a text style on the blocks the selection touches. Lists are left first, so a list item can become a Title. */
export function setTextStyle(editor: Editor, style: TextStyleName): void {
  const chain = editor.chain().focus().clearNodes();
  if (style === "Title") chain.setHeading({ level: 1 }).run();
  else if (style === "Heading") chain.setHeading({ level: 2 }).run();
  else if (style === "Code") chain.setCodeBlock().run();
  else if (style === "Small") chain.updateAttributes("paragraph", { size: "small" }).run();
  else chain.updateAttributes("paragraph", { size: "body" }).run();
}

interface BarState {
  /** A non-empty text selection in an editor that can be edited. */
  selecting: boolean;
  focused: boolean;
  from: number;
  to: number;
  style: TextStyleName;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
  link: boolean;
}

const CLOSED: BarState = { selecting: false, focused: false, from: 0, to: 0, style: "Body", bold: false, italic: false, underline: false, bullet: false, ordered: false, link: false };

function readBar(editor: Editor | null): BarState {
  if (!editor || !editor.isEditable) return CLOSED;
  const { selection } = editor.state;
  const text_ = selection.empty ? false : !("node" in selection) && editor.state.doc.textBetween(selection.from, selection.to, "").length > 0;
  return {
    selecting: text_,
    focused: editor.isFocused,
    from: selection.from,
    to: selection.to,
    style: currentStyle(editor),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    bullet: editor.isActive("bulletList"),
    ordered: editor.isActive("orderedList"),
    link: editor.isActive("link"),
  };
}

// --- the buttons -------------------------------------------------------------------

function BarButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: (color: string) => ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const on = pressed || state.pressed;
  const color = on || state.hovered ? t.onInverse : t.onInverse2;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...handlers}
      style={{
        width: 30,
        height: 30,
        padding: 0,
        border: 0,
        borderRadius: 6,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        /* Pressed is one step lighter than the bar (--text2 on --inverse); hover is the half step. */
        background: on ? t.text2 : state.hovered ? tokenAlpha("text2", 0.55) : "transparent",
        color,
        ...ring(state.focusVisible),
      }}
    >
      {children(color)}
    </button>
  );
}

const letter: CSSProperties = { fontFamily: FIGTREE, fontSize: 14, lineHeight: 1 };

const Divider = () => <span aria-hidden="true" style={{ width: 1, height: 18, margin: "0 2px", background: t.text2, flexShrink: 0 }} />;

function Glyphed({ name, color }: { name: GlyphName; color: string }) {
  return <Glyph name={name} size={16} color={color} />;
}

// --- the text style menu -------------------------------------------------------------

function styleOf(name: TextStyleName): CSSProperties {
  const scale = postType(false);
  switch (name) {
    case "Title":
      return { ...scale.title, textWrap: "nowrap" };
    case "Heading":
      return { ...scale.heading, textWrap: "nowrap" };
    case "Small":
      return scale.small;
    case "Code":
      return { fontFamily: DM_MONO, fontSize: 13, fontWeight: 400, lineHeight: 1.6, color: t.text };
    default:
      return scale.body;
  }
}

function StyleMenu({ editor, current, onOpenChange }: { editor: Editor; current: TextStyleName; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
      modal={false}
    >
      <Menu.Trigger asChild>
        <MenuButton tone="inverse" label="" value={current} open={open} aria-label="Text style" onMouseDown={(event) => event.preventDefault()} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent
          side="bottom"
          align="start"
          sideOffset={8}
          aria-label="Text style"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.commands.focus();
          }}
          style={menuSurface(240)}
        >
          {TEXT_STYLES.map((name) => (
            <Menu.Item
              key={name}
              onSelect={() => setTextStyle(editor, name)}
              style={{ ...menuItem(true, false), minHeight: name === "Title" ? 44 : 40, padding: "0 12px", justifyContent: "space-between", gap: 12 }}
            >
              <span style={styleOf(name)}>{name}</span>
              {name === current ? <Glyph name="check" size={16} color={t.text2} /> : null}
            </Menu.Item>
          ))}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

// --- the link popover ------------------------------------------------------------------

function LinkPopover({ editor, hasLink, onClose }: { editor: Editor; hasLink: boolean; onClose: () => void }) {
  const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = useState(existing);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const finish = () => {
    onClose();
    editor.commands.focus();
  };

  const save = () => {
    const href = value.trim();
    if (!linkAllowed(href)) {
      setProblem(LINK_SENTENCE);
      field.current?.focus();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
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
          finish();
        }
      }}
      style={{ ...menuSurface(320), position: "absolute", top: `calc(100% + ${GAP}px)`, left: 0, display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}
    >
      <label htmlFor="post-link-address" style={text(12.5, 500, t.text)}>
        Link address
      </label>
      <input
        ref={field}
        id="post-link-address"
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder="https://"
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? "post-link-problem" : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setProblem(null);
        }}
        style={{ ...wellField, height: 36, padding: "0 12px", ...text(13.5, 400, t.text) }}
      />
      {problem ? (
        <p id="post-link-problem" role="alert" style={{ ...text(12, 400, t.text), margin: 0 }}>
          {problem}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {hasLink ? (
          <Button variant="secondary" size={30} fontSize={12} onClick={remove}>
            Remove
          </Button>
        ) : null}
        <Button size={30} fontSize={12} type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

// --- the bar ---------------------------------------------------------------------------

export function FormatBar({ editor, controls, phone }: { editor: Editor | null; controls: PostEditorControls; phone: boolean }) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => readBar(current) }) ?? CLOSED;
  const [linkOpen, setLinkOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [within, setWithin] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  const shown = !phone && Boolean(editor) && state.selecting && (state.focused || linkOpen || menuOpen || within);

  // Cmd or Ctrl with K: the link field over the selection.
  const openLink = useCallback(() => {
    if (!editor || phone || !readBar(editor).selecting) return false;
    setLinkOpen(true);
    return true;
  }, [editor, phone]);
  useEffect(() => {
    controls.openLink.current = openLink;
    return () => {
      controls.openLink.current = null;
    };
  }, [controls, openLink]);

  useEffect(() => {
    if (!shown) setLinkOpen(false);
  }, [shown]);

  const position = useCallback(() => {
    if (!editor || !bar.current) return;
    try {
      const start = editor.view.coordsAtPos(state.from);
      const end = editor.view.coordsAtPos(state.to);
      const top = Math.min(start.top, end.top);
      const bottom = Math.max(start.bottom, end.bottom);
      const center = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
      const width = bar.current.offsetWidth || 260;
      const left = Math.max(GAP, Math.min(center - width / 2, window.innerWidth - width - GAP));

      // Above, unless there is no room or the bar would sit on the Title line of a post.
      const above = top - GAP - BAR_HEIGHT;
      const covers = Array.from(editor.view.dom.querySelectorAll<HTMLElement>('[data-heading="1"]')).some((title) => {
        const box = title.getBoundingClientRect();
        const holdsSelection = box.top <= top && box.bottom >= bottom - 1;
        return !holdsSelection && box.bottom > above && box.top < above + BAR_HEIGHT && box.right > left && box.left < left + width;
      });
      setPlace({ top: above >= GAP && !covers ? above : bottom + GAP, left });
    } catch {
      setPlace(null);
    }
  }, [editor, state.from, state.to]);

  useLayoutEffect(() => {
    if (shown) position();
  }, [shown, position, state.style]);

  useEffect(() => {
    if (!shown) return;
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [shown, position]);

  if (!editor || !shown) return null;

  const toggle = (run: () => boolean) => () => {
    run();
  };

  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label="Format"
      onFocus={() => setWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setWithin(false);
      }}
      style={{
        position: "fixed",
        zIndex: 60,
        top: place?.top ?? -9999,
        left: place?.left ?? 0,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 4,
        borderRadius: 8,
        boxSizing: "border-box",
        background: t.inverse,
        boxShadow: t.windowShadow,
      }}
    >
      <StyleMenu editor={editor} current={state.style} onOpenChange={setMenuOpen} />
      <Divider />
      <BarButton label="Bold" pressed={state.bold} onClick={toggle(() => editor.chain().focus().toggleBold().run())}>
        {() => <span style={{ ...letter, fontWeight: 700 }}>B</span>}
      </BarButton>
      <BarButton label="Italic" pressed={state.italic} onClick={toggle(() => editor.chain().focus().toggleItalic().run())}>
        {(color) => <Glyphed name="italic" color={color} />}
      </BarButton>
      <BarButton label="Underline" pressed={state.underline} onClick={toggle(() => editor.chain().focus().toggleUnderline().run())}>
        {() => <span style={{ ...letter, fontWeight: 500, textDecoration: "underline" }}>U</span>}
      </BarButton>
      <Divider />
      <BarButton label="Bulleted list" pressed={state.bullet} onClick={toggle(() => editor.chain().focus().toggleBulletList().run())}>
        {(color) => <Glyphed name="listBullet" color={color} />}
      </BarButton>
      <BarButton label="Numbered list" pressed={state.ordered} onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())}>
        {(color) => <Glyphed name="listNumber" color={color} />}
      </BarButton>
      <BarButton label="Link" pressed={state.link || linkOpen} onClick={() => setLinkOpen((open) => !open)}>
        {(color) => <Glyphed name="link" color={color} />}
      </BarButton>
      {linkOpen ? <LinkPopover editor={editor} hasLink={state.link} onClose={() => setLinkOpen(false)} /> : null}
    </div>,
    document.body,
  );
}

export default FormatBar;
