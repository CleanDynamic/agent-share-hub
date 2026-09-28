import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P05 — /bounties, the third discovery home (CONTRACT §14): help where
   something is stuck.

   THE ROUTE COMES FIRST, THE BOARD LATER. Navigation needs a destination to
   point at before the board exists, so this page is the frame's standard
   column with its title and STATES.md row 19 — one sentence in --text2 and one
   action. It reads nothing; RC-P12 replaces the body with the open bounties,
   newest first.

   THE ACTION IS PRIMARY because the page offers nothing else: row 19 spends
   the primary only when the view has no other, and this view's content is one
   sentence. It goes to the Gallery, the likeliest next step for a reader who
   came to help and found nothing open (hicks-law › Budgets, empty state: one
   sentence, one action). It is a link styled as the button, because what it
   does is navigate.
   ──────────────────────────────────────────────────────────────────────────── */

export default function Bounties() {
  return (
    <div style={{ paddingTop: SPACE.md }}>
      <Helmet>
        <title>Bounties — buildgallery</title>
      </Helmet>

      <PageHeader title="Bounties" />

      <div
        data-testid="bounties-empty"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: SPACE.sm,
        }}
      >
        <p style={{ ...body, margin: 0, color: t.text2 }}>No open bounties right now.</p>
        <Button asChild>
          <Link to="/gallery">Browse the gallery</Link>
        </Button>
      </div>
    </div>
  );
}
