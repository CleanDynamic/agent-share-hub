import { Link } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText } from "@/lib/theme/type";
import type { LinkableMaker } from "@/lib/profile/searchMakers";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P11 — one maker, as a link to their profile: avatar, name, handle.

   ONE COMPONENT FOR EVERY PLACE A MAKER IS OFFERED ⟦law-of-similarity⟧: the
   gallery's makers row beside a search (RC-P10) and Home's suggestion row when
   a reader follows nobody (RC-P11). Same function, same look, one
   implementation, so the two cannot drift.

   The avatar is the existing avatar component, 32px, a circle (the one shape
   --r-full is for). The link is at least 44 tall ⟦responsive-design › Touch⟧.
   A maker with no handle has no profile address, so callers leave them out.
   The theme's one focus ring is drawn on the link itself (RC-P13, when the
   solvers board made it a column of them): the browser's own ring is a second
   mark to learn ⟦buildgallery-theme › Focus ring⟧.
   ──────────────────────────────────────────────────────────────────────────── */

export function MakerLink({
  maker,
  testId,
}: {
  maker: LinkableMaker;
  testId?: string;
}) {
  const name = maker.display_name?.trim() || maker.username;
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={`/profile/${encodeURIComponent(maker.username)}`}
      data-testid={testId}
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.xs,
        minHeight: 44,
        color: t.text,
        textDecoration: "none",
        borderRadius: r.control,
        ...ring(state.focusVisible),
      }}
    >
      <Avatar style={{ width: 32, height: 32 }}>
        {maker.avatar_url ? <AvatarImage src={maker.avatar_url} alt="" /> : null}
        <AvatarFallback style={{ background: t.recess, color: t.text2, ...dataText }}>
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, textAlign: "start" }}>
        <span style={{ ...body, color: t.text }}>{name}</span>
        <span style={{ ...dataText, color: t.text2 }}>@{maker.username}</span>
      </span>
    </Link>
  );
}

export default MakerLink;
