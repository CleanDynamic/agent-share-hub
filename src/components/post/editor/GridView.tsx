// GridView: a post's pictures in the composer's editor (CA-07).
//
// The node view of postMediaGrid. ProseMirror draws none of the grid's children and hands it every event inside it
// (extensions.ts), so the tiles, their buttons and their order are all React's. It reads the pictures from the node and
// the files from the picture store, and changes the document only through pictures.ts, one transaction per change, so
// one Undo takes each back.
//
// EACH TILE: Edit at the top left once it has uploaded, × at the top right (Stop uploading while it uploads), the
// file itself at 55% with a bar along the bottom while it uploads, 30% with Did not upload and Retry when it failed.
// With two or more they are dragged to reorder (@dnd-kit/sortable, pointer and keyboard; press and hold on a phone),
// or moved one place with Alt and an arrow. A focused tile opens Edit on Enter and goes on Backspace or Delete.
//
// ON A PHONE two or more are a strip that scrolls sideways while the maker writes; readers still get the grid.

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { horizontalListSortingStrategy, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { forwardRef, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { GridTile, tileKind, tileLabel } from "@/components/post/media/GridTile";
import { croppedRatio } from "@/components/post/media/cropStyle";
import { GridFrame, gridLayout, GRID_RADIUS, sourcesOf, type GridCell } from "@/components/post/media/PostMediaGrid";
import { PICTURE_INK, PICTURE_SHADE, PROGRESS_TRACK } from "@/components/post/media/shade";
import { focusVisible } from "@/components/post/RefLinks";
import { descriptionLabel, firstUndescribed, GRID_LINKS_COPY, linkedStep, stepGroupsOf } from "@/lib/build/gridSteps";
import { mediaAttrsOf, type PostMediaAttrs } from "@/lib/build/thread";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { landedKey, movePicture, removePicture, retryUpload, setGridStep, stopUpload, type PictureHost } from "./pictures";
import { ReferencePicker } from "./ReferencePicker";

/** What the extension hands its views. */
export interface PictureOptions {
  host: PictureHost;
  /** Below 768px. */
  phone: boolean;
}

/** A picture uploading is drawn at this strength; one that failed at FAILED_OPACITY. */
export const UPLOADING_OPACITY = 0.55;
export const FAILED_OPACITY = 0.3;
/** The phone's strip: each tile this tall, at most this share of the column wide, 8 apart. */
export const STRIP_HEIGHT = 180;
export const STRIP_MAX_WIDTH = "78%";
/** The controls on a tile, 8 in from its corners. */
const INSET = 8;
const REMOVE_SIZE = 32;
const EDIT_HEIGHT = 30;
/** A phone's hit area round a 32 shape. */
const TOUCH = 44;

/** "Picture moved to 3 of 4." */
export function movedSentence(to: number, count: number): string {
  return `Picture moved to ${to + 1} of ${count}.`;
}

interface Picture {
  attrs: PostMediaAttrs;
  uploadId: string | null;
  failed: boolean;
  /** dnd-kit's id: stable while the picture is in the grid. */
  key: string;
}

/** A round control drawn on a picture: the shade, white ink. On a phone it sits in a 44 hit area. */
function ShadeButton({ label, phone, corner, onPress, children, style }: { label: string; phone: boolean; corner: "left" | "right"; onPress: (el: HTMLElement) => void; children: ReactNode; style?: CSSProperties }) {
  const [ring, setRing] = useState(false);
  const pad = phone ? (TOUCH - REMOVE_SIZE) / 2 : 0;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress(event.currentTarget);
      }}
      onFocus={(event) => setRing(focusVisible(event.currentTarget))}
      onBlur={() => setRing(false)}
      style={{
        position: "absolute",
        top: INSET - pad,
        [corner]: INSET - pad,
        zIndex: 2,
        padding: pad,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        ...style,
      }}
    >
      <span
        data-shape=""
        style={{
          boxSizing: "border-box",
          minWidth: REMOVE_SIZE,
          height: REMOVE_SIZE,
          borderRadius: 999,
          background: PICTURE_SHADE,
          color: PICTURE_INK,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: ring ? `0 0 0 2px ${PICTURE_INK}` : undefined,
        }}
      >
        {children}
      </span>
    </button>
  );
}

function SortableTile({
  picture,
  index,
  count,
  cell,
  style,
  host,
  phone,
  gridPos,
  onKey,
  sortable,
  cover = false,
}: {
  cover?: boolean;
  picture: Picture;
  index: number;
  count: number;
  cell: GridCell;
  style: CSSProperties;
  host: PictureHost;
  phone: boolean;
  gridPos: () => number | null;
  onKey: (event: KeyboardEvent<HTMLDivElement>, index: number, el: HTMLElement) => void;
  sortable: boolean;
}) {
  const snapshot = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: picture.key, disabled: !sortable });
  const [ring, setRing] = useState(false);
  const { attrs, uploadId, failed } = picture;
  const media = snapshot.rows.get(attrs.mediaId);
  // While it uploads, the file itself; once landed, still the file until its signed copy arrives.
  const preview = uploadId ? (snapshot.previews.get(uploadId) ?? null) : media && snapshot.src.has(media.path) ? null : (snapshot.previews.get(landedKey(attrs.mediaId)) ?? null);
  const kind = tileKind(media, preview);
  const uploading = Boolean(uploadId) && !failed;
  const percent = uploadId ? (snapshot.progress.get(uploadId) ?? 0) : 100;
  const editor = host.editor.current;

  const remove = () => {
    if (uploadId) return stopUpload(host, uploadId);
    const at = gridPos();
    if (editor && at !== null) removePicture(editor, at, index);
  };
  const edit = (el: HTMLElement) => {
    const at = gridPos();
    if (at !== null) host.openEdit.current?.({ gridPos: at, index, tab: kind === "image" ? "crop" : "alt", returnTo: el });
  };

  return (
    <div
      ref={setNodeRef}
      data-grid-tile={index}
      data-uploading={uploading ? "" : undefined}
      data-failed={failed ? "" : undefined}
      {...attributes}
      {...listeners}
      aria-roledescription={sortable ? "sortable picture" : undefined}
      aria-label={tileLabel(attrs.alt, kind, index, count)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onKey(event, index, event.currentTarget);
        if (!event.defaultPrevented) listeners?.onKeyDown?.(event);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setRing(focusVisible(event.currentTarget));
      }}
      onBlur={() => setRing(false)}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 3 : undefined,
        cursor: sortable ? "grab" : "default",
        touchAction: sortable && phone ? "manipulation" : undefined,
        boxShadow: ring ? `inset 0 0 0 2px ${t.text}` : undefined,
      }}
    >
      <GridTile
        attrs={attrs}
        media={media}
        srcByPath={snapshot.src}
        cellRatio={cell.ratio}
        align={cell.align}
        index={index}
        count={count}
        preview={preview}
        badges={!uploadId}
        pictureStyle={uploadId ? { opacity: failed ? FAILED_OPACITY : UPLOADING_OPACITY } : undefined}
        cover={cover}
      >
        {!uploadId ? (
          <button
            type="button"
            data-edit-pill=""
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              edit(event.currentTarget);
            }}
            style={{
              position: "absolute",
              top: phone ? INSET - (TOUCH - EDIT_HEIGHT) / 2 : INSET,
              left: INSET,
              zIndex: 2,
              boxSizing: "content-box",
              height: EDIT_HEIGHT,
              padding: phone ? `${(TOUCH - EDIT_HEIGHT) / 2}px 0` : 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <span
              style={{
                height: EDIT_HEIGHT,
                padding: "0 12px",
                borderRadius: 999,
                background: PICTURE_SHADE,
                color: PICTURE_INK,
                fontFamily: FIGTREE,
                fontSize: 13,
                fontWeight: 600,
                lineHeight: `${EDIT_HEIGHT}px`,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Edit
            </span>
          </button>
        ) : null}
        <ShadeButton label={uploading ? "Stop uploading" : "Remove"} phone={phone} corner="right" onPress={remove}>
          <Glyph name="x" size={18} color="currentColor" />
        </ShadeButton>
        {uploading ? (
          <span
            role="progressbar"
            aria-label="Uploading"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            data-upload-bar=""
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: PROGRESS_TRACK, zIndex: 1 }}
          >
            <span data-upload-fill="" style={{ display: "block", height: 3, width: `${percent}%`, background: PICTURE_INK }} />
          </span>
        ) : null}
        {failed ? (
          <span style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text }}>Did not upload</span>
            <Button
              variant="secondary"
              size={phone ? 44 : 30}
              fontSize={13}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (uploadId) void retryUpload(host, uploadId);
              }}
            >
              Retry
            </Button>
          </span>
        ) : null}
      </GridTile>
    </div>
  );
}

/** CA-07 P6: Link a step and Add description, 8 under the grid, 16 apart, in --text2 at 13 with a 16 glyph. */
function GridLinks({ host, phone, step, pictures, gridPos }: { host: PictureHost; phone: boolean; step: string | null; pictures: readonly Picture[]; gridPos: () => number | null }) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const linkButton = useRef<HTMLButtonElement>(null);
  const steps = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot).steps;
  const linked = linkedStep(step, steps?.lookup);
  const editor = host.editor.current;
  const done = pictures.filter((picture) => !picture.uploadId);
  const alts = done.map((picture) => picture.attrs.alt);

  const close = () => {
    setOpen(false);
    linkButton.current?.focus();
  };
  const choose = (to: string | null) => {
    const at = gridPos();
    if (editor && at !== null) setGridStep(editor, at, to);
    close();
  };

  return (
    <div data-grid-links="" style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
      {steps ? (
        <LinkRowButton
          ref={linkButton}
          glyph="step"
          phone={phone}
          strong={Boolean(linked)}
          expanded={open}
          onPress={(el) => {
            const rect = el.getBoundingClientRect();
            setAnchor({ top: rect.bottom, left: rect.left });
            setOpen(true);
          }}
        >
          {linked ? GRID_LINKS_COPY.linked(linked) : GRID_LINKS_COPY.link}
        </LinkRowButton>
      ) : null}
      {done.length > 0 ? (
        <LinkRowButton
          glyph="pencil"
          phone={phone}
          onPress={(el) => {
            const at = gridPos();
            if (at === null) return;
            const index = pictures.indexOf(done[firstUndescribed(alts)]);
            host.openEdit.current?.({ gridPos: at, index, tab: "alt", returnTo: el });
          }}
        >
          {descriptionLabel(alts)}
        </LinkRowButton>
      ) : null}
      {steps ? (
        <ReferencePicker
          open={open}
          groups={stepGroupsOf(steps.groups)}
          current={linked?.to ?? null}
          anchor={anchor}
          phone={phone}
          removeLabel={GRID_LINKS_COPY.notLinked}
          onChoose={(entry) => choose(entry.to)}
          onRemove={() => choose(null)}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

const LinkRowButton = forwardRef<HTMLButtonElement, { glyph: GlyphName; phone: boolean; strong?: boolean; expanded?: boolean; onPress: (el: HTMLElement) => void; children: ReactNode }>(
  function LinkRowButton({ glyph, phone, strong = false, expanded, onPress, children }, ref) {
    const { state, handlers } = useInteractive<HTMLButtonElement>();
    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={expanded}
        aria-haspopup={expanded === undefined ? "dialog" : "listbox"}
        onClick={(event) => onPress(event.currentTarget)}
        {...handlers}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: phone ? 44 : 24,
          padding: 0,
          border: 0,
          borderRadius: 4,
          background: "transparent",
          cursor: "pointer",
          fontFamily: FIGTREE,
          fontSize: 13,
          fontWeight: 400,
          color: strong || state.hovered ? t.text : t.text2,
          ...ring(state.focusVisible),
        }}
      >
        <Glyph name={glyph} size={16} />
        {children}
      </button>
    );
  },
);

export function GridView(props: NodeViewProps) {
  const { node, getPos } = props;
  const { host, phone } = props.extension.options as PictureOptions;
  const snapshot = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);

  // dnd-kit needs an id that follows a picture while it moves: its upload's, its file's, then its place.
  const seen = new Map<string, number>();
  const pictures: Picture[] = [];
  node.forEach((child) => {
    const attrs = mediaAttrsOf(child.toJSON());
    const uploadId = (child.attrs.uploadId as string | null) ?? null;
    const base = uploadId ?? (attrs.mediaId || "picture");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    pictures.push({ attrs, uploadId, failed: child.attrs.failed === true, key: n ? `${base}#${n}` : base });
  });
  const count = pictures.length;
  const sortable = count > 1;
  const strip = phone && count > 1;

  const gridPos = () => {
    const at = getPos();
    return typeof at === "number" ? at : null;
  };
  const editor = host.editor.current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // A phone: press and hold to drag, so a swipe still scrolls the strip.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );

  const move = (from: number, to: number) => {
    const at = gridPos();
    if (!editor || at === null || to < 0 || to >= count) return false;
    if (!movePicture(editor, at, from, to)) return false;
    setSaid(movedSentence(to, count));
    return true;
  };

  const focusTile = (index: number) => {
    // The node view draws again after the move; focus the tile that is now there.
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-grid-tile="${index}"]`)?.focus());
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>, index: number, el: HTMLElement) => {
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const to = index + (event.key === "ArrowLeft" ? -1 : 1);
      if (move(index, to)) focusTile(to);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picture = pictures[index];
      if (picture.uploadId) return;
      const at = gridPos();
      const kind = tileKind(snapshot.rows.get(picture.attrs.mediaId));
      if (at !== null) host.openEdit.current?.({ gridPos: at, index, tab: kind === "image" ? "crop" : "alt", returnTo: el.querySelector<HTMLElement>("[data-edit-pill]") ?? el });
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const picture = pictures[index];
      if (picture.uploadId) stopUpload(host, picture.uploadId);
      else {
        const at = gridPos();
        if (editor && at !== null) removePicture(editor, at, index);
      }
      editor?.commands.focus();
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = pictures.findIndex((picture) => picture.key === active.id);
    const to = pictures.findIndex((picture) => picture.key === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const sources = sourcesOf(
    pictures.map((picture) => picture.attrs),
    snapshot.rows,
  );
  const layout = gridLayout(sources);
  const tile = (picture: Picture, index: number, cell: GridCell, style: CSSProperties) => (
    <SortableTile key={picture.key} picture={picture} index={index} count={count} cell={cell} style={style} host={host} phone={phone} gridPos={gridPos} onKey={onKey} sortable={sortable} cover={strip} />
  );

  return (
    <NodeViewWrapper data-grid-view="" contentEditable={false} ref={root}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pictures.map((picture) => picture.key)} strategy={strip ? horizontalListSortingStrategy : rectSortingStrategy}>
          {strip ? (
            <div
              role="group"
              aria-label={`${count} pictures`}
              data-post-media-strip=""
              style={{ display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
            >
              {pictures.map((picture, index) => {
                const ratio = croppedRatio(sources[index]);
                return tile(picture, index, { ratio, align: "middle", area: {} }, {
                  position: "relative",
                  flex: "none",
                  height: STRIP_HEIGHT,
                  aspectRatio: String(Math.round(ratio * 1e4) / 1e4),
                  maxWidth: STRIP_MAX_WIDTH,
                  overflow: "hidden",
                  boxSizing: "border-box",
                  borderRadius: GRID_RADIUS,
                  border: `1px solid ${t.hairline}`,
                  background: t.tile,
                  scrollSnapAlign: "start",
                });
              })}
            </div>
          ) : (
            <GridFrame layout={layout} count={count} renderCell={(index, style, cell) => tile(pictures[index], index, cell, style)} />
          )}
        </SortableContext>
      </DndContext>
      <GridLinks host={host} phone={phone} step={(node.attrs.step as string | null) ?? null} pictures={pictures} gridPos={gridPos} />
      <span role="status" aria-live="polite">
        <VisuallyHidden>{said}</VisuallyHidden>
      </span>
    </NodeViewWrapper>
  );
}

export default GridView;
