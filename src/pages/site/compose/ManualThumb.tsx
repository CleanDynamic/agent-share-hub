/* UI-P70 — a manual step's picture as a small square: 32px on the List card. */

import { useEffect, useState } from "react";

import { useMediaSrc } from "@/components/build/MediaFigure";
import { getMediaById } from "@/lib/build/media";
import type { BuildMedia } from "@/lib/build/types";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export function ManualThumb({ mediaId, size = 32 }: { mediaId: string; size?: number }) {
  const [media, setMedia] = useState<BuildMedia | null>(null);
  useEffect(() => {
    let live = true;
    getMediaById(mediaId)
      .then((row) => live && setMedia(row))
      .catch(() => live && setMedia(null));
    return () => {
      live = false;
    };
  }, [mediaId]);
  const src = useMediaSrc(media, size * 2);
  return (
    <span
      data-testid="manual-thumb"
      aria-hidden="true"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: r.control, overflow: "hidden", border: `1px solid ${t.line}`, background: t.cell, display: "inline-block" }}
    >
      {src ? <img src={src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
    </span>
  );
}

export default ManualThumb;
