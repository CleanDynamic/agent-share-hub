import { Link, useLocation } from "react-router-dom";

import { PageHeader } from "@/components/shell/PageHeader";
import { SPACE } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, cardTitle, data as dataText, eyebrow, label, tabular } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   /dev/wide — the wide layout mode, rendered.

   WHAT THIS IS FOR. BG-P14 builds a layout capability and moves no route, so
   the mode needs somewhere to be looked at. This is that place: the real
   frame, the real `.fs-grid`, the real `PageHeader`, twelve placeholders, and
   a control for the one thing a wide route gets to decide.

   IT IS GUARDED AT THE ROUTE by `import.meta.env.DEV`, not here, so the route
   and this module's chunk are both eliminated from a production build rather
   than merely being unreachable in one. See the note in App.tsx, and /dev/kit,
   which is guarded the same way.

   IT RENDERS INSIDE THE LAYOUT, unlike /dev/kit, and that is the whole point:
   the thing under test is the frame around the page, not the page.

   THE RIGHT-RAIL CONTROL IS A LINK, NOT A PIECE OF STATE, because the rail is
   not the page's to decide. It is decided by the route table, which is exactly
   how BG-P15 will decide it for the gallery and the build page. So the control
   navigates between two dev entries in that table — `/dev/wide` (suppressed)
   and `/dev/wide/rail` (requested) — and what it demonstrates is the real
   mechanism rather than a demo-only path into FlatShell that no route will use.

   THE CARDS ARE PLACEHOLDERS AND NOT `GalleryCard`. The real card needs a real
   build, and this page is about the room a card sits in: twelve boxes at the
   card's radius with a title, an eyebrow and a line of body prove reflow,
   gutters and overflow, and prove nothing about the card, which is not what
   this prompt touched.
   ──────────────────────────────────────────────────────────────────────────── */

const PLACEHOLDERS = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1,
  /* Varying body lengths so a row's cards are not all the same height — which
     is what `align-items: start` on the grid exists to handle. */
  blurb:
    i % 3 === 0
      ? "A short one."
      : i % 3 === 1
        ? "A placeholder standing in for a build card, long enough to wrap onto a second line at the 320px column floor."
        : "A middling one that wraps once.",
}));

function PlaceholderCard({ n, blurb }: { n: number; blurb: string }) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        /* md (24) — never more than the gutter it sits in, which is md at the
           small end and lg above 1280. The scale's one hard rule. */
        padding: SPACE.md,
        background: t.glass,
        border: `1px solid ${t.line}`,
        borderRadius: r.card,
      }}
    >
      <div
        style={{
          height: 120,
          borderRadius: r.media,
          background: t.recess,
          border: `1px solid ${t.line}`,
        }}
      />
      <span style={{ ...eyebrow, color: t.text2 }}>Placeholder</span>
      <h2 style={{ ...cardTitle, color: t.text, margin: 0 }}>Build {n}</h2>
      <p style={{ ...body, color: t.text2, margin: 0 }}>{blurb}</p>
      <span style={{ ...dataText, ...tabular, color: t.text2 }}>${(n * 0.17).toFixed(2)}/mo</span>
    </article>
  );
}

export default function WideDemo() {
  const { pathname } = useLocation();
  const railOn = pathname === "/dev/wide/rail";

  return (
    /* THE PAGE PAINTS ITS OWN GROUND, and the reason is a pre-existing gap
       rather than anything this prompt built. The frame's centre column is
       transparent by design — "no page background, BlobBackground paints it"
       — and BlobBackground is hard-coded to #25252F, a dark ground, in both
       themes. So --text type laid directly on the centre is unreadable in
       Exhibition: dark ink on a dark room. Every shipping page happens to
       dodge it by putting its content inside cards that carry their own
       background; a PageHeader does not, and this is the first surface to
       find out.

       `--bg` is the room this frame's tokens describe, so painting it here
       makes the demo legible in both themes, which is the only way it can
       verify anything about both. It is a dev page's own surface colour and
       it changes no frame rule; the real fix is BlobBackground following the
       theme, which is out of scope here — see the handoff note. */
    <div style={{ padding: SPACE.md, background: t.bg }}>
      <PageHeader
        eyebrow={`${PLACEHOLDERS.length} placeholders`}
        title="Wide layout mode"
        description="The frame at 1600px with the centre unpinned, an opt-in grid in auto-filled 320px columns, and a right rail the route decides on. Three across above 1280, two in the middle, one on a phone."
        actions={
          <Link
            to={railOn ? "/dev/wide" : "/dev/wide/rail"}
            style={{
              ...label,
              display: "inline-flex",
              alignItems: "center",
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              borderRadius: r.control,
              background: railOn ? t.action : t.glass2,
              color: railOn ? t.onAction : t.text,
              border: `1px solid ${railOn ? "transparent" : t.line}`,
              textDecoration: "none",
            }}
          >
            {railOn ? "Right rail: on" : "Right rail: off"}
          </Link>
        }
      />

      <div className="fs-grid">
        {PLACEHOLDERS.map((p) => (
          <PlaceholderCard key={p.n} n={p.n} blurb={p.blurb} />
        ))}
      </div>
    </div>
  );
}
