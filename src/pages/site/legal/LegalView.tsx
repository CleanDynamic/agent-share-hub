/* UX-12 P2: a legal text on the site's reading pattern. PURE: it takes the content object and draws it. It reads no data and no
   router; the only things it takes from `src/lib/` are the theme (tokens, type, radius). The text holds no link inside the site, so
   it draws no `PageLink`; an outside address is a plain underlined link.

   Synth 15 Part A: one panel at 680, 28 padding. The title as the h1 at 31/36, `Last updated <date>` under it at 13 in Text 3,
   the intro at 15 in Text 2. `In this page` is a Card (radius 12, 14px 16px) holding the section headings as underlined 15
   links in two columns (on a phone, one column collapsed under one row that opens in place). Each section is an h2 at 17/600
   with its id and its text at 15/20; lists indent 20, tables scroll inside their own region, rows 48 tall without lines.

   While the text is a draft (`reviewed` false) a module box above the title says so, and every `{{NEED: …}}` renders as itself on
   the `--lit` fill so a reviewer can find it. */

import type { CSSProperties } from "react";

import { PhonePills } from "@/components/phone/PhonePills";
import { PHONE_MARGIN, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { FrameLink } from "@/components/shell/FrameLink";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { scrollBehavior } from "@/lib/theme/motion";
import { ReadingPanel } from "@/components/shell/ReadingPanel";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { LegalBlock, LegalLink, LegalText } from "@/content/legal/types";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, hero, textStep } from "@/lib/theme/type";

import { anchorOf, DRAFT_NOTICE, formatLastUpdated, piecesOf } from "./legalModel";
import { CARD_BOX, SECTION_HEADING } from "./legalStyles";

const body: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.body, fontWeight: 400, lineHeight: "20px", color: t.text, margin: 0 };
const link: CSSProperties = { color: t.text, textDecoration: "underline", textDecorationColor: t.label, textUnderlineOffset: 3, textDecorationThickness: 1 };
const quietLink: CSSProperties = { ...link, fontSize: textStep.meta, lineHeight: "20px", color: t.text2 };
const th: CSSProperties = { fontWeight: 400, height: 48, padding: "0 16px 0 0", textAlign: "left", verticalAlign: "middle", fontSize: textStep.meta, color: t.label, boxSizing: "border-box" };
const td: CSSProperties = { height: 48, padding: "12px 16px 12px 0", verticalAlign: "middle", color: t.text, boxSizing: "border-box" };

/** Text with its placeholders and outside addresses drawn. */
export function Inline({ text, links, section, touch = false }: { text: string; links?: readonly LegalLink[]; section?: string; touch?: boolean }) {
  /* A phone keeps a 44px hit area on an inline link: the padding grows the box that takes the tap, not the line. */
  const own: CSSProperties = touch ? { ...link, padding: "12px 0" } : link;
  return (
    <>
      {piecesOf(text, links, section).map((piece, index) => {
        if (piece.kind === "need") {
          return (
            <mark key={index} data-need="true" style={{ backgroundColor: t.lit, color: t.onLit, borderRadius: r.chip, padding: "0 4px" }}>
              {piece.text}
            </mark>
          );
        }
        if (piece.kind === "link" && piece.href.startsWith("/")) {
          return (
            <FrameLink key={index} to={piece.href} style={own}>
              {piece.text}
            </FrameLink>
          );
        }
        if (piece.kind === "link") {
          return (
            <a key={index} href={piece.href} rel="noopener noreferrer" style={own}>
              {piece.text}
            </a>
          );
        }
        return <span key={index}>{piece.text}</span>;
      })}
    </>
  );
}

function Block({ block, section, id }: { block: LegalBlock; section: string; id: string }) {
  if (block.kind === "p") {
    return <p style={{ ...body, color: t.text2 }}><Inline text={block.text} links={block.links} section={id} /></p>;
  }
  if (block.kind === "list") {
    return (
      <ul style={{ ...body, color: t.text2, paddingLeft: 20, listStyle: "disc", display: "flex", flexDirection: "column", gap: 6 }}>
        {block.items.map((item, index) => (
          <li key={index}><Inline text={item} /></li>
        ))}
      </ul>
    );
  }
  return (
    /* G9: at a narrow width the table scrolls in this box, so a keyboard must be able to reach it: a Tab stop, named for its
       section, ringed by the site's stylesheet ([tabindex] :focus-visible). */
    <div data-testid="legal-table" role="region" aria-label={`${section} (table)`} tabIndex={0} style={{ overflowX: "auto", borderRadius: r.chip }}>
      <table style={{ ...body, width: "100%", minWidth: 480, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th key={cell} scope="col" style={th}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={{ ...td, color: cellIndex === 0 ? t.text : t.text2 }}><Inline text={cell} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Contents({ text }: { text: LegalText }) {
  const phone = useIsPhone();
  const list = (
    <ul style={{ ...body, margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", columnGap: 24, rowGap: 8 }}>
      {text.sections.map((section) => (
        <li key={section.id} style={{ minWidth: 0 }}>
          <a href={anchorOf(section.id)} style={{ ...link, ...(phone ? { display: "inline-flex", alignItems: "center", minHeight: 44 } : null) }}>{section.heading}</a>
        </li>
      ))}
    </ul>
  );
  const title: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 400, lineHeight: "20px", color: t.label };
  return (
    <nav aria-label="In this page" data-testid="legal-contents" style={CARD_BOX}>
      {phone ? (
        <details>
          <summary style={{ ...title, fontSize: textStep.body, color: t.text, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>In this page</summary>
          <div style={{ paddingTop: 8 }}>{list}</div>
        </details>
      ) : (
        <>
          <div style={{ ...title, marginBottom: 8 }}>In this page</div>
          {list}
        </>
      )}
    </nav>
  );
}

export interface LegalViewProps {
  text: LegalText;
}

/** Mobile 28 D: a section scrolls to just under the phone's top bar (and the status bar above it). */
export const PHONE_SCROLL_MARGIN = `calc(${PHONE_TOPBAR + 8}px + env(safe-area-inset-top))`;
/** Mobile 28 D: the reading line on a phone. */
export const PHONE_READING_LINE = 358;

/** Takes the reader to a section on a phone: scrolled under the top bar, focus on its heading, the address unchanged. */
function jumpTo(id: string) {
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.scrollIntoView({ block: "start", behavior: scrollBehavior() });
  heading.focus({ preventScroll: true });
}

/**
 * Mobile 28 D: a legal page on a phone. The top bar carries Back and the page's name, so the h1 is for screen readers. "Last
 * updated" 13 Text 3, the opening line, the contents as pills that jump to each section, then the sections at 15/22 on a 358
 * reading line under 20/600 heads.
 */
function LegalPhone({ text }: LegalViewProps) {
  useRegisterPageBar({ title: text.title });
  const para: CSSProperties = { ...body, fontSize: 15, lineHeight: "22px", color: t.text2, maxWidth: PHONE_READING_LINE };
  return (
    <article id="legal-top" data-testid="legal-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: FIGTREE, padding: "0 0 32px", scrollMarginTop: PHONE_SCROLL_MARGIN }}>
      {text.reviewed ? null : (
        <div role="note" data-testid="legal-draft" style={{ ...CARD_BOX, ...body, color: t.text2 }}>
          {DRAFT_NOTICE}
        </div>
      )}
      <header style={{ display: "flex", flexDirection: "column", gap: 8, padding: 0 }}>
        <h1 className="sr-only">{text.title}</h1>
        <div style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>Last updated {formatLastUpdated(text.lastUpdated)}</div>
        <p style={para}>{text.intro}</p>
      </header>
      {/* The frame's panel pads 16; the pill row runs to its edges and pads itself. */}
      <nav aria-label="In this page" data-testid="legal-contents" style={{ margin: `0 -${PHONE_MARGIN}px` }}>
        <PhonePills label="Sections" pills={text.sections.map((section) => ({ value: section.id, label: section.heading }))} value={null} onChange={jumpTo} />
      </nav>
      {text.sections.map((section) => (
        <section key={section.id} aria-label={section.heading} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 0 }}>
          <h2 id={section.id} tabIndex={-1} style={{ ...SECTION_HEADING, fontSize: 20, lineHeight: "24px", letterSpacing: "-0.01em", outline: "none", scrollMarginTop: PHONE_SCROLL_MARGIN }}>{section.heading}</h2>
          {section.blocks.map((block, index) =>
            block.kind === "p" ? (
              <p key={index} style={para}><Inline text={block.text} links={block.links} section={section.id} touch /></p>
            ) : block.kind === "list" ? (
              <ul key={index} style={{ ...para, paddingLeft: 20, listStyle: "disc", display: "flex", flexDirection: "column", gap: 6 }}>
                {block.items.map((item, i) => (
                  <li key={i}><Inline text={item} touch /></li>
                ))}
              </ul>
            ) : (
              <Block key={index} block={block} section={section.heading} id={section.id} />
            ),
          )}
        </section>
      ))}
      <div style={{ padding: 0 }}>
        <a href="#legal-top" style={{ ...quietLink, display: "inline-flex", alignItems: "center", minHeight: 44 }}>Back to top</a>
      </div>
    </article>
  );
}

export function LegalView({ text }: LegalViewProps) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <ReadingPanel>
        <LegalPhone text={text} />
      </ReadingPanel>
    );
  }
  return (
    <ReadingPanel>
      <article id="legal-top" data-testid="legal-view" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 32, fontFamily: FIGTREE, scrollMarginTop: 24 }}>
        {text.reviewed ? null : (
          <div role="note" data-testid="legal-draft" style={{ ...CARD_BOX, ...body, color: t.text2 }}>
            {DRAFT_NOTICE}
          </div>
        )}
        <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h1 style={{ ...hero, margin: 0, color: t.text }}>{text.title}</h1>
            <div style={{ marginTop: 4, fontSize: textStep.meta, lineHeight: "20px", fontWeight: 400, color: t.label }}>Last updated {formatLastUpdated(text.lastUpdated)}</div>
          </div>
          <p style={{ ...body, color: t.text2 }}>{text.intro}</p>
        </header>
        <Contents text={text} />
        {text.sections.map((section) => (
          <section key={section.id} aria-label={section.heading} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 id={section.id} style={{ ...SECTION_HEADING, scrollMarginTop: 24 }}>{section.heading}</h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} section={section.heading} id={section.id} />
            ))}
          </section>
        ))}
        <div>
          <a href="#legal-top" style={quietLink}>Back to top</a>
        </div>
      </article>
    </ReadingPanel>
  );
}

export default LegalView;
