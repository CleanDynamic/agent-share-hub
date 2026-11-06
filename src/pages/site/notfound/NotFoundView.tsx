/* UX-12 P5: the 404 page, in the site's own design. PURE: it takes the address and what "Go to Home" does.

   The frame (header, search, footer) is the site's and is drawn around it. One centred column: the title as an `h1` (focused on
   load, so a screen reader announces it), one line in `--text2`, a second line when the address looks like a build or a profile,
   one primary button, two quiet links, and the address once in `--label` in the code face. No picture, no joke, no big number. */

import { useEffect, useRef, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { SITE_NAV } from "@/components/shell/siteNav";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { hintFor, NOT_FOUND_LINE, NOT_FOUND_TITLE, shownPath } from "./notFoundModel";

export interface NotFoundViewProps {
  /** The address that was not found. */
  path: string;
  /** What the primary button does. */
  onHome: () => void;
  /** A page that draws its own not-found state says what it could not find here, in place of the address-based sentence. */
  sentence?: string;
}

const text: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: t.text2 };
const quiet: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.text2, textDecoration: "underline", textUnderlineOffset: 4, textDecorationThickness: 1 };

export function NotFoundView({ path, onHome, sentence }: NotFoundViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const extra = sentence ?? hintFor(path);
  return (
    <section data-testid="not-found" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 0", textAlign: "center" }}>
      <h1 ref={heading} tabIndex={-1} style={{ margin: 0, outline: "none", fontFamily: FIGTREE, fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.015em", color: t.text }}>
        {NOT_FOUND_TITLE}
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "46ch" }}>
        <p style={text}>{NOT_FOUND_LINE}</p>
        {extra ? <p style={text} data-testid="not-found-hint">{extra}</p> : null}
      </div>
      <Button variant="primary" size={32} fontSize={13} onClick={onHome}>
        Go to Home
      </Button>
      <nav aria-label="Where to go" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 20px" }}>
        <PageLink to={SITE_NAV.gallery} style={quiet}>Browse builds</PageLink>
        <PageLink to={SITE_NAV.openbuilds} style={quiet}>OpenBuilds</PageLink>
      </nav>
      {path ? (
        <code data-testid="not-found-path" style={{ fontFamily: DM_MONO, fontSize: 12, fontWeight: 400, color: t.label, overflowWrap: "anywhere" }}>
          {shownPath(path)}
        </code>
      ) : null}
    </section>
  );
}

export default NotFoundView;
