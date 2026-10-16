// PictureView: a picture or video in the composer's editor (PT-06).
//
// IT RENDERS PostMedia, so it looks as readers see it. What the editor adds is drawn around the picture, never inside
// it: a size control and a resize corner while it is hovered or selected, a caption under it, and (selected) a row
// with Alt text, Replace and Remove. Width and caption are drawn here, not by PostMedia: the node is handed to
// PostMedia at width 100 with no caption, and this view sets the width on the wrapper and writes the caption itself.
//
// IN A ROW the picture fills the slot the row gives it: no size control, no resize corner, and the wrapper takes
// flex: <ratio> 1 0, which is rowWidths' (100% minus the gaps) times ratio over the sum, so every picture in the row
// is the same height with nothing cropped.

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { PostMedia, ratioOf } from "@/components/post/PostMedia";
import { postType } from "@/components/post/postType";
import { ALT_MAX, CAPTION_MAX, POST_MEDIA_WIDTH_MAX, type PostMediaAttrs, type ThreadPostMedia } from "@/lib/build/thread";
import { clampWidth, limitText, PICTURE_ACCEPT, stepWidth, WIDTH_NAMES, WIDTH_STEPS, widthFromPointer } from "@/lib/build/postMedia";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { menuSurface, text } from "@/pages/site/compose/refinedStyles";

import { removePictureAt, replacePicture, type PictureHost } from "./pictures";

/** What the extension hands its views. */
export interface PictureOptions {
  host: PictureHost;
  /** Below 768px. */
  phone: boolean;
}

/**
 * IconButton asks for a lucide icon as well as a glyph. The glyph is what is drawn, so this names a type only and
 * imports nothing: no new lucide-react import.
 */
const NO_ICON = (() => null) as unknown as ComponentProps<typeof IconButton>["icon"];

/**
 * The size control is a Segmented on a dark plate. Segmented is painted from tokens, so the plate re-points the few it
 * reads: the track goes clear, the chosen segment takes t.text2 (one step lighter than t.inverse), and text is
 * t.onInverse2 with the chosen one in t.onInverse. The two layers are two elements because a custom property that
 * names itself (--text2: var(--text2)) is invalid.
 */
const plateFill = {
  "--seg-track": "transparent",
  "--seg-border": "transparent",
  "--control": t.text2,
  "--control-on": t.text2,
  "--control-border": "transparent",
  "--control-shadow": "none",
} as CSSProperties;
const plateInk = { "--text": t.onInverse, "--text2": t.onInverse2 } as CSSProperties;

function usePictures(host: PictureHost) {
  return useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
}

function insideRow(props: Pick<NodeViewProps, "editor" | "getPos">): boolean {
  try {
    const pos = props.getPos();
    return typeof pos === "number" && props.editor.state.doc.resolve(pos).parent.type.name === "postMediaRow";
  } catch {
    return false;
  }
}

// --- the caption -----------------------------------------------------------------------

function CaptionField({ value, phone, onChange, onDone }: { value: string; phone: boolean; onChange: (value: string) => void; onDone: () => void }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const small = postType(phone).small;

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      {value ? null : (
        <span aria-hidden="true" style={{ ...small, color: t.label, position: "absolute", left: 0, top: 0, pointerEvents: "none", whiteSpace: "nowrap" }}>
          Add a caption
        </span>
      )}
      <textarea
        ref={field}
        aria-label="Caption"
        rows={1}
        value={value}
        onChange={(event) => onChange(limitText(event.target.value.replace(/\n/g, " "), CAPTION_MAX))}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            onDone();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...small,
          // 16 on a phone, so the page does not zoom when the field takes focus.
          fontSize: phone ? 16 : small.fontSize,
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          padding: 0,
          border: 0,
          borderRadius: 6,
          background: "transparent",
          resize: "none",
          overflow: "hidden",
          outline: "none",
          ...ring(focused),
        }}
      />
    </div>
  );
}

// --- the alt text ------------------------------------------------------------------------

function AltPopover({ value, phone, onChange, onClose }: { value: string; phone: boolean; onChange: (value: string) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    const away = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose]);

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Alt text"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      style={{ ...menuSurface(280), position: "absolute", left: 0, top: "calc(100% + 4px)", zIndex: 5, boxSizing: "border-box", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <textarea
        ref={field}
        aria-label="Alt text"
        rows={3}
        value={value}
        onChange={(event) => onChange(limitText(event.target.value, ALT_MAX))}
        style={{
          ...text(phone ? 16 : 13, 400, t.text),
          boxSizing: "border-box",
          width: "100%",
          padding: 8,
          borderRadius: 6,
          resize: "vertical",
          background: t.well,
          border: `1px solid ${t.wellBorder}`,
          outline: "none",
        }}
      />
      <p style={{ ...text(12, 400, t.text2), margin: 0, lineHeight: 1.5 }}>Describe what the picture shows for people who can't see it.</p>
    </div>
  );
}

// --- the view -----------------------------------------------------------------------------

export function PictureView(props: NodeViewProps) {
  const { node, selected, editor, getPos, updateAttributes } = props;
  const { host, phone } = props.extension.options as PictureOptions;
  const snapshot = usePictures(host);
  const attrs = node.attrs as PostMediaAttrs & { uploadId?: string | null };
  const inRow = insideRow(props);

  const [over, setOver] = useState(false);
  const [within, setWithin] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const [altOpen, setAltOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const chooser = useRef<HTMLInputElement>(null);

  const uploading = Boolean(attrs.uploadId);
  const media = typeof attrs.mediaId === "string" ? snapshot.rows.get(attrs.mediaId) : undefined;
  const ratio = ratioOf(attrs, media);
  const stored = clampWidth(typeof attrs.width === "number" ? attrs.width : POST_MEDIA_WIDTH_MAX);
  const width = inRow ? 100 : (dragged ?? stored);
  const controls = (over || selected || within) && !uploading;
  const actions = (selected || altOpen) && !uploading;

  // In a row the slot is flex: <ratio> 1 0, set on the element ProseMirror places in the row.
  useLayoutEffect(() => {
    const slot = wrapper.current?.parentElement;
    if (!slot) return;
    if (inRow) {
      slot.style.flex = `${ratio} 1 0`;
      slot.style.minWidth = "0";
    } else {
      slot.style.removeProperty("flex");
      slot.style.removeProperty("min-width");
    }
  }, [inRow, ratio]);

  const set = (patch: Record<string, unknown>) => updateAttributes(patch);
  const backToText = () => editor.chain().focus().run();

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const box = column.current?.getBoundingClientRect();
    if (!box) return;
    const edge = { left: box.left, width: box.width };
    const move = (moved: PointerEvent) => setDragged(widthFromPointer(moved.clientX, edge));
    const end = (done: PointerEvent, commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setDragged(null);
      if (commit) set({ width: widthFromPointer(done.clientX, edge) });
    };
    const up = (done: PointerEvent) => end(done, true);
    const cancel = (done: PointerEvent) => end(done, false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const resizeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    set({ width: stepWidth(stored, direction) });
  };

  const picture: ThreadPostMedia = { type: "postMedia", attrs: { ...attrs, width: 100, caption: "" } };
  const touch = phone ? 44 : 26;

  return (
    <NodeViewWrapper
      ref={wrapper}
      data-picture=""
      data-in-row={inRow ? "" : undefined}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setWithin(true)}
      onBlur={(event: React.FocusEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setWithin(false);
      }}
      style={{ display: "block", minWidth: 0 }}
    >
      <div ref={column} style={{ width: "100%" }}>
        <div style={{ width: `${width}%`, margin: inRow ? 0 : "0 auto", minWidth: 0 }}>
          <div
            data-drag-handle=""
            data-selected={selected ? "" : undefined}
            style={{ position: "relative", borderRadius: 6, outline: selected ? `1px solid ${t.selectedEdge}` : "none", outlineOffset: 3 }}
          >
            {uploading ? (
              <div
                data-post-media-box=""
                role="progressbar"
                aria-label="Uploading"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={snapshot.progress.get(attrs.uploadId as string) ?? 0}
                style={{ ...text(12, 400, t.text2), aspectRatio: String(ratio), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: t.tile }}
              >
                {`Uploading ${snapshot.progress.get(attrs.uploadId as string) ?? 0}%`}
              </div>
            ) : (
              <PostMedia node={picture} mediaById={snapshot.rows} srcByPath={snapshot.src} phone={phone} inRow />
            )}

            {controls && !inRow ? (
              <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, ...plateFill }}>
                <div style={{ ...plateInk, background: t.inverse, borderRadius: 6, padding: 2 }}>
                  <Segmented
                    label="Picture size"
                    size={phone ? 40 : 26}
                    items={WIDTH_STEPS.map((step) => ({ value: String(step), label: WIDTH_NAMES[step] }))}
                    value={String(stored)}
                    onChange={(value) => set({ width: Number(value) })}
                  />
                </div>
              </div>
            ) : null}

            {controls && !inRow ? (
              <button
                type="button"
                aria-label="Resize picture"
                onPointerDown={startResize}
                onKeyDown={resizeKey}
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                  width: phone ? 44 : 24,
                  height: phone ? 44 : 24,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "nwse-resize",
                  touchAction: "none",
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 6, background: t.inverse, color: t.onInverse, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Glyph name="expand" size={12} />
                </span>
              </button>
            ) : null}
          </div>

          <CaptionField value={typeof attrs.caption === "string" ? attrs.caption : ""} phone={phone} onChange={(caption) => set({ caption })} onDone={backToText} />

          {actions ? (
            <div style={{ position: "relative", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Button
                variant="secondary"
                size={phone ? 44 : 28}
                fontSize={12}
                aria-expanded={altOpen}
                aria-haspopup="dialog"
                onClick={() => setAltOpen((open) => !open)}
                style={{ height: touch }}
              >
                Alt text
              </Button>
              <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => chooser.current?.click()} style={{ height: touch }}>
                Replace
              </Button>
              <IconButton
                icon={NO_ICON}
                glyph="x"
                label="Remove picture"
                size={26}
                onClick={() => {
                  const pos = getPos();
                  if (typeof pos === "number") removePictureAt(editor, pos);
                }}
                style={{ width: touch, height: touch }}
              />
              {altOpen ? (
                <AltPopover
                  value={typeof attrs.alt === "string" ? attrs.alt : ""}
                  phone={phone}
                  onChange={(alt) => set({ alt })}
                  onClose={() => setAltOpen(false)}
                />
              ) : null}
              <input
                ref={chooser}
                type="file"
                accept={PICTURE_ACCEPT}
                hidden
                data-testid="picture-replace"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  const pos = getPos();
                  if (file && typeof pos === "number") void replacePicture(host, pos, file);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export default PictureView;
