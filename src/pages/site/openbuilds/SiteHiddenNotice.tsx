/* UX-09 Q5: what the author of a topic or reply sees when the site's moderators hid it.

   One `role="status"` box at the top of the topic's page, on the tile recipe (`--tile`, 1px `--tile-border`, radius 6): the words
   "Hidden by the site's moderators", the entry's first line as its author wrote it (so they know which), and a link to the Terms'
   reporting section. Nobody else is shown it: the rows come from site_hidden_posts_of, which answers only about the caller's own. */

import { Link } from "react-router-dom";
import { TERMS_REPORTING_HREF, type SiteHiddenNotice as Notice } from "@/lib/moderation/siteHidden";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const SITE_HIDDEN_WORDS = "Hidden by the site's moderators";

export function SiteHiddenNotice({ entries }: { entries: readonly Notice[] }) {
  if (entries.length === 0) return null;
  return (
    <div
      role="status"
      data-testid="site-hidden-notice"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, marginBottom: 12, borderRadius: 6, background: t.tile, border: `1px solid ${t.tileBorder}`, fontFamily: FIGTREE }}
    >
      {entries.map((entry) => (
        <div key={entry.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, color: t.text }}>
            {entry.kind === "topic" ? `${SITE_HIDDEN_WORDS}: your topic` : `${SITE_HIDDEN_WORDS}: your reply`}
          </span>
          {entry.heading ? <span style={{ fontSize: 13, lineHeight: "20px", color: t.text2, overflowWrap: "anywhere" }}>{`“${entry.heading}”`}</span> : null}
        </div>
      ))}
      <span style={{ fontSize: 12, lineHeight: 1.4, color: t.text2 }}>
        Nobody else sees it now.{" "}
        <Link to={TERMS_REPORTING_HREF} style={{ color: t.text }}>
          How reporting works
        </Link>
      </span>
    </div>
  );
}

export default SiteHiddenNotice;
