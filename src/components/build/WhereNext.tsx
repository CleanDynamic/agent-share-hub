import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { WHERE_NEXT_PER_ROW, firstTool, getWhereNext, type GalleryBuild } from "@/lib/build";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, eyebrow } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P14b — where next, at the foot of a build page.

   AT MOST THREE ROWS OF AT MOST THREE ⟦hicks-law⟧, in the reader's order of
   intent — build on it (its rebuilds), use the same tool (more made with its
   first tool), follow the same hands (more from its maker) — and a row with
   nothing in it is left out. With nothing onward at all the section renders
   nothing: no heading and no empty state. Nothing here is personalised.

   THE SAME CARD AS THE GALLERY AND HOME ⟦law-of-similarity⟧, unchanged: a build
   looks the same wherever it is offered. The rows carry the gallery's card data
   (getWhereNext), and the pictures are signed here the way the gallery signs
   them, one request per picture a card can show, once the rows arrive
   (RC-P14c: until then these cards drew their text body with no picture).

   ONE EDGE, ROWS 40 APART ⟦law-of-continuity⟧: every row's heading and first
   card start on the column's leading edge, and the larger gap between rows is
   what separates them. Each row is its own three-column grid with 24 gutters
   ⟦layout-grid⟧, one column below 768 — AND TWO BETWEEN 768 AND 1023, which
   the prompt did not ask for: the wide frame keeps its 240px nav down to 768,
   so the column there is about 408px and three cards are 120px each, their
   titles cut to fragments (measured). Two columns hold the cards at 192px or
   more, no narrower than three at 1024 ⟦better-layout › Hold structure until
   it breaks⟧; the three columns hold from 1024 up.

   NO REQUEST UNTIL IT IS NEAR ⟦neoscale-performance⟧: a 1px sentinel is
   watched, and the three requests go out once it is within 400px of the
   viewport. Most readers of a build never reach its foot.

   NO SCROLL REVEAL. The theme sanctions useReveal on two files only, the
   build page's own sections and the gallery grid (motion.test.ts holds it),
   and the section has usually arrived before the reader reaches it anyway:
   it asks 400px ahead. Wrapping it in the page's revealed Section instead
   would leave an empty flex item, and 32px of page, where there is nowhere
   onward.
   ──────────────────────────────────────────────────────────────────────────── */

/** How far ahead of the viewport the section starts asking. */
const NEAR_MARGIN = "400px";

/** Where-next answers change slowly; one answer serves a visit. */
const WHERE_NEXT_STALE_MS = 5 * 60 * 1000;

export interface WhereNextProps {
  /** The build being read. It never appears in its own rows. */
  buildId: string;
  creatorId: string;
  madeWith: readonly string[] | null | undefined;
}

interface Row {
  key: "rebuilds" | "made-with" | "maker";
  heading: string;
  builds: GalleryBuild[];
}

export function WhereNext({ buildId, creatorId, madeWith }: WhereNextProps) {
  const [near, setNear] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const tool = firstTool(madeWith);

  useEffect(() => {
    if (near) return;
    const element = sentinel.current;
    if (!element) return;
    /* No observer to ask: a browser without one gets the section, as a
       browser with one does once the reader comes near. */
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${NEAR_MARGIN} 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  const query = useQuery({
    queryKey: ["where-next", buildId, creatorId, tool],
    queryFn: () => getWhereNext({ buildId, creatorId, madeWith }),
    enabled: near,
    staleTime: WHERE_NEXT_STALE_MS,
  });

  if (!near || query.isLoading) {
    return <div ref={sentinel} data-testid="where-next-sentinel" aria-hidden style={{ height: 1 }} />;
  }

  /* STATES.md row 21: a failure says so, with one way to try again. */
  if (query.error) {
    return (
      <div
        data-testid="where-next-error"
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm }}
      >
        <p style={{ ...body, margin: 0, color: t.text2 }}>Something went wrong.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void query.refetch()}
          style={{ background: "transparent" }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  /* The data layer already caps each row and leaves this build out; held here
     too, so the rule is true of what is drawn, whatever it is handed. */
  const onward = (builds: GalleryBuild[]) =>
    builds.filter((build) => build.id !== buildId).slice(0, WHERE_NEXT_PER_ROW);

  const rows: Row[] = [
    { key: "rebuilds" as const, heading: "Rebuilds of this", builds: onward(data.rebuilds) },
    ...(data.sharedTool
      ? [
          {
            key: "made-with" as const,
            heading: `More made with ${data.sharedTool.tool}`,
            builds: onward(data.sharedTool.builds),
          },
        ]
      : []),
    { key: "maker" as const, heading: `More from ${data.makerName ?? "this maker"}`, builds: onward(data.fromMaker) },
  ].filter((row) => row.builds.length > 0);

  if (rows.length === 0) return null;
  return <WhereNextRows rows={rows} />;
}

/** Three columns from 1024, two between 768 and 1023, one below 768 (see above). */
const COLUMNS = {
  xl: "repeat(3, minmax(0, 1fr))",
  lg: "repeat(3, minmax(0, 1fr))",
  md: "repeat(2, minmax(0, 1fr))",
  mobile: "minmax(0, 1fr)",
} as const;

/** The rows, drawn. Rendered only when at least one row has a build in it. */
function WhereNextRows({ rows }: { rows: Row[] }) {
  const columns = COLUMNS[useBreakpoint()];
  /* Signed for the whole section at once, never per card: the gallery's rule. */
  const mediaRows = useMemo(() => rows.flatMap((row) => row.builds).flatMap(cardMedia), [rows]);
  const srcByPath = useSignedMedia(mediaRows);

  return (
    <section
      data-testid="where-next"
      aria-label="Where next"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}
    >
      {rows.map((row) => (
        <section
          key={row.key}
          data-testid={`where-next-${row.key}`}
          aria-labelledby={`where-next-${row.key}-heading`}
          style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
        >
          <h2
            id={`where-next-${row.key}-heading`}
            data-testid="where-next-heading"
            style={{ ...eyebrow, color: t.text2, margin: 0 }}
          >
            {row.heading}
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: columns,
              gap: SPACE.md,
            }}
          >
            {row.builds.map((build) => (
              <li key={build.id} data-testid="where-next-card" style={{ minWidth: 0 }}>
                <GalleryCard build={build} srcByPath={srcByPath} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

export default WhereNext;
