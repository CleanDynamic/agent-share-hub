/* UI-P89 — the Gallery dashboard in the refined look, as `design/reference/refined/{dusk,noon}/gallery-dashboard.html`
   draws it.

   A FORK, NOT AN EDIT. `GalleryDashboardView` stays the current look; this is the same page with the same props
   (imported from it, not copied), the same menus (`menusFor`), handlers, copy, accessible names and order of parts.
   `GalleryDashboardPage` and the dev page choose between the two with `useLook()`. DESKTOP ONLY, as before: below
   768px the page renders the feed.

   LAYOUT. The frame draws the breadcrumb; this is a wrapping row, gap 32: the sidebar (`flex: 1 1 208px`, max 224, a
   hairline on its right, gap 24) and the content (`flex: 999 1 640px`, gap 16). No panels: the frame's one surface is
   the ground, and the table is rows on hairlines, not a well.

   THE SIDEBAR'S LABS carry their real marks (`ModelMark lab`), with no tile. The table's AI models cell carries
   `ModelTag`s. */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { MenuButton } from "@/components/brand/MenuButton";
import { ModelMark } from "@/components/brand/ModelMark";
import { ModelTag } from "@/components/brand/ModelTag";
import { Pill } from "@/components/brand/Pill";
import { Segmented } from "@/components/brand/Segmented";
import { Skeleton } from "@/components/brand/Skeleton";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { Sparkline } from "@/components/brand/charts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { makerRows, modelRows } from "@/lib/build/dashboardAggregates";
import type { DashboardRow } from "@/lib/build/gallery";
import type { DashboardTab, GalleryViewMode } from "@/lib/build/galleryParams";
import { LABS, MODEL_VERSIONS, type Lab } from "@/lib/models/registry";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { CONTROL, CONTROL_HOVER } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BuildDetailSheet } from "./BuildDetailSheet";
import { menusFor, type GalleryDashboardViewProps, type ToolbarMenu } from "./GalleryDashboardView";
import { RefinedGroupHeading, RefinedOptionBody, RefinedSearchField, refinedMenuContent, refinedMenuItem } from "./RefinedGalleryFeedView";
import {
  averageSessions,
  buildCsv,
  downloadText,
  engagementTitle,
  modelNamesOf,
  pillText,
  seriesTotal,
  shortDate,
  sortDashboardRows,
  sortMakerRows,
  sortModelRows,
  sparkValues,
  sumOfPrompts,
} from "./dashboardModel";
import { formatCount } from "./galleryModel";

/* ── type ── */

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const bareButton: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: 0,
  margin: 0,
  padding: 0,
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
};

/* ── the sidebar ── */

/** A sidebar row: the label grows, the count sits on the right in `--label`. The current one is the control recipe. */
function NavRow({
  label,
  count,
  on,
  onClick,
  height,
  size,
  pressed,
  lead,
  current,
  testId,
}: {
  label: string;
  count?: number;
  on: boolean;
  onClick: () => void;
  height: 30 | 32;
  size: 12.5 | 13;
  /** A toggle (aria-pressed) rather than the current page's tab. */
  pressed?: boolean;
  lead?: ReactNode;
  current?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed ? on : undefined}
      aria-current={current && on ? "page" : undefined}
      onClick={onClick}
      style={{
        ...bareButton,
        ...text(size, size === 13 || on ? 500 : 400, on ? t.text : t.text2),
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height,
        padding: "0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        ...(on ? { ...CONTROL, ...CONTROL_HOVER } : { border: "1px solid transparent" }),
      }}
    >
      {lead}
      <span style={{ flexGrow: 1, minWidth: 0, ...ellipsis }}>{label}</span>
      {count !== undefined ? <span style={text(11.5, 400, on ? t.text2 : t.label, tnum)}>{formatCount(count)}</span> : null}
    </button>
  );
}

const groupStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };

function Sidebar(props: GalleryDashboardViewProps) {
  const { tab, onTabChange, counts, lab, onLabChange, report, onReportChange, drafts, onConnect } = props;
  const tabs: { value: DashboardTab; label: string; count: number }[] = [
    { value: "builds", label: "Builds", count: counts.builds },
    { value: "models", label: "Models", count: MODEL_VERSIONS.length },
    { value: "makers", label: "Makers", count: counts.makers },
  ];
  const draftCount = drafts?.count ?? null;
  return (
    <aside
      style={{
        flex: "1 1 208px",
        maxWidth: 224,
        minWidth: 0,
        boxSizing: "border-box",
        paddingRight: 24,
        borderRight: `1px solid ${t.hairline}`,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={text(14, 500, t.text)}>Gallery</span>
        <span style={text(12, 400, t.text2)}>How builds were made</span>
      </div>

      <nav aria-label="Dashboard" style={groupStyle}>
        {tabs.map((item) => (
          <NavRow
            key={item.value}
            testId={`dash-nav-${item.value}`}
            label={item.label}
            count={item.count}
            on={tab === item.value}
            current
            height={32}
            size={13}
            onClick={() => onTabChange(item.value)}
          />
        ))}
      </nav>

      <div role="group" aria-label="Labs" style={groupStyle}>
        <Eyebrow style={{ padding: "0 8px 6px" }}>Labs</Eyebrow>
        {LABS.map((name) => (
          <NavRow
            key={name}
            testId={`dash-lab-${name}`}
            label={name}
            count={counts.byLab[name] ?? 0}
            on={lab === name}
            pressed
            height={30}
            size={12.5}
            onClick={() => onLabChange(lab === name ? null : name)}
            lead={<ModelMark lab={name} size={18} />}
          />
        ))}
      </div>

      <div role="group" aria-label="Reporting" style={groupStyle}>
        <Eyebrow style={{ padding: "0 8px 6px" }}>Reporting</Eyebrow>
        <NavRow
          testId="dash-report-month"
          label="Active this month"
          count={counts.activeThisMonth}
          on={report === "month"}
          pressed
          height={30}
          size={12.5}
          onClick={() => onReportChange(report === "month" ? null : "month")}
        />
        <NavRow
          testId="dash-report-multi"
          label="Built over 3+ sessions"
          count={counts.multiSession}
          on={report === "multi"}
          pressed
          height={30}
          size={12.5}
          onClick={() => onReportChange(report === "multi" ? null : "multi")}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="secondary" size={28} fontSize={12} onClick={onConnect}>
          Connect a tool
        </Button>
        <Link to="/about" style={text(12.5, 500, t.text2, { textDecoration: "none" })}>
          Help
        </Link>
      </div>

      {drafts ? (
        <div
          data-testid="dash-drafts"
          style={{
            background: t.tile,
            border: `1px solid ${t.tileBorder}`,
            borderRadius: 6,
            padding: 12,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={text(12.5, 500, t.text)}>
              {draftCount === null ? "Drafts" : `${formatCount(draftCount)} ${draftCount === 1 ? "draft" : "drafts"}`}
            </span>
            <span style={text(12, 400, t.text2)}>Waiting to be finished</span>
          </div>
          <Link
            to="/drafts"
            style={text(12.5, 500, t.text, { textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line, alignSelf: "flex-start" })}
          >
            Open drafts
          </Link>
        </div>
      ) : null}
    </aside>
  );
}

/* ── the filter row's menus ── */

function ToolbarMenuView({ menu }: { menu: ToolbarMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton label={menu.label} value={menu.value} data-testid={`dash-menu-${menu.key}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} style={refinedMenuContent} aria-label={menu.label}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} role="group" aria-label={group.heading}>
            {group.heading ? <RefinedGroupHeading>{group.heading}</RefinedGroupHeading> : null}
            {group.options.map((option) => (
              <DropdownMenuItem
                key={option.key}
                role="menuitemradio"
                aria-checked={option.selected}
                className={MENU_ITEM_CLASS}
                style={refinedMenuItem}
                onSelect={option.onSelect}
              >
                <RefinedOptionBody label={option.label} selected={option.selected} note={option.note} />
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── the tables ── */

const GRID_COLUMNS = "minmax(0, 2.6fr) minmax(0, 1.7fr) 64px 64px 64px 80px 72px minmax(0, 1.5fr) 28px";
/* The tracks' fixed columns, their gaps and the shares the text needs: below this the table scrolls sideways. */
const TABLE_MIN_WIDTH = 880;

const gridOf = (columns: string): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: columns,
  gap: 12,
  alignItems: "center",
});

const headRow = (columns: string): CSSProperties => ({ ...gridOf(columns), height: 36, borderBottom: `1px solid ${t.hairline}` });

/** A row: 48 high on a hairline; a selected one takes the tile fill and loses its hairline. */
const bodyRow = (columns: string, filled: boolean): CSSProperties => ({
  ...gridOf(columns),
  height: 48,
  padding: "0 8px",
  margin: "0 -8px",
  borderRadius: 6,
  borderBottom: `1px solid ${filled ? "transparent" : t.hairline}`,
  background: filled ? t.tile : undefined,
});

const headCell: CSSProperties = text(11.5, 500, t.label);
const rightCell: CSSProperties = { textAlign: "right" };
const numberCell: CSSProperties = text(12.5, 400, t.text, { ...tnum, textAlign: "right" });
const NONE = <span style={text(12, 400, t.label)}>–</span>;

function Header({ all, onToggleAll }: { all: boolean | "mixed"; onToggleAll: () => void }) {
  return (
    <div role="row" style={headRow(GRID_COLUMNS)}>
      <div role="columnheader" style={{ ...headCell, display: "flex", alignItems: "center", gap: 12 }}>
        <Checkbox
          checked={all === true}
          aria-checked={all === "mixed" ? "mixed" : undefined}
          label="Select all builds"
          onChange={onToggleAll}
        />
        Build
      </div>
      <div role="columnheader" style={headCell}>
        AI models
      </div>
      <div role="columnheader" style={{ ...headCell, ...rightCell }}>
        Sessions
      </div>
      <div role="columnheader" style={{ ...headCell, ...rightCell }}>
        Prompts
      </div>
      <div role="columnheader" title="Messages back and forth with the AI, across every session" style={{ ...headCell, ...rightCell }}>
        AI turns
      </div>
      <div role="columnheader" title="Runs, rebuilds, comments and saves from other people" style={{ ...headCell, ...rightCell }}>
        Engagement
      </div>
      <div role="columnheader" style={headCell}>
        Activity
      </div>
      <div role="columnheader" style={headCell}>
        Last activity
      </div>
      <div role="columnheader" aria-label="Actions" style={headCell} />
    </div>
  );
}

/** The count, then up to two model tags with their real marks, then "+n". */
function ModelsCell({ row }: { row: Pick<DashboardRow, "modelsUsed"> }) {
  const names = modelNamesOf(row);
  if (names.length === 0) return NONE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden" }}>
      <span data-testid="dash-model-count" style={text(12, 500, t.text, { ...tnum, paddingRight: 4, flexShrink: 0 })}>
        {names.length}
      </span>
      {names.slice(0, 2).map((name) => (
        <ModelTag key={name} model={name}>
          {name}
        </ModelTag>
      ))}
      {names.length > 2 ? <span style={text(11.5, 400, t.label, { flexShrink: 0 })}>+{names.length - 2}</span> : null}
    </div>
  );
}

/** A date over a quiet line: the board's two-line cell. */
function DateCell({ at, line }: { at: string; line: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={text(12, 500, t.text, tnum)}>{shortDate(at)}</span>
      <span title={line} style={text(11.5, 400, t.label, ellipsis)}>
        {line}
      </span>
    </div>
  );
}

function BuildRow({
  row,
  selected,
  open,
  onToggle,
  onOpen,
}: {
  row: DashboardRow;
  selected: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const total = seriesTotal(row.series);
  return (
    <div role="row" data-testid="dash-row" aria-selected={selected} style={bodyRow(GRID_COLUMNS, selected || open)}>
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Checkbox checked={selected} label={`Select ${row.title}`} onChange={onToggle} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <button type="button" onClick={onOpen} style={{ ...bareButton, ...text(12.5, 500, t.text, ellipsis), maxWidth: "100%" }}>
            {row.title}
          </button>
          <span style={text(11.5, 400, t.label, ellipsis)}>by {row.creator.handle ? `@${row.creator.handle}` : "a maker"}</span>
        </div>
      </div>
      <div role="cell" style={{ minWidth: 0 }}>
        <ModelsCell row={row} />
      </div>
      <div role="cell" style={numberCell}>
        {formatCount(row.sessionCount)}
      </div>
      <div role="cell" style={numberCell}>
        {formatCount(row.promptCount)}
      </div>
      <div role="cell" style={numberCell}>
        {formatCount(row.aiTurnCount)}
      </div>
      <div role="cell" style={numberCell} title={engagementTitle(row.engagement)}>
        {formatCount(row.engagement.total)}
      </div>
      <div role="cell" style={{ display: "flex", justifyContent: "flex-end" }}>
        <Sparkline
          values={sparkValues(row.series)}
          width={56}
          height={16}
          tone={total === 0 ? t.barMid : t.evidence}
          label={`${total} engagements over 14 weeks`}
        />
      </div>
      <div role="cell" style={{ minWidth: 0 }}>
        {row.lastActivity.at ? <DateCell at={row.lastActivity.at} line={row.lastActivity.what} /> : NONE}
      </div>
      <div role="cell">
        <IconButton
          icon={MoreHorizontal}
          glyph="chev"
          boxed={false}
          size={26}
          label={`Open details for ${row.title}`}
          onClick={onOpen}
          style={{ width: 24, height: 24 }}
        />
      </div>
    </div>
  );
}

function PlainHeader({ columns, labels }: { columns: string; labels: { label: string; right?: boolean }[] }) {
  return (
    <div role="row" style={headRow(columns)}>
      {labels.map((column) => (
        <div key={column.label} role="columnheader" style={{ ...headCell, ...(column.right ? rightCell : null) }}>
          {column.label}
        </div>
      ))}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p data-testid="dash-empty" style={text(13, 500, t.text, { margin: 0, padding: "16px 0 0" })}>
      {children}
    </p>
  );
}

const MODELS_COLUMNS = "minmax(0, 1.6fr) minmax(0, 1fr) 64px 64px 64px 64px 80px minmax(0, 1.5fr)";
const MAKERS_COLUMNS = "minmax(0, 1.4fr) 64px 64px minmax(0, 2fr) 64px 64px 80px 96px";

function ModelsTable({ rows, lab, onOpenModel }: { rows: readonly DashboardRow[]; lab: Lab | null; onOpenModel: (id: string) => void }) {
  const list = useMemo(() => sortModelRows(modelRows(rows), lab), [rows, lab]);
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Models" style={{ minWidth: TABLE_MIN_WIDTH, display: "flex", flexDirection: "column" }}>
          <PlainHeader
            columns={MODELS_COLUMNS}
            labels={[
              { label: "Model version" },
              { label: "Lab" },
              { label: "Builds", right: true },
              { label: "Sessions", right: true },
              { label: "Prompts", right: true },
              { label: "AI turns", right: true },
              { label: "Engagement", right: true },
              { label: "Last used" },
            ]}
          />
          <div role="rowgroup">
            {list.map((row) => {
              const isNew = row.modelId ? (MODEL_VERSIONS.find((version) => version.id === row.modelId)?.isNew ?? false) : false;
              return (
                <div key={row.modelId ?? `raw:${row.modelName}`} role="row" data-testid="dash-model-row" style={bodyRow(MODELS_COLUMNS, false)}>
                  <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <ModelMark model={row.modelName} size={16} />
                    {row.modelId ? (
                      <button
                        type="button"
                        onClick={() => onOpenModel(row.modelId as string)}
                        style={{
                          ...bareButton,
                          ...text(12.5, 500, t.text, ellipsis),
                          textDecoration: "underline",
                          textDecorationColor: t.line,
                          textUnderlineOffset: 3,
                        }}
                      >
                        {row.modelName}
                      </button>
                    ) : (
                      /* A model the registry does not name has no id to filter by, so it is a name, not a button. */
                      <span style={text(12.5, 500, t.text, ellipsis)}>{row.modelName}</span>
                    )}
                    {isNew ? <Pill tone="evidence">new</Pill> : null}
                  </div>
                  <div role="cell" style={text(12.5, 400, row.lab ? t.text2 : t.label, ellipsis)}>
                    {row.lab ?? "–"}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.builds)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.sessions)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.prompts)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.turns)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.engagement.total)}
                  </div>
                  <div role="cell" style={{ minWidth: 0 }}>
                    {row.lastUsed ? (
                      <DateCell at={row.lastUsed.at} line={row.lastUsed.buildTitle} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        {NONE}
                        <span style={text(11.5, 400, t.label, ellipsis)}>Not used in any build yet</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {list.length === 0 ? <EmptyLine>No models match these filters.</EmptyLine> : null}
    </div>
  );
}

function MakersTable({ rows }: { rows: readonly DashboardRow[] }) {
  const list = useMemo(() => sortMakerRows(makerRows(rows)), [rows]);
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Makers" style={{ minWidth: TABLE_MIN_WIDTH, display: "flex", flexDirection: "column" }}>
          <PlainHeader
            columns={MAKERS_COLUMNS}
            labels={[
              { label: "Maker" },
              { label: "Builds", right: true },
              { label: "Sessions", right: true },
              { label: "AI models" },
              { label: "Prompts", right: true },
              { label: "AI turns", right: true },
              { label: "Engagement", right: true },
              { label: "Last published" },
            ]}
          />
          <div role="rowgroup">
            {list.map((row) => {
              const handle = row.creator.handle;
              return (
                <div key={row.creator.id} role="row" data-testid="dash-maker-row" style={bodyRow(MAKERS_COLUMNS, false)}>
                  <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Avatar size={24} userId={row.creator.id} name={handle || "Maker"} />
                    {handle ? (
                      <Link to={`/profile/${encodeURIComponent(handle)}`} style={text(12.5, 500, t.text, { ...ellipsis, textDecoration: "none" })}>
                        @{handle}
                      </Link>
                    ) : (
                      <span style={text(12.5, 500, t.text2)}>a maker</span>
                    )}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.builds)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.sessions)}
                  </div>
                  <div role="cell" style={{ minWidth: 0 }}>
                    <ModelsCell row={{ modelsUsed: row.models }} />
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.prompts)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.turns)}
                  </div>
                  <div role="cell" style={numberCell}>
                    {formatCount(row.engagement.total)}
                  </div>
                  <div role="cell" style={text(12, 500, row.lastPublishedAt ? t.text : t.label, tnum)}>
                    {row.lastPublishedAt ? shortDate(row.lastPublishedAt) : "–"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {list.length === 0 ? <EmptyLine>No makers match these filters.</EmptyLine> : null}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading builds">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} style={bodyRow(GRID_COLUMNS, false)}>
          <Skeleton height={13} width="70%" />
          <Skeleton height={13} width="80%" />
          <Skeleton height={13} />
          <Skeleton height={13} />
          <Skeleton height={13} />
          <Skeleton height={13} />
          <Skeleton height={16} width={56} />
          <Skeleton height={13} width="80%" />
          <Skeleton height={16} width={24} />
        </div>
      ))}
    </div>
  );
}

/* ── the summary bar ── */

/** A calculation toggle: pressed is the control recipe at its hover fill; off is quiet text. */
function CalcToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{
        ...bareButton,
        ...text(12, 400, on ? t.text : t.text2),
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: 6,
        ...(on ? { ...CONTROL, ...CONTROL_HOVER } : { border: "1px solid transparent" }),
      }}
    >
      {children}
    </button>
  );
}

const strong = (value: ReactNode) => <span style={{ color: t.text, fontWeight: 500 }}>{value}</span>;

/* ── the content ── */

function Content(props: GalleryDashboardViewProps) {
  const { tab, onTabChange, rows, status, sort, query, onSearch, onViewChange, onClearFilters, openId = null } = props;
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [sum, setSum] = useState(false);
  const [average, setAverage] = useState(false);

  const sorted = useMemo(() => sortDashboardRows(rows, sort), [rows, sort]);
  /* Only what is in view stays ticked: a filter that hides a row unticks it. */
  const selected = useMemo(() => sorted.filter((row) => ticked.has(row.id)), [sorted, ticked]);
  const all: boolean | "mixed" = sorted.length > 0 && selected.length === sorted.length ? true : selected.length > 0 ? "mixed" : false;

  useEffect(() => {
    if (selected.length !== ticked.size) setTicked(new Set(selected.map((row) => row.id)));
  }, [selected, ticked]);

  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const title = tab === "models" ? "Models" : tab === "makers" ? "Makers" : "Builds";
  const menus = menusFor(props);

  return (
    <section style={{ flex: "999 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <h1 style={text(20, 500, t.text, { margin: 0, letterSpacing: "-0.015em" })}>{title}</h1>
        <span
          data-testid="dash-pill"
          style={text(11.5, 400, t.text2, {
            display: "inline-flex",
            alignItems: "center",
            height: 20,
            padding: "0 6px",
            boxSizing: "border-box",
            borderRadius: 4,
            background: t.tagFill,
            whiteSpace: "nowrap",
          })}
        >
          {pillText(props.model, props.lab)}
        </span>
        <span style={{ flexGrow: 1 }} />
        <RefinedSearchField query={query} onSearch={onSearch} phone={false} width={240} />
        <Segmented<GalleryViewMode>
          label="Gallery view"
          size={28}
          fontSize={12}
          semantics="radio"
          value="dashboard"
          onChange={onViewChange}
          items={[
            { value: "feed", label: "Feed" },
            { value: "dashboard", label: "Dashboard" },
          ]}
        />
      </div>

      <UnderlineTabs<DashboardTab>
        label="Dashboard tabs"
        value={tab}
        onChange={onTabChange}
        tabs={[
          { value: "builds", label: "Builds" },
          { value: "models", label: "Models" },
          { value: "makers", label: "Makers" },
        ]}
      />

      {tab !== "builds" ? (
        <div role="tabpanel" aria-label={title}>
          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <ErrorState panel={`The ${title.toLowerCase()} table`} onRetry={props.onRetry} error={props.error} />
          ) : tab === "models" ? (
            <ModelsTable rows={rows} lab={props.lab} onOpenModel={props.onOpenModel} />
          ) : (
            <MakersTable rows={rows} />
          )}
        </div>
      ) : (
        <div role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {menus.map((menu) => (
              <ToolbarMenuView key={menu.key} menu={menu} />
            ))}
            <span style={{ flexGrow: 1 }} />
            <Button
              variant="secondary"
              size={28}
              fontSize={12}
              data-testid="dash-export"
              disabled={status !== "ready"}
              onClick={() => downloadText("gallery-builds.csv", buildCsv(sorted))}
            >
              Export
            </Button>
          </div>

          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <ErrorState panel="The builds table" onRetry={props.onRetry} error={props.error} />
          ) : (
            <div>
              <div style={{ overflowX: "auto" }}>
                <div role="table" aria-label="Builds" style={{ minWidth: TABLE_MIN_WIDTH, display: "flex", flexDirection: "column" }}>
                  <Header all={all} onToggleAll={() => setTicked(all === true ? new Set() : new Set(sorted.map((row) => row.id)))} />
                  <div role="rowgroup">
                    {sorted.map((row) => (
                      <BuildRow
                        key={row.id}
                        row={row}
                        selected={ticked.has(row.id)}
                        open={openId === row.id}
                        onToggle={() => toggle(row.id)}
                        onOpen={() => props.onOpenBuild(row)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {sorted.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
                  <EmptyLine>No builds match these filters.</EmptyLine>
                  <Button variant="secondary" size={28} fontSize={12} onClick={onClearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          <div
            data-testid="dash-footer"
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 16, borderTop: `1px solid ${t.hairline}` }}
          >
            <span style={text(12, 400, t.text2, { ...tnum, flexGrow: 1 })}>
              {strong(formatCount(sorted.length))} {sorted.length === 1 ? "build" : "builds"} in view
              {selected.length > 0 ? (
                <>
                  {" · "}
                  {strong(formatCount(selected.length))} selected
                </>
              ) : null}
            </span>
            <CalcToggle on={sum} onClick={() => setSum(!sum)}>
              Sum of prompts
              {sum ? <span style={{ fontWeight: 500, ...tnum }}>{formatCount(sumOfPrompts(sorted))}</span> : null}
            </CalcToggle>
            <CalcToggle on={average} onClick={() => setAverage(!average)}>
              Avg sessions per build
              {average ? <span style={{ fontWeight: 500, ...tnum }}>{averageSessions(sorted)}</span> : null}
            </CalcToggle>
            <span aria-disabled="true" style={text(12, 400, t.label, { padding: "0 12px", cursor: "not-allowed" })}>
              + Add calculation
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── the view ── */

export function RefinedGalleryDashboardView(props: GalleryDashboardViewProps) {
  /* Looked up in every build, not the filtered rows: a linked build opens even when a filter hides it. */
  const openBuild = props.openId ? (props.allRows.find((row) => row.id === props.openId) ?? null) : null;
  return (
    <div
      data-testid="gallery-dashboard"
      data-look="refined"
      style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start", minWidth: 0 }}
    >
      <Sidebar {...props} />
      <Content {...props} />
      <BuildDetailSheet build={openBuild} onClose={props.onCloseBuild} />
    </div>
  );
}

export default RefinedGalleryDashboardView;
