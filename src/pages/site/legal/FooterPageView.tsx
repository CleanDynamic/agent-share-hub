/* TB-02: the view of /rules, /report and /contact. PURE: a LegalText and the page's path in, the page out. It reads no data and
   no router of its own; the links it draws go through FrameLink.

   Synth 15 Part B: two panels on the page shade, `minmax(0, 1fr) 300px`, 8 apart, the pair 1100 wide at most and centred.
   The main panel opens on the h1 at 31/36 and the intro, then each section with no box: its h2 at 17/600 and its text at
   15/20; a list or a table is a column of 48px rows without lines. The side panel holds "In this page", "Status" ("Not
   reviewed yet" while the text is a draft) and "Related pages" as row links. Below 1101 the side panel follows the main one. */

import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Icon } from "@/components/brand/Icon";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { FrameLink } from "@/components/shell/FrameLink";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import type { LegalBlock, LegalSection, LegalText } from "@/content/legal/types";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, hero, textStep } from "@/lib/theme/type";

import { Inline, PHONE_SCROLL_MARGIN } from "./LegalView";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { SECTION_HEADING } from "./legalStyles";
import { anchorOf, formatLastUpdated } from "./legalModel";

/** The pages a reader may want next, in order. The current page is left out. */
export const RELATED_PAGES: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Community rules", href: "/rules" },
  { label: "Report a problem", href: "/report" },
  { label: "Contact", href: "/contact" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

/** The width the two panels share at most, and the width from which they stand side by side. */
export const FOOTER_PAGE_WIDTH = 1100;
const SIDE_BY_SIDE_MIN = 1101;
const SIDE_WIDTH = 300;
const ROW = 48;

/**
 * What a section holds, in words. The sections no longer draw it (a heading states its own fact and has no subtitle under
 * it); it is kept for the tests that hold the counts to the texts.
 */
export function subtitleOf(section: LegalSection): string {
  const list = section.blocks.find((block): block is Extract<LegalBlock, { kind: "list" }> => block.kind === "list");
  if (list) return `${list.items.length} rules · Please don't`;
  const table = section.blocks.find((block): block is Extract<LegalBlock, { kind: "table" }> => block.kind === "table");
  if (table) return `${table.rows.length} reasons`;
  return section.source === "code" ? "How the site works" : "From the Terms";
}

const body: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.body, fontWeight: 400, lineHeight: "20px", color: t.text2, margin: 0 };
const meta: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 400, lineHeight: "20px", color: t.label, margin: 0 };
const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, minWidth: 0, boxSizing: "border-box" };
const rowStyle: CSSProperties = { minHeight: ROW, padding: "12px 0", display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box" };

function Block({ block, section, caption, phone }: { block: LegalBlock; section: string; caption: string; phone: boolean }) {
  if (block.kind === "p") {
    return (
      <p style={body}>
        <Inline text={block.text} links={block.links} section={section} touch={phone} />
      </p>
    );
  }
  if (block.kind === "list") {
    return (
      <ol data-testid="footer-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {block.items.map((item, index) => (
          <li key={index} style={phone ? { ...rowStyle, alignItems: "flex-start" } : rowStyle}>
            <span
              aria-hidden="true"
              data-testid="footer-number"
              style={
                phone
                  ? /* Mobile 28 D: the number in a 28 box on Raised, radius 8. */
                    { width: 28, height: 28, borderRadius: 8, background: t.control, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.text2, fontVariantNumeric: "tabular-nums" }
                  : { fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "20px", color: t.label, fontVariantNumeric: "tabular-nums", minWidth: 20, flexShrink: 0 }
              }
            >
              {phone ? String(index + 1) : String(index + 1).padStart(2, "0")}
            </span>
            <span style={{ ...body, color: t.text, ...(phone ? { paddingTop: 4 } : null) }}>
              <Inline text={item} section={section} />
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <caption>
        <VisuallyHidden>{caption}</VisuallyHidden>
      </caption>
      <thead>
        <tr>
          {block.head.map((cell) => (
            <th key={cell} scope="col">
              <VisuallyHidden>{cell}</VisuallyHidden>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <td style={{ ...body, color: t.text, height: ROW, padding: "12px 12px 12px 0", textAlign: "left", verticalAlign: "middle", boxSizing: "border-box" }}>{row[0]}</td>
            <td style={{ ...body, padding: "12px 0", textAlign: "right", verticalAlign: "middle", boxSizing: "border-box" }}>
              <Inline text={row[1]} section={section} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionBlock({ section, phone }: { section: LegalSection; phone: boolean }) {
  const caption = section.id === "report-something" ? "Report reasons" : section.heading;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-heading`} style={{ scrollMarginTop: phone ? PHONE_SCROLL_MARGIN : 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id={`${section.id}-heading`} style={phone ? { ...SECTION_HEADING, fontSize: 20, lineHeight: "24px", letterSpacing: "-0.01em" } : SECTION_HEADING}>{section.heading}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {section.blocks.map((block, index) => (
          <Block key={index} block={block} section={section.id} caption={caption} phone={phone} />
        ))}
      </div>
    </section>
  );
}

/** A side section: its head (20/600) and what it holds. */
function SideSection({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  /* 20/600 at every size: on a phone, the headed group's SectionFact size. */
  return (
    <section aria-label={label} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <h2 style={{ margin: 0, padding: `0 ${PANEL_PAD}px 8px`, fontFamily: FIGTREE, fontSize: textStep.headline, fontWeight: 600, lineHeight: "24px", color: t.text }}>{title}</h2>
      {children}
    </section>
  );
}

/** A side row that goes somewhere: 44 tall (48 on a phone), 16 at the sides, the Card fill under the pointer. */
const sideRow = (phone: boolean, hovered: boolean): CSSProperties => ({
  ...body,
  color: t.text,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: phone ? ROW : 44,
  padding: `0 ${PANEL_PAD}px`,
  textDecoration: "none",
  background: hovered ? t.module : "transparent",
});

/** An in-page anchor with the keyboard ring and the rows' hover. */
function AnchorLink({ href, phone, children }: { href: string; phone: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a href={href} {...handlers} style={{ ...sideRow(phone, state.hovered), ...ring(state.focusVisible) }}>
      {children}
    </a>
  );
}

function Side({ text, path, phone }: { text: LegalText; path: string; phone: boolean }) {
  return (
    <aside aria-label="About this page" data-testid="footer-side" style={{ ...panel, ...(phone ? { background: "transparent", borderRadius: 0, margin: `0 -${PANEL_PAD}px` } : null), padding: `${PANEL_PAD}px 0`, display: "flex", flexDirection: "column", gap: 24 }}>
      <SideSection title="In this page" label="In this page">
        <nav aria-label="In this page" style={{ display: "flex", flexDirection: "column" }}>
          {text.sections.map((section) => (
            <AnchorLink key={section.id} href={anchorOf(section.id)} phone={phone}>
              {section.heading}
            </AnchorLink>
          ))}
        </nav>
      </SideSection>
      <SideSection title="Status" label="Status">
        <div style={{ padding: `0 ${PANEL_PAD}px`, display: "flex", flexDirection: "column", gap: 4 }}>
          {text.reviewed ? null : (
            <p data-testid="footer-status" style={{ ...body, color: t.text }}>
              Not reviewed yet
            </p>
          )}
          <p style={meta}>Last updated {formatLastUpdated(text.lastUpdated)}</p>
        </div>
      </SideSection>
      <SideSection title="Related pages" label="Related">
        <nav aria-label="Related pages" style={{ display: "flex", flexDirection: "column" }}>
          {RELATED_PAGES.filter((page) => page.href !== path).map((page) => (
            <FrameLink key={page.href} to={page.href} style={sideRow(phone, false)} hoverStyle={{ background: t.module }}>
              {page.label}
              <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
                <Icon lucide={ChevronRight} size={16} color={t.label} />
              </span>
            </FrameLink>
          ))}
        </nav>
      </SideSection>
    </aside>
  );
}

export interface FooterPageViewProps {
  text: LegalText;
  /** The page's own path, so Related leaves it out. */
  path: string;
}

export function FooterPageView({ text, path }: FooterPageViewProps) {
  const phone = useIsPhone();
  const sideBySide = useMinWidth(SIDE_BY_SIDE_MIN);
  useColumnPanels(!phone);
  /* Mobile 28 D: on a phone the top bar names the page, so the h1 is for screen readers. */
  useRegisterPageBar(phone ? { title: text.title } : null);
  const main = (
    <div data-testid="footer-main" style={{ ...(phone ? null : { ...panel, padding: 24 }), display: "flex", flexDirection: "column", gap: phone ? 24 : 32, minWidth: 0 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 className={phone ? "sr-only" : undefined} style={phone ? undefined : { ...hero, margin: 0, color: t.text }}>{text.title}</h1>
        <p style={body}>{text.intro}</p>
      </header>
      {text.sections.map((section) => (
        <SectionBlock key={section.id} section={section} phone={phone} />
      ))}
    </div>
  );
  return (
    <div
      data-testid="footer-page"
      style={{
        fontFamily: FIGTREE,
        minWidth: 0,
        width: "100%",
        maxWidth: FOOTER_PAGE_WIDTH,
        margin: "0 auto",
        ...(sideBySide
          ? { display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${SIDE_WIDTH}px`, columnGap: PANEL_GUTTER, alignItems: "start" }
          : { display: "flex", flexDirection: "column", gap: phone ? 24 : PANEL_GUTTER }),
      }}
    >
      {main}
      <Side text={text} path={path} phone={phone} />
    </div>
  );
}

export default FooterPageView;
