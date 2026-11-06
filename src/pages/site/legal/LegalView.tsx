/* UX-12 P2: a legal text on the site's reading pattern. PURE: it takes the content object and draws it. It reads no data and no
   router; the only things it takes from `src/lib/` are the theme (tokens, type, radius). The text holds no link inside the site, so
   it draws no `PageLink`; an outside address is a plain underlined link.

   One column at the reading measure, centred. The page title at the site's page-title size, `Last updated <date>` under it in
   `--label`, the intro in `--text2`. `In this page` is a plain list of the section headings as anchors in a `module` box (on a
   phone, the same list collapsed under one row that opens in place). Each section is an `h2` through `SectionHead` with its id.
   Tables scroll inside their own box, never the page.

   While the text is a draft (`reviewed` false) a module box above the title says so, and every `{{NEED: …}}` renders as itself on
   the `--lit` fill so a reviewer can find it. */

import type { CSSProperties } from "react";

import { SectionHead } from "@/components/vision/SectionHead";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { LegalBlock, LegalText } from "@/content/legal/types";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, measure } from "@/lib/theme/type";

import { anchorOf, DRAFT_NOTICE, formatLastUpdated, piecesOf } from "./legalModel";

const body: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: t.text, margin: 0 };
const link: CSSProperties = { color: t.text, textDecoration: "underline", textUnderlineOffset: 4, textDecorationThickness: 1 };
const quietLink: CSSProperties = { ...link, color: t.text2 };
const module_: CSSProperties = { background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 };
const th: CSSProperties = { fontWeight: 500, padding: "0 16px 8px 0", borderBottom: `1px solid ${t.hairline}`, textAlign: "left", verticalAlign: "bottom", fontSize: 12, color: t.label };
const td: CSSProperties = { padding: "8px 16px 8px 0", borderBottom: `1px solid ${t.hairline}`, verticalAlign: "top", color: t.text };

/** Text with its placeholders and outside addresses drawn. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {piecesOf(text).map((piece, index) => {
        if (piece.kind === "need") {
          return (
            <mark key={index} data-need="true" style={{ backgroundColor: t.lit, color: t.onLit, borderRadius: 4, padding: "0 4px" }}>
              {piece.text}
            </mark>
          );
        }
        if (piece.kind === "link") {
          return (
            <a key={index} href={piece.href} rel="noopener noreferrer" style={link}>
              {piece.text}
            </a>
          );
        }
        return <span key={index}>{piece.text}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "p") {
    return <p style={body}><Inline text={block.text} /></p>;
  }
  if (block.kind === "list") {
    return (
      <ul style={{ ...body, paddingLeft: 20, listStyle: "disc", display: "flex", flexDirection: "column", gap: 6 }}>
        {block.items.map((item, index) => (
          <li key={index}><Inline text={item} /></li>
        ))}
      </ul>
    );
  }
  return (
    <div data-testid="legal-table" style={{ overflowX: "auto" }}>
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
                <td key={cellIndex} style={td}><Inline text={cell} /></td>
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
    <ol style={{ ...body, margin: 0, paddingLeft: 20, listStyle: "decimal", display: "flex", flexDirection: "column", gap: 6 }}>
      {text.sections.map((section) => (
        <li key={section.id}>
          <a href={anchorOf(section.id)} style={link}>{section.heading}</a>
        </li>
      ))}
    </ol>
  );
  const title: CSSProperties = { fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: t.text };
  return (
    <nav aria-label="In this page" data-testid="legal-contents" style={module_}>
      {phone ? (
        <details>
          <summary style={{ ...title, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>In this page</summary>
          <div style={{ paddingTop: 8 }}>{list}</div>
        </details>
      ) : (
        <>
          <div style={{ ...title, marginBottom: 12 }}>In this page</div>
          {list}
        </>
      )}
    </nav>
  );
}

export interface LegalViewProps {
  text: LegalText;
}

export function LegalView({ text }: LegalViewProps) {
  return (
    <article id="legal-top" data-testid="legal-view" style={{ ...measure, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 32, fontFamily: FIGTREE }}>
      {text.reviewed ? null : (
        <div role="note" data-testid="legal-draft" style={{ ...module_, ...body }}>
          {DRAFT_NOTICE}
        </div>
      )}
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.015em", color: t.text }}>{text.title}</h1>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: t.label }}>Last updated {formatLastUpdated(text.lastUpdated)}</div>
        </div>
        <p style={{ ...body, color: t.text2 }}>{text.intro}</p>
      </header>
      <Contents text={text} />
      {text.sections.map((section) => (
        <section key={section.id} aria-label={section.heading} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div id={section.id} style={{ scrollMarginTop: 24 }}>
            <SectionHead title={section.heading} headingLevel={2} />
          </div>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </section>
      ))}
      <div>
        <a href="#legal-top" style={quietLink}>Back to top</a>
      </div>
    </article>
  );
}

export default LegalView;
