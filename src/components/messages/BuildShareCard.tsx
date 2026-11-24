// A build, in a message (RC-P20). Synth 12 Part D: a compact Card (Card fill, radius 12, no edge): the cover, the build's
// name 15/600 and its facts as plain text joined by " · " (What was built · Role of AI · Skill needed). No plaque: the
// reproduction count is no longer drawn. What follows is the RC-P20 history.
//
//
// THE SAME OBJECT AS EVERYWHERE ELSE ⟦law-of-similarity⟧: the build's cover
// (signed through cardMedia, as a gallery card's is), its title in the card's
// own title face, and the Plaque exactly as a card carries it — reproductions
// and freshness together, unchanged ⟦buildgallery-theme › Plaque⟧. Compact:
// one column, 260 wide at most, one link to /b2/<slug>.

import { Link } from "react-router-dom";
import { coverMedia, stillFor, type MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryBuild } from "@/lib/build/gallery";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { classificationFacts } from "@/lib/classify/lines";
import { useIsPhone } from "@/components/shell/useMinWidth";

export interface BuildShareCardProps {
  build: GalleryBuild;
  srcByPath: MediaSrcMap;
}

export function BuildShareCard({ build, srcByPath }: BuildShareCardProps) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const cover = stillFor(srcByPath, coverMedia(build));
  const phone = useIsPhone();

  /* Mobile prompt 26 Part E: on a phone the card is compact, 240 wide on Card: "Build" 13 Text 3, the name 15/600, then its facts
     13 Text 3 (the classification, as the desktop card says it). No cover. The prompt's "@maya · 3 sessions · 9 steps" needs the maker,
     the session count and the step count, which the message's build read does not carry; that read is left as it is. */
  if (phone) {
    const facts = classificationFacts(build.classifiedAs);
    return (
      <Link
        to={`/b2/${build.slug}`}
        data-testid="message-build"
        {...handlers}
        style={{ display: "flex", flexDirection: "column", gap: 2, boxSizing: "border-box", width: 240, maxWidth: "100%", padding: "12px 14px", borderRadius: 12, background: t.module, color: t.text, textDecoration: "none", ...ring(state.focusVisible) }}
      >
        <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>Build</span>
        <span data-testid="message-build-title" style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>
          {build.title}
        </span>
        {facts.length > 0 ? (
          <span data-testid="message-build-facts" style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>
            {facts.join(" · ")}
          </span>
        ) : null}
      </Link>
    );
  }

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
        borderRadius: r.panel,
        background: state.hovered ? t.control : t.module,
        overflow: "hidden",
        color: t.text,
        textDecoration: "none",
        transition: feedback("background-color"),
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
        <span data-testid="message-build-title" style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>
          {build.title}
        </span>
        {classificationFacts(build.classifiedAs).length > 0 ? (
          <span data-testid="message-build-facts" style={{ fontSize: 13, lineHeight: "16px", color: t.text2 }}>
            {classificationFacts(build.classifiedAs).join(" · ")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export default BuildShareCard;
