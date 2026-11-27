/* Crop or blur an attached picture: the picture whole, two tools (Crop, Blur a rectangle), drawn by dragging over it. Crop keeps
   only the rectangle; Blur blurs it in place, as many times as needed. Save hands the edited picture back as a new file, which
   the page uploads in place of the old one (`replacePicture`), so nothing private is kept.

   The picture is read through its signed link into a bitmap (fetch, then `createImageBitmap`), so the canvas can be written out. */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { Attachment } from "@/lib/build/attachments";
import { getMediaById, signedMediaUrl } from "@/lib/build/media";
import { normaliseRect, toImageRect, type Rect } from "@/lib/build/pictureEdit";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";
import { space } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";
import { LAYER } from "@/pages/site/compose/layers";
import { HEADER, HEADER_TEXT, IconSquare, Inline, RecipeButton, SegmentedField, scrimAt, windowPlacement } from "@/pages/site/compose/modalRecipes";

export const PICTURE_EDITOR_COPY = {
  title: (name: string) => `Edit ${name}`,
  crop: "Crop",
  blur: "Blur a rectangle",
  apply: "Apply",
  save: "Save picture",
  hint: "Drag over the picture to draw the rectangle.",
  loading: "Opening the picture",
  failed: "The picture couldn't be opened. Try again.",
} as const;

type Tool = "crop" | "blur";
const SHOWN_MAX = 560;
const BLUR_PX = 16;

/** The rectangle blurred in place, or pixelated where the browser cannot filter a canvas. */
function blurInPlace(canvas: HTMLCanvasElement, rect: Rect): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const into = copy.getContext("2d");
  if (!into) return;
  if (typeof (into as { filter?: unknown }).filter === "string") {
    into.filter = `blur(${BLUR_PX}px)`;
    into.drawImage(canvas, 0, 0);
    ctx.drawImage(copy, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  const small = Math.max(1, Math.round(Math.min(rect.width, rect.height) / BLUR_PX));
  into.imageSmoothingEnabled = false;
  into.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, small, small);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(copy, 0, 0, small, small, rect.x, rect.y, rect.width, rect.height);
}

function cropTo(canvas: HTMLCanvasElement, rect: Rect): void {
  const copy = document.createElement("canvas");
  copy.width = rect.width;
  copy.height = rect.height;
  copy.getContext("2d")?.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.getContext("2d")?.drawImage(copy, 0, 0);
}

export function PictureEditor({ attachment, phone, onClose, onSave }: { attachment: Attachment | null; phone: boolean; onClose: () => void; onSave: (file: File) => Promise<boolean> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [tool, setTool] = useState<Tool>("blur");
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!attachment?.mediaId) return;
    let live = true;
    setState("loading");
    setEdited(false);
    setRect(null);
    void (async () => {
      try {
        const media = await getMediaById(attachment.mediaId as string);
        const url = media ? await signedMediaUrl(media, { width: "original" }) : null;
        if (!url) throw new Error("no link");
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const target = canvas.current;
        if (!live || !target) return;
        target.width = bitmap.width;
        target.height = bitmap.height;
        target.getContext("2d")?.drawImage(bitmap, 0, 0);
        setScale(Math.min(1, SHOWN_MAX / Math.max(bitmap.width, bitmap.height)));
        setState("ready");
      } catch {
        if (live) setState("failed");
      }
    })();
    return () => {
      live = false;
    };
  }, [attachment?.mediaId]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const shown = canvas.current ? { width: canvas.current.width * scale, height: canvas.current.height * scale } : { width: 0, height: 0 };

  const apply = () => {
    const target = canvas.current;
    if (!target || !rect) return;
    const inImage = toImageRect(rect, scale);
    if (tool === "crop") {
      cropTo(target, inImage);
      setScale(Math.min(1, SHOWN_MAX / Math.max(target.width, target.height)));
    } else blurInPlace(target, inImage);
    setRect(null);
    setEdited(true);
  };

  const save = () => {
    const target = canvas.current;
    if (!target || !attachment) return;
    const mime = attachment.mime === "image/png" ? "image/png" : "image/jpeg";
    setSaving(true);
    target.toBlob(
      (blob) => {
        if (!blob) {
          setSaving(false);
          return;
        }
        const name = attachment.name.replace(/\.[^.]+$/, "") + (mime === "image/png" ? ".png" : ".jpg");
        void onSave(new File([blob], name, { type: mime })).then((done) => {
          setSaving(false);
          if (done) onClose();
        });
      },
      mime,
      0.92,
    );
  };

  return (
    <Dialog.Root open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={scrimAt(LAYER.confirm)} />
        <Dialog.Content data-testid="picture-editor" aria-describedby={undefined} style={{ ...windowPlacement(phone ? 360 : 640, LAYER.confirm), display: "flex", flexDirection: "column", gap: space[3], padding: `0 ${space[5]}px ${space[5]}px`, background: t.module, color: t.text, fontFamily: FIGTREE, borderRadius: r.window }}>
          <div style={{ ...HEADER, padding: `${space[4]}px 0 0` }}>
            <div style={HEADER_TEXT}>
              <Dialog.Title style={{ margin: 0, fontSize: textStep.body, fontWeight: 500 }}>{attachment ? PICTURE_EDITOR_COPY.title(attachment.name) : ""}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <IconSquare glyph="x" label="Close" phone={phone} />
            </Dialog.Close>
          </div>
          <SegmentedField<Tool> label="Tool" phone={phone} items={[{ value: "blur", label: PICTURE_EDITOR_COPY.blur }, { value: "crop", label: PICTURE_EDITOR_COPY.crop }]} value={tool} onChange={(next) => { setTool(next); setRect(null); }} />
          <span style={{ fontSize: textStep.meta, color: t.label }}>{state === "loading" ? PICTURE_EDITOR_COPY.loading : state === "failed" ? PICTURE_EDITOR_COPY.failed : PICTURE_EDITOR_COPY.hint}</span>
          <div style={{ position: "relative", alignSelf: "center", lineHeight: 0, display: state === "ready" ? "block" : "none" }}>
            <canvas
              ref={canvas}
              aria-label={attachment?.name}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setStart(point(event));
                setRect(null);
              }}
              onPointerMove={(event) => {
                if (start) setRect(normaliseRect(start, point(event), shown));
              }}
              onPointerUp={() => setStart(null)}
              style={{ width: shown.width || undefined, height: shown.height || undefined, touchAction: "none", cursor: "crosshair", borderRadius: r.media }}
            />
            {rect ? <span aria-hidden="true" style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height, border: `2px solid ${t.focusRing}`, boxSizing: "border-box", pointerEvents: "none" }} /> : null}
          </div>
          <Inline>
            <RecipeButton small phone={phone} disabled={!rect} onClick={apply}>
              {PICTURE_EDITOR_COPY.apply}
            </RecipeButton>
            <span style={{ flexGrow: 1 }} />
            <RecipeButton variant="primary" phone={phone} disabled={!edited || saving} onClick={save}>
              {PICTURE_EDITOR_COPY.save}
            </RecipeButton>
          </Inline>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
