/* UI-P30 — "Rebuilds", inside the part viewer.

   The build's published rebuilds as build cards — the gallery's own card, cover
   86 and title 17 — three to a row (two on a phone, where three would cut every
   title to a fragment), then the way to the whole family: "See the family
   tree", to the lineage page.

   The tab exists only while there is a rebuild to show (BuildTabs' own rule), so
   the empty sentence here is for the moment between a rebuild being withdrawn
   and the page reading that it was.

   UX-09 P2: a rebuild attached to a reply says so after its card, in
   `--label`: "Made in reply to @maya's topic", the last words a link to the
   reply.

   PURE: the cards are drawn by the page (a real `GalleryCard`) or the fixture. */

import { Network } from "lucide-react";
import { Link } from "react-router-dom";

import { PageEmpty } from "@/components/pagestate/PageState";
import { PageLink } from "@/lib/routing/PageLink";
import { CardSkeleton, LoadingRegion } from "@/components/brand/Skeleton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { RebuildsBodyView } from "./buildModel";

/** The card's cover and title on this wall. */
export const REBUILD_CARD = { coverHeight: 86, titleSize: 17 } as const;

function FamilyLink({ to, phone, label, testId = "build-rebuilds-family" }: { to: string; phone: boolean; label?: string; testId?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid={testId}
      {...handlers}
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        /* A 44px target on a phone; a text link's 24 above it. */
        minHeight: phone ? 44 : 24,
        padding: "0 4px",
        fontFamily: FIGTREE,
        fontSize: phone ? 13 : 13,
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      {label ? null : <Network size={15} strokeWidth={1.6} aria-hidden="true" />}
      {label ?? "See the family tree"}
    </Link>
  );
}

function MadeInReplyLine({ handle, to }: { handle: string; to: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <p data-testid="build-rebuild-made-in-reply" style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, color: t.label }}>
      Made in reply to{" "}
      <PageLink to={to} {...handlers} style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3, borderRadius: r.chip, ...ring(state.focusVisible) }}>
        @{handle}&apos;s topic
      </PageLink>
    </p>
  );
}

/* ── on a phone (prompt 22) ── */

function PhoneRebuildCard({ card, compare }: { card: RebuildsBodyView["cards"][number]; compare?: { to: string; label: string } }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const summary = card.summary;
  return (
    <li data-testid="build-rebuild-card" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 12, background: t.module, minWidth: 0, fontFamily: FIGTREE }}>
      {summary ? (
        <>
          <Link to={summary.to} {...handlers} style={{ fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, textDecoration: "none", overflowWrap: "anywhere", borderRadius: r.chip, ...ring(state.focusVisible) }}>
            {summary.title}
          </Link>
          {summary.meta ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{summary.meta}</span> : null}
        </>
      ) : (
        card.render("phone")
      )}
      {card.madeInReply ? <MadeInReplyLine {...card.madeInReply} /> : null}
      {compare ? (
        <PageLink to={compare.to} data-testid="build-compare-link" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-12px 0 -14px", fontSize: 13, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
          {compare.label}
        </PageLink>
      ) : null}
    </li>
  );
}

function PhoneRebuilds({ rebuilds }: { rebuilds: RebuildsBodyView }) {
  const { cards, loading, lineageTo, compareLinks } = rebuilds;
  const count = `${cards.length.toLocaleString("en-GB")} ${cards.length === 1 ? "rebuild" : "rebuilds"}`;
  return (
    <section data-testid="build-rebuilds" aria-label="Rebuilds" style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: FIGTREE }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 20, fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em", color: t.text }}>{loading ? "Rebuilds" : count}</h2>
        <PageLink to={lineageTo} data-testid="build-rebuilds-family" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 44, margin: "-10px 0", fontSize: 13, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
          See the family tree
        </PageLink>
      </div>
      {loading ? (
        <LoadingRegion what="the rebuilds" data-testid="build-rebuilds-loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 2 }, (_, index) => (
            <CardSkeleton key={index} cover={0} body={64} />
          ))}
        </LoadingRegion>
      ) : cards.length > 0 ? (
        <ul aria-label="Rebuilds of this build" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* The page lists the compare links in the cards' own order. */}
          {cards.map((card, index) => (
            <PhoneRebuildCard key={card.key} card={card} compare={compareLinks?.[index]} />
          ))}
        </ul>
      ) : (
        <p data-testid="build-rebuilds-empty" style={{ margin: 0, fontSize: 15, lineHeight: "20px", color: t.text2 }}>This build has no rebuilds yet.</p>
      )}
    </section>
  );
}

export function RebuildsBody({ rebuilds, phone = false }: { rebuilds: RebuildsBodyView; phone?: boolean }) {
  if (phone) return <PhoneRebuilds rebuilds={rebuilds} />;
  const { cards, loading, lineageTo, compareLinks } = rebuilds;
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
              {card.madeInReply ? <MadeInReplyLine {...card.madeInReply} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <PageEmpty line="This build has no rebuilds yet." testId="build-rebuilds-empty" />
      )}
      <FamilyLink to={lineageTo} phone={phone} />
      {compareLinks?.length ? (
        <ul aria-label="Compare" data-testid="build-compare-links" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {compareLinks.map((link) => (
            <li key={link.to}>
              <FamilyLink to={link.to} phone={phone} label={link.label} testId="build-compare-link" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default RebuildsBody;
