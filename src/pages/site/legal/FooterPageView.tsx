/* TB-02: the view of /rules, /report and /contact. PURE: a LegalText and the page's path in, the page out. It reads no data and
   no router of its own; the links it draws go through FrameLink. Main and side (9 / 3) from 1024, stacked below it.
   One Panel per section; a list or a table is a column of 48px list rows. The side column is "In this page", "Status", "Related". */

import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { CardHead } from "@/components/brand/CardHead";
import { Icon } from "@/components/brand/Icon";
import { Panel } from "@/components/brand/Panel";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { FrameLink } from "@/components/shell/FrameLink";
import { PageHeader } from "@/components/shell/PageHeader";
import { pageColumns } from "@/components/shell/pageGrid";
import { BETWEEN, useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import type { LegalBlock, LegalSection, LegalText } from "@/content/legal/types";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { asideStyle, mainStyle, trackRow } from "@/lib/theme/refinedLayout";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { SideSection } from "@/pages/site/openbuilds/OpenBuildsFrame";

import { Inline } from "./LegalView";
import { anchorOf, formatLastUpdated } from "./legalModel";

/** The pages a reader may want next, in order. The current page is left out. */
export const RELATED_PAGES: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Community rules", href: "/rules" },
  { label: "Report a problem", href: "/report" },
  { label: "Contact", href: "/contact" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

/** The one rule for a card's subtitle, on all three pages. */
export function subtitleOf(section: LegalSection): string {
  const list = section.blocks.find((block): block is Extract<LegalBlock, { kind: "list" }> => block.kind === "list");
  if (list) return `${list.items.length} rules · Please don't`;
  const table = section.blocks.find((block): block is Extract<LegalBlock, { kind: "table" }> => block.kind === "table");
  if (table) return `${table.rows.length} reasons`;
  return section.source === "code" ? "How the site works" : "From the Terms";
}

const body: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: t.text, margin: 0 };
const sideHeading: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, letterSpacing: 0, lineHeight: "normal", color: t.text };
const meta: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "normal", color: t.text2 };
const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 20,
  padding: "0 8px",
  borderRadius: r.chip,
  background: t.inset,
  color: t.text2,
  fontFamily: DM_MONO,
  fontSize: 13,
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums",
  boxSizing: "border-box",
};
const rowBorder = `1px solid ${t.hairlineModule}`;

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
          <li key={index} style={{ minHeight: 48, padding: "12px 0", display: "flex", alignItems: "center", gap: 12, borderTop: rowBorder, boxSizing: "border-box" }}>
            <span aria-hidden="true" data-testid="footer-number" style={{ ...tag, minWidth: 28 }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span style={{ ...body, fontWeight: 500 }}>
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
            <td style={{ ...body, fontWeight: 500, height: 48, padding: "12px 12px 12px 0", borderTop: rowBorder, textAlign: "left", verticalAlign: "middle", boxSizing: "border-box" }}>{row[0]}</td>
            <td style={{ ...meta, padding: "12px 0", borderTop: rowBorder, textAlign: "right", verticalAlign: "middle", boxSizing: "border-box" }}>
              <Inline text={row[1]} section={section} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionCard({ section, phone }: { section: LegalSection; phone: boolean }) {
  const caption = section.id === "report-something" ? "Report reasons" : section.heading;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-heading`} style={{ scrollMarginTop: 24 }}>
      <Panel as="div">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardHead headingLevel={2} title={<span id={`${section.id}-heading`}>{section.heading}</span>} subtitle={subtitleOf(section)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} section={section.id} caption={caption} phone={phone} />
            ))}
          </div>
        </div>
      </Panel>
    </section>
  );
}

function SideHead({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      <h2 style={sideHeading}>{title}</h2>
      <div style={meta}>{text}</div>
    </div>
  );
}

const sideLink: CSSProperties = { ...body, display: "flex", alignItems: "center", minHeight: 32, textDecoration: "none" };

/** An in-page anchor with the keyboard ring and the side links' hover. */
function AnchorLink({ href, phone, children }: { href: string; phone: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a href={href} {...handlers} style={{ ...sideLink, ...touchArea(phone), ...(state.hovered ? { color: t.text2 } : null), ...ring(state.focusVisible) }}>
      {children}
    </a>
  );
}

function Side({ text, path, phone }: { text: LegalText; path: string; phone: boolean }) {
  return (
    <aside aria-label="About this page">
      <SideSection first label="In this page">
        <SideHead title="In this page" text={`${text.sections.length} sections`} />
        <nav aria-label="In this page" style={{ display: "flex", flexDirection: "column" }}>
          {text.sections.map((section) => (
            <AnchorLink key={section.id} href={anchorOf(section.id)} phone={phone}>
              {section.heading}
            </AnchorLink>
          ))}
        </nav>
      </SideSection>
      <SideSection first={false} label="Status">
        <SideHead title="Status" text={`Last updated ${formatLastUpdated(text.lastUpdated)}`} />
        {text.reviewed ? null : (
          <div data-testid="footer-status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={tag}>draft</span>
            <span style={meta}>Not reviewed yet</span>
          </div>
        )}
      </SideSection>
      <SideSection first={false} label="Related">
        <SideHead title="Related" text="Rules and policies" />
        <nav aria-label="Related pages" style={{ display: "flex", flexDirection: "column" }}>
          {RELATED_PAGES.filter((page) => page.href !== path).map((page) => (
            <FrameLink key={page.href} to={page.href} style={{ ...sideLink, justifyContent: "space-between", ...touchArea(phone) }} hoverStyle={{ color: t.text2 }}>
              {page.label}
              <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
                <Icon lucide={ChevronRight} size={16} color={t.text2} />
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
  const stacked = !useMinWidth(BETWEEN.stack);
  const phone = useIsPhone();
  const main = (
    <div data-testid="footer-main" style={mainStyle(stacked, { display: "flex", flexDirection: "column", gap: 24, minWidth: 0 })}>
      {text.sections.map((section) => (
        <SectionCard key={section.id} section={section} phone={phone} />
      ))}
    </div>
  );
  const side = (
    <div data-testid="footer-side" style={asideStyle(stacked, { minWidth: 0 })}>
      <Side text={text} path={path} phone={phone} />
    </div>
  );
  return (
    <div data-testid="footer-page" style={{ fontFamily: FIGTREE, minWidth: 0, paddingBottom: 48 }}>
      <PageHeader title={text.title} description={text.intro} />
      <div style={stacked ? trackRow(true, 24) : { ...pageColumns("mainSide"), alignItems: "start", minWidth: 0 }}>
        {main}
        {side}
      </div>
    </div>
  );
}

export default FooterPageView;
