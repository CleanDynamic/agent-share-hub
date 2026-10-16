// PostPreview: the draft, drawn as the Gallery will draw it (PT-07).
//
// It is FeedPost: the same item, the same thread, the same marks. Only what a draft cannot have differs (no action row,
// "Draft" where the plaque goes, nothing that links away). It has no card, box or border: the item sits on the page.
//
// TWO WIDTHS. Phone draws the item at the phone's sizes in the column it is given (at most 320). Desktop draws it at
// the Gallery's 628, laid out at that width and scaled down with transform: scale to fit the column; the box it sits in
// is given the scaled height, so nothing below it moves when the item grows. The sheet variant (a phone's Preview
// button) is the phone item at the sheet's width, with no head and no note.

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { FeedPost } from "@/components/gallery/FeedPost";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import { draftGalleryBuild, PREVIEW_DESKTOP_WIDTH, PREVIEW_NOTE, previewScale, type PreviewWidth } from "@/lib/build/postPreview";
import type { ThreadDoc } from "@/lib/build/thread";
import type { Build } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";
import { text } from "@/pages/site/compose/refinedStyles";

/** The signed-in maker, as the item's author row shows them. */
export interface PreviewMaker {
  id: string | null;
  name: string | null;
  handle: string | null;
  avatar: string | null;
}

export interface PostPreviewProps {
  doc: ThreadDoc;
  /** The build row, or null before the first change makes it. */
  build: Build | null;
  /** The title as typed. */
  title: string;
  maker: PreviewMaker | null;
  media: ReadonlyMap<string, GalleryMedia>;
  src: MediaSrcMap;
  /** "column" is the Post tab's slot; "sheet" is the phone's: the phone item alone. */
  variant?: "column" | "sheet";
}

const WIDTHS: readonly { value: PreviewWidth; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "desktop", label: "Desktop" },
];

/** An element's width and height, kept current. ResizeObserver where there is one; the first reading elsewhere. */
function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const next = { width: el.clientWidth, height: el.offsetHeight };
      setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Children laid out at 628 and scaled to the column; the box is given the scaled height. */
function Scaled({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const column = useSize(outer);
  const content = useSize(inner);
  const scale = previewScale(column.width);
  return (
    <div
      ref={outer}
      data-preview-scaler=""
      data-scale={scale.toFixed(3)}
      style={{ width: "100%", overflow: "hidden", height: content.height > 0 ? Math.ceil(content.height * scale) : undefined }}
    >
      <div ref={inner} style={{ width: PREVIEW_DESKTOP_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

export function PostPreview({ doc, build, title, maker, media, src, variant = "column" }: PostPreviewProps) {
  const [width, setWidth] = useState<PreviewWidth>("phone");
  // The draft is "now": fixed when the preview opens, so the age does not tick into "1m".
  const [now] = useState(() => Date.now());
  const sheet = variant === "sheet";
  const shown: PreviewWidth = sheet ? "phone" : width;

  const rows = useMemo(() => Array.from(media.values()), [media]);
  const item = useMemo(
    () => draftGalleryBuild({ build, title: title.trim() || "Untitled build", doc, media: rows, makerId: maker?.id ?? null, now }),
    [build, title, doc, rows, maker?.id, now],
  );

  const post = (
    <FeedPost
      build={item}
      srcByPath={src}
      makerHandle={maker?.handle ?? null}
      makerName={maker?.name ?? null}
      makerAvatar={maker?.avatar ?? null}
      modelsUsed={build?.models_used ?? []}
      now={now}
      phone={shown === "phone"}
      preview
    />
  );

  if (sheet) {
    return (
      <div data-testid="post-preview" data-preview-width="phone" style={{ minWidth: 0 }}>
        {post}
      </div>
    );
  }

  return (
    <section
      aria-label="Preview"
      data-testid="post-preview"
      data-preview-width={shown}
      style={{ flex: "1 1 280px", maxWidth: 320, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "nowrap" }}>
        <h2 style={{ ...text(13.5, 500, t.text), margin: 0, whiteSpace: "nowrap" }}>Preview</h2>
        <Segmented<PreviewWidth> label="Preview width" size={22} fontSize={12} value={width} onChange={setWidth} items={WIDTHS} />
      </div>
      {shown === "desktop" ? <Scaled>{post}</Scaled> : <div style={{ minWidth: 0 }}>{post}</div>}
      <p style={{ ...text(12, 400, t.text2), margin: 0, paddingTop: 12, borderTop: `1px solid ${t.surfaceBorder}`, lineHeight: 1.5 }}>{PREVIEW_NOTE}</p>
    </section>
  );
}

export default PostPreview;
