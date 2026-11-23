/* UX-12 P5: the 404 page, in the site's own design. PURE: it takes the address and what "Go to Home" does.

   Synth 15 Part D: one panel at 680, centred, 72px 32px of padding. The title as an h1 at 31/36 (focused on load, so a screen
   reader announces it), one line at 15 in Text 2, a second line when the address looks like a build, a profile or a project,
   the Main button "Go to Home", "Browse builds" and "OpenBuilds" as underlined 15 links, and the address once in mono 13 in
   Text 3. A band of Deep dots runs along the panel's bottom edge. No picture, no joke, no big number. */

import { useEffect, useId, useRef, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { ReadingPanel } from "@/components/shell/ReadingPanel";
import { SITE_NAV } from "@/components/shell/siteNav";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, hero, textStep } from "@/lib/theme/type";

import { hintFor, NOT_FOUND_LINE, NOT_FOUND_TITLE, shownPath } from "./notFoundModel";

export interface NotFoundViewProps {
  /** The address that was not found. */
  path: string;
  /** What the primary button does. */
  onHome: () => void;
  /** A page that draws its own not-found state says what it could not find here, in place of the address-based sentence. */
  sentence?: string;
}

/** The dot band's height and the lattice's pitch. */
export const DOT_BAND_HEIGHT = 54;
const DOT_PITCH = 6;

const text: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: textStep.body, fontWeight: 400, lineHeight: "20px", color: t.text2 };
const quiet: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.body, fontWeight: 400, lineHeight: "20px", color: t.text, textDecoration: "underline", textDecorationColor: t.label, textUnderlineOffset: 3, textDecorationThickness: 1 };

/** The dots' rows from the bottom edge up: each row's radius, so the band thins out as it rises (a halftone, no gradient). */
const DOT_ROWS = [1.5, 1.4, 1.25, 1.1, 0.95, 0.8, 0.6, 0.45, 0.3];

/** The band of Deep dots along the bottom edge: a still lattice that thins upward. It takes no pointer events. */
function DotBand() {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden="true"
      data-testid="not-found-dots"
      width="100%"
      height={DOT_BAND_HEIGHT}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "block", pointerEvents: "none" }}
    >
      <defs>
        {DOT_ROWS.map((radius, row) => (
          <pattern key={row} id={`${id}-row-${row}`} width={DOT_PITCH} height={DOT_PITCH} patternUnits="userSpaceOnUse">
            <circle cx={DOT_PITCH / 2} cy={DOT_PITCH / 2} r={radius} fill={t.dotDeep} />
          </pattern>
        ))}
      </defs>
      {DOT_ROWS.map((_, row) => (
        <rect key={row} x={0} y={DOT_BAND_HEIGHT - (row + 1) * DOT_PITCH} width="100%" height={DOT_PITCH} fill={`url(#${id}-row-${row})`} />
      ))}
    </svg>
  );
}

export function NotFoundView({ path, onHome, sentence }: NotFoundViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const extra = sentence ?? hintFor(path);
  return (
    <ReadingPanel padding="72px 32px" backdrop={<DotBand />}>
      <section data-testid="not-found" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "0 0 24px", textAlign: "center" }}>
        <h1 ref={heading} tabIndex={-1} style={{ ...hero, margin: 0, outline: "none", color: t.text }}>
          {NOT_FOUND_TITLE}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "46ch" }}>
          <p style={text}>{NOT_FOUND_LINE}</p>
          {extra ? <p style={text} data-testid="not-found-hint">{extra}</p> : null}
        </div>
        <Button variant="primary" size={36} onClick={onHome}>
          Go to Home
        </Button>
        <nav aria-label="Where to go" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 20px" }}>
          <PageLink to={SITE_NAV.gallery} style={quiet}>Browse builds</PageLink>
          <PageLink to={SITE_NAV.openbuilds} style={quiet}>OpenBuilds</PageLink>
        </nav>
        {path ? (
          <code data-testid="not-found-path" style={{ fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "20px", fontWeight: 400, color: t.label, overflowWrap: "anywhere" }}>
            {shownPath(path)}
          </code>
        ) : null}
      </section>
    </ReadingPanel>
  );
}

export default NotFoundView;
