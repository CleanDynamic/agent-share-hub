// A build, in a message (RC-P20).
//
// THE SAME OBJECT AS EVERYWHERE ELSE ⟦law-of-similarity⟧: the build's cover
// (signed through cardMedia, as a gallery card's is), its title in the card's
// own title face, and the Plaque exactly as a card carries it — reproductions
// and freshness together, unchanged ⟦buildgallery-theme › Plaque⟧. Compact:
// one column, 260 wide at most, one link to /b2/<slug>.

import { Link } from "react-router-dom";
import { Plaque } from "@/components/brand/Plaque";
import { coverMedia, stillFor, type MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryBuild } from "@/lib/build/gallery";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { cardTitle } from "@/lib/theme/type";

export interface BuildShareCardProps {
  build: GalleryBuild;
  srcByPath: MediaSrcMap;
}

export function BuildShareCard({ build, srcByPath }: BuildShareCardProps) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const cover = stillFor(srcByPath, coverMedia(build));

  return (
    <Link
      to={`/b2/${build.slug}`}
      data-testid="message-build"
      {...handlers}
      style={{
        display: "flex",
        flexDirection: "column",
        width: 260,
        maxWidth: "100%",
        borderRadius: r.card,
        border: `1px solid ${state.hovered ? t.text2 : t.line}`,
        background: t.bg,
        overflow: "hidden",
        color: t.text,
        textDecoration: "none",
        transition: feedback("border-color"),
        ...ring(state.focusVisible),
      }}
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: t.porthole }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, padding: SPACE.sm }}>
        <span data-testid="message-build-title" style={{ ...cardTitle, color: t.text, overflowWrap: "anywhere" }}>
          {build.title}
        </span>
        <Plaque build={build} size="card" />
      </div>
    </Link>
  );
}

export default BuildShareCard;
