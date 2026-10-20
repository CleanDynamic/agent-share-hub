// EditMediaDialog: Edit on a picture, as X has it (CA-07 P5).
//
// Three tabs: Crop (Original, Wide or Square, zoom 1 to 3, drag the picture in the frame), ALT (a description of up to
// 1,000 characters) and Content warning (Nudity, Violence, Sensitive). With two or more pictures in the post a row of
// thumbnails switches which one is being edited, and every change is kept until Save or Back. Save writes them all in
// one transaction, so one Undo takes them back; Back and Esc close without saving. The file in storage is never changed:
// a crop is a rectangle the grid shows (cropStyle).
//
// Built as the composer's dialogs are (AddCodeDialog): a Radix dialog, so focus stays inside, and it goes back to the
// tile's Edit pill when it closes.

import * as Dialog from "@radix-ui/react-dialog";
import type { Editor } from "@tiptap/react";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { stillFor } from "@/components/gallery/cardMedia";
import { landedKey, setPictureAttrs, type EditRequest, type PictureHost } from "@/components/post/editor/pictures";
import { limitText } from "@/lib/build/postMedia";
import { ALT_MAX, mediaAttrsOf, MEDIA_WARNINGS, ZOOM_MAX, ZOOM_MIN, type CropAspect, type MediaWarning, type PostMediaAttrs } from "@/lib/build/thread";
import { ring } from "@/lib/theme/controls";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { Field } from "@/pages/site/compose/composeControls";
import { dialogTitle, text, windowStyle } from "@/pages/site/compose/refinedStyles";

import { centreOf, croppedRatio, cropFor, cropStyle, dragView, frameRatio, storedCrop, ZOOM_KEY_STEP, ZOOM_STEP, type CropView } from "./cropStyle";
import { tileKind, type TileKind } from "./GridTile";
import { THIRDS_LINE } from "./shade";

export type EditTab = "crop" | "alt" | "warn";

/** Every sentence the dialog says. */
export const EDIT_COPY = {
  back: "Back without saving",
  save: "Save",
  titles: { crop: "Crop media", alt: "Description", warn: "Content warning" } as Record<EditTab, string>,
  tabs: { crop: "Crop", alt: "ALT", warn: "Content warning" } as Record<EditTab, string>,
  noCrop: "GIFs and videos can't be cropped",
  frame: "Crop area. Drag or use the arrow keys to move the picture, plus and minus to zoom.",
  shapes: { original: "Original", wide: "Wide", square: "Square" } as Record<CropAspect, string>,
  zoom: "Zoom",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  description: "Description",
  placeholder: "Describe what is in the picture for people who can't see it",
  badgeNote: "Readers see an ALT badge on the picture.",
  warnLine: "Choose a warning and readers see it before the picture, with a button to show it.",
  warnings: { nudity: "Nudity", violence: "Violence", sensitive: "Sensitive" } as Record<MediaWarning, string>,
} as const;

/** The frame is never taller than this. */
const FRAME_MAX_HEIGHT = 360;
/** The ALT and warning tabs show the picture at most this tall. */
const PREVIEW_MAX_HEIGHT = 200;
const THUMB = 44;

const SHAPE_GLYPHS: Record<CropAspect, GlyphName> = { original: "image", wide: "shapeWide", square: "shapeSquare" };

/** IconButton asks for a lucide icon as well as a glyph; the glyph is what is drawn. */
const NO_ICON = (() => null) as unknown as ComponentProps<typeof IconButton>["icon"];

interface Draft {
  aspect: CropAspect;
  zoom: number;
  cx: number;
  cy: number;
  /** The crop tab was used: crop, aspect and zoom are written. */
  cropped: boolean;
  alt: string;
  warn: MediaWarning[];
}

interface Item {
  attrs: PostMediaAttrs;
  kind: TileKind;
  /** The picture's width over height. */
  ratio: number;
  still: string | null;
}

const draftOf = (attrs: PostMediaAttrs): Draft => ({
  aspect: attrs.aspect ?? "original",
  zoom: attrs.zoom ?? 1,
  ...centreOf(attrs.crop),
  cropped: false,
  alt: attrs.alt,
  warn: [...attrs.warn],
});

const between = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const roundZoom = (value: number) => Math.round(between(value, ZOOM_MIN, ZOOM_MAX) * 100) / 100;

/** What changed in a picture's draft, as attributes, or null when nothing did. */
export function patchOf(item: Pick<Item, "attrs" | "kind" | "ratio">, draft: Draft): Partial<PostMediaAttrs> | null {
  const patch: Partial<PostMediaAttrs> = {};
  if (draft.alt !== item.attrs.alt) patch.alt = draft.alt;
  const warn = MEDIA_WARNINGS.filter((name) => draft.warn.includes(name));
  if (warn.join() !== item.attrs.warn.join()) patch.warn = warn;
  if (draft.cropped && item.kind === "image") {
    const view: CropView = { ratio: item.ratio, frame: frameRatio(draft.aspect, item.ratio), zoom: draft.zoom, cx: draft.cx, cy: draft.cy };
    const crop = storedCrop(draft.aspect, view);
    patch.crop = crop;
    patch.aspect = crop ? draft.aspect : null;
    patch.zoom = crop ? draft.zoom : null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export interface EditMediaDialogProps {
  request: EditRequest | null;
  editor: Editor | null;
  host: PictureHost;
  phone: boolean;
  onClose: () => void;
}

export function EditMediaDialog({ request, editor, host, phone, onClose }: EditMediaDialogProps) {
  const open = Boolean(request && editor);
  // Kept past the close: the request is gone by the time focus goes back.
  const returnTo = useRef<HTMLElement | null>(null);
  if (request) returnTo.current = request.returnTo;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="edit-media-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnTo.current?.focus();
          }}
          style={
            phone
              ? { position: "fixed", inset: 0, zIndex: 51, background: t.window, padding: 16, overflowY: "auto", boxSizing: "border-box" }
              : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(600) }
          }
        >
          {request && editor ? <Body key={`${request.gridPos}-${request.index}-${request.tab}`} request={request} editor={editor} host={host} phone={phone} onClose={onClose} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ request, editor, host, phone, onClose }: { request: EditRequest; editor: Editor; host: PictureHost; phone: boolean; onClose: () => void }) {
  const snapshot = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  // The grid as it was when Edit was pressed.
  const items = useMemo<Item[]>(() => {
    const grid = editor.state.doc.nodeAt(request.gridPos);
    const out: Item[] = [];
    grid?.forEach((child) => {
      const attrs = mediaAttrsOf(child.toJSON());
      const media = snapshot.rows.get(attrs.mediaId);
      const preview = snapshot.previews.get(landedKey(attrs.mediaId)) ?? null;
      const kind = tileKind(media, preview);
      const w = attrs.w ?? media?.width ?? null;
      const h = attrs.h ?? media?.height ?? null;
      const still = preview?.kind === "image" ? preview.url : media && (kind !== "video" || media.poster_path) ? stillFor(snapshot.src, media) : null;
      out.push({ attrs, kind, ratio: croppedRatio({ w, h, crop: null }), still });
    });
    return out;
    // Read once, as the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, request.gridPos]);

  const [index, setIndex] = useState(Math.min(request.index, Math.max(0, items.length - 1)));
  const [drafts, setDrafts] = useState<Draft[]>(() => items.map((item) => draftOf(item.attrs)));
  const item = items[index];
  const canCrop = item?.kind === "image";
  const [tab, setTab] = useState<EditTab>(request.tab === "crop" && !canCrop ? "alt" : request.tab);
  const shown: EditTab = tab === "crop" && !canCrop ? "alt" : tab;
  const ids = useId();

  if (!item) return null;
  const draft = drafts[index];
  const change = (patch: Partial<Draft>) => setDrafts((all) => all.map((one, at) => (at === index ? { ...one, ...patch } : one)));

  const save = () => {
    const patches = new Map<number, Partial<PostMediaAttrs>>();
    items.forEach((one, at) => {
      const patch = patchOf(one, drafts[at]);
      if (patch) patches.set(at, patch);
    });
    setPictureAttrs(editor, request.gridPos, patches);
    onClose();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton icon={NO_ICON} glyph="larr" label={EDIT_COPY.back} size={30} boxed={false} onClick={onClose} />
        <Dialog.Title style={{ ...dialogTitle, margin: 0, flex: "1 1 auto" }}>{EDIT_COPY.titles[shown]}</Dialog.Title>
        <Button size={phone ? 44 : 32} onClick={save}>
          {EDIT_COPY.save}
        </Button>
      </div>
      <UnderlineTabs<EditTab>
        label="Edit"
        value={shown}
        onChange={setTab}
        tabs={[
          { value: "crop", label: EDIT_COPY.tabs.crop, glyph: "crop", disabled: !canCrop, title: canCrop ? EDIT_COPY.tabs.crop : EDIT_COPY.noCrop, id: `${ids}-crop`, controls: `${ids}-panel` },
          { value: "alt", label: EDIT_COPY.tabs.alt, id: `${ids}-alt`, controls: `${ids}-panel` },
          { value: "warn", label: EDIT_COPY.tabs.warn, glyph: "flag", id: `${ids}-warn`, controls: `${ids}-panel` },
        ]}
      />
      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${shown}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {shown === "crop" ? <CropTab item={item} draft={draft} change={(patch) => change({ ...patch, cropped: true })} phone={phone} /> : null}
        {shown === "alt" ? <AltTab item={item} draft={draft} change={change} phone={phone} id={`${ids}-alt-field`} /> : null}
        {shown === "warn" ? <WarnTab item={item} draft={draft} change={change} phone={phone} /> : null}
      </div>
      {items.length > 1 ? (
        <div role="group" aria-label="Pictures in this post" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {items.map((one, at) => (
            <Thumb key={at} item={one} at={at} count={items.length} current={at === index} onPick={() => setIndex(at)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Thumb({ item, at, count, current, onPick }: { item: Item; at: number; count: number; current: boolean; onPick: () => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Picture ${at + 1} of ${count}`}
      aria-pressed={current}
      data-thumb={at}
      onClick={onPick}
      onFocus={(event) => setFocus(event.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocus(false)}
      style={{
        position: "relative",
        flex: "none",
        width: THUMB,
        height: THUMB,
        padding: 0,
        boxSizing: "border-box",
        borderRadius: 6,
        overflow: "hidden",
        border: `2px solid ${current ? t.text : "transparent"}`,
        background: t.tile,
        cursor: "pointer",
        ...ring(focus),
      }}
    >
      {item.still ? <img src={item.still} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
    </button>
  );
}

/** The picture, contained, at most 200 tall: the ALT and warning tabs. */
function Contained({ item }: { item: Item }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", background: t.well, borderRadius: 6, padding: 8 }}>
      {item.still ? (
        <img src={item.still} alt="" data-contained="" style={{ maxWidth: "100%", maxHeight: PREVIEW_MAX_HEIGHT, objectFit: "contain", display: "block" }} />
      ) : (
        <span data-contained="" style={{ display: "block", height: PREVIEW_MAX_HEIGHT / 2, aspectRatio: String(item.ratio), maxWidth: "100%", background: t.tile }} />
      )}
    </div>
  );
}

function CropTab({ item, draft, change, phone }: { item: Item; draft: Draft; change: (patch: Partial<Draft>) => void; phone: boolean }) {
  const frame = frameRatio(draft.aspect, item.ratio);
  const view: CropView = { ratio: item.ratio, frame, zoom: draft.zoom, cx: draft.cx, cy: draft.cy };
  const crop = cropFor(view);
  const box = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false);
  const zoomId = useId();

  const setView = (next: CropView) => {
    const shownCrop = cropFor(next);
    change({ zoom: next.zoom, cx: shownCrop.x + shownCrop.w / 2, cy: shownCrop.y + shownCrop.h / 2 });
  };
  const zoomTo = (zoom: number) => setView({ ...view, zoom: roundZoom(zoom) });

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, view };
    const move = (moved: PointerEvent) => setView(dragView(start.view, (moved.clientX - start.x) / rect.width, (moved.clientY - start.y) / rect.height));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) {
      event.preventDefault();
      // The arrow moves the picture; the frame's view goes the other way.
      const [dx, dy] = moves[event.key];
      setView(dragView(view, -dx, -dy));
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomTo(draft.zoom + ZOOM_KEY_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomTo(draft.zoom - ZOOM_KEY_STEP);
    }
  };

  const line = (style: CSSProperties) => <span aria-hidden="true" data-third="" style={{ position: "absolute", background: THIRDS_LINE, pointerEvents: "none", ...style }} />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", background: t.well, borderRadius: 6, padding: 16, minHeight: 120 }}>
        <div
          ref={box}
          role="img"
          tabIndex={0}
          aria-label={EDIT_COPY.frame}
          data-crop-frame=""
          data-aspect={draft.aspect}
          onPointerDown={startDrag}
          onKeyDown={onKey}
          onFocus={(event) => setFocus(event.currentTarget.matches(":focus-visible"))}
          onBlur={() => setFocus(false)}
          style={{
            position: "relative",
            width: `min(100%, ${Math.round(FRAME_MAX_HEIGHT * frame)}px)`,
            aspectRatio: String(Math.round(frame * 1e4) / 1e4),
            overflow: "hidden",
            boxSizing: "border-box",
            border: `2px solid ${t.text}`,
            background: t.tile,
            cursor: "grab",
            touchAction: "none",
            ...ring(focus),
          }}
        >
          {item.still ? <img src={item.still} alt="" draggable={false} data-crop-img="" style={{ ...cropStyle({ w: item.ratio, h: 1, crop }, frame), userSelect: "none", pointerEvents: "none" }} /> : null}
          {line({ left: "33.333%", top: 0, bottom: 0, width: 1 })}
          {line({ left: "66.667%", top: 0, bottom: 0, width: 1 })}
          {line({ top: "33.333%", left: 0, right: 0, height: 1 })}
          {line({ top: "66.667%", left: 0, right: 0, height: 1 })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div role="group" aria-label="Shape" style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 6, background: t.segTrack, border: `1px solid ${t.segBorder}` }}>
          {(["original", "wide", "square"] as const).map((aspect) => (
            <ShapeButton
              key={aspect}
              aspect={aspect}
              pressed={draft.aspect === aspect}
              phone={phone}
              onPress={() => {
                const nextFrame = frameRatio(aspect, item.ratio);
                const next = cropFor({ ...view, frame: nextFrame });
                change({ aspect, cx: next.x + next.w / 2, cy: next.y + next.h / 2 });
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 200px" }}>
          <IconButton icon={NO_ICON} glyph="zoomOut" label={EDIT_COPY.zoomOut} size={28} disabled={draft.zoom <= ZOOM_MIN} onClick={() => zoomTo(draft.zoom - ZOOM_STEP)} />
          <div style={{ flex: "1 1 auto" }}>
            <Field id={zoomId} label={EDIT_COPY.zoom}>
              {/* The codebase has no slider of its own; a native range, held to the refined look (see lookRules). */}
              <input
                id={zoomId}
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={draft.zoom}
                onChange={(event) => zoomTo(Number(event.target.value))}
                style={{ width: "100%", accentColor: t.text, margin: 0, minHeight: phone ? 44 : undefined }}
              />
            </Field>
          </div>
          <IconButton icon={NO_ICON} glyph="zoomIn" label={EDIT_COPY.zoomIn} size={28} disabled={draft.zoom >= ZOOM_MAX} onClick={() => zoomTo(draft.zoom + ZOOM_STEP)} />
        </div>
      </div>
    </>
  );
}

function ShapeButton({ aspect, pressed, phone, onPress }: { aspect: CropAspect; pressed: boolean; phone: boolean; onPress: () => void }) {
  const [focus, setFocus] = useState(false);
  const side = phone ? 44 : 28;
  return (
    <button
      type="button"
      aria-label={EDIT_COPY.shapes[aspect]}
      title={EDIT_COPY.shapes[aspect]}
      aria-pressed={pressed}
      data-shape-button={aspect}
      onClick={onPress}
      onFocus={(event) => setFocus(event.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocus(false)}
      style={{
        width: side,
        height: side,
        padding: 0,
        boxSizing: "border-box",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: pressed ? t.text : t.text2,
        border: "1px solid transparent",
        background: "transparent",
        ...(pressed ? CONTROL : null),
        ...ring(focus),
      }}
    >
      <Glyph name={SHAPE_GLYPHS[aspect]} size={16} />
    </button>
  );
}

function AltTab({ item, draft, change, phone, id }: { item: Item; draft: Draft; change: (patch: Partial<Draft>) => void; phone: boolean; id: string }) {
  const [focus, setFocus] = useState(false);
  const count = [...draft.alt].length;
  return (
    <>
      <Contained item={item} />
      <Field id={id} label={EDIT_COPY.description}>
        <textarea
          id={id}
          rows={4}
          value={draft.alt}
          placeholder={EDIT_COPY.placeholder}
          onChange={(event) => change({ alt: limitText(event.target.value, ALT_MAX) })}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
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
            ...ring(focus),
          }}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={text(12, 400, t.text2)}>{EDIT_COPY.badgeNote}</span>
        <span data-alt-count="" style={{ ...text(12, 400, t.text2), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{`${count.toLocaleString("en-US")} / ${ALT_MAX.toLocaleString("en-US")}`}</span>
      </div>
    </>
  );
}

function WarnTab({ item, draft, change, phone }: { item: Item; draft: Draft; change: (patch: Partial<Draft>) => void; phone: boolean }) {
  return (
    <>
      <Contained item={item} />
      <p style={{ ...text(13, 400, t.text2), margin: 0, lineHeight: 1.5 }}>{EDIT_COPY.warnLine}</p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {MEDIA_WARNINGS.map((name) => {
          const on = draft.warn.includes(name);
          return (
            <label key={name} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: phone ? 44 : 40, cursor: "pointer", fontFamily: FIGTREE, fontSize: 13, color: t.text }}>
              <Checkbox checked={on} onChange={() => change({ warn: on ? draft.warn.filter((one) => one !== name) : [...draft.warn, name] })} />
              {EDIT_COPY.warnings[name]}
            </label>
          );
        })}
      </div>
    </>
  );
}

export default EditMediaDialog;
