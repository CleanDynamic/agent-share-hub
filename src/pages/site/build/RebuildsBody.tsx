/* UI-P30 — "Rebuilds", inside the part viewer.

   The build's published rebuilds as build cards — the gallery's own card, cover
   86 and title 17 — three to a row (two on a phone, where three would cut every
   title to a fragment), then the way to the whole family: "See the family
   tree", to the lineage page.

   The tab exists only while there is a rebuild to show (BuildTabs' own rule), so
   the empty sentence here is for the moment between a rebuild being withdrawn
   and the page reading that it was.

   PURE: the cards are drawn by the page (a real `GalleryCard`) or the fixture. */

import { Network } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/brand/EmptyState";
import { CardSkeleton, LoadingRegion } from "@/components/brand/Skeleton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { RebuildsBodyView } from "./buildModel";

/** The card's cover and title on this wall. */
export const REBUILD_CARD = { coverHeight: 86, titleSize: 17 } as const;

function FamilyLink({ to, phone }: { to: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid="build-rebuilds-family"
      {...handlers}
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        /* A 44px target on a phone; 36 above it, through the table. */
        minHeight: phone ? 44 : 36,
        fontFamily: FIGTREE,
        fontSize: phone ? 13 : 12,
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      <Network size={15} strokeWidth={1.6} aria-hidden="true" />
      See the family tree
    </Link>
  );
}

export function RebuildsBody({ rebuilds, phone = false }: { rebuilds: RebuildsBodyView; phone?: boolean }) {
  const { cards, loading, lineageTo } = rebuilds;
  const columns = phone ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";
  const gap = phone ? 10 : 12;

  return (
    <section data-testid="build-rebuilds" aria-label="Rebuilds" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {loading ? (
        <LoadingRegion what="the rebuilds" data-testid="build-rebuilds-loading" style={{ display: "grid", gridTemplateColumns: columns, gap, alignItems: "start" }}>
          {Array.from({ length: phone ? 2 : 3 }, (_, index) => (
            <CardSkeleton key={index} cover={REBUILD_CARD.coverHeight} body={phone ? 144 : 124} />
          ))}
        </LoadingRegion>
      ) : cards.length > 0 ? (
        <ul
          aria-label="Rebuilds of this build"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: columns, gap, alignItems: "start" }}
        >
          {cards.map((card) => (
            <li key={card.key} data-testid="build-rebuild-card" style={{ minWidth: 0 }}>
              {card.render(phone ? "phone" : "desktop")}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState line="This build has no rebuilds yet." data-testid="build-rebuilds-empty" />
      )}
      <FamilyLink to={lineageTo} phone={phone} />
    </section>
  );
}

export default RebuildsBody;
