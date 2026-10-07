/* UI-P50 — Gallery, the dashboard: how builds were made.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `GalleryDashboardPage` supplies live data; the dev compare page
   (/dev/kit/pages/gallery-dashboard) supplies the fixture. DESKTOP ONLY: below
   768px the page renders the feed instead (UI-P49), so this view never draws a
   phone layout.

   LAYOUT (1280 column): a grid `236px minmax(0, 1fr)`, gap 16. The sidebar is
   one plain Panel (heading, the three tabs, labs, reporting, links, drafts); the
   main panel is another (title and pill, search and the Feed | Dashboard switch,
   tabs, toolbar, the table, the footer's calculations).

   THE ADDRESS IS THE STATE, and it is not held here: every control is a callback
   the page answers by writing the address. The view owns only what is in
   flight: the ticked rows, the footer's two toggles and the search text before
   its debounce. UI-P50 built the Builds tab; UI-P51 adds the Models and Makers
   tabs (folds of the rows the filters leave) and the detail sheet, which is
   open exactly when `openId` names a build (`onOpenBuild` / `onCloseBuild`).

   EVERY COLOUR IS A TOKEN. */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Download, Minus, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { Panel } from "@/components/brand/Panel";
import { Segmented } from "@/components/brand/Segmented";
import { Skeleton } from "@/components/brand/Skeleton";
import { Sparkline } from "@/components/brand/charts";
import type { PageFit } from "@/components/shell/siteFrameFit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { makerRows, modelRows } from "@/lib/build/dashboardAggregates";
import type { DashboardRow } from "@/lib/build/gallery";
import type { DashboardActive, DashboardReport, DashboardSort, DashboardTab, GalleryViewMode } from "@/lib/build/galleryParams";
import { LABS, MODEL_VERSIONS, type Lab } from "@/lib/models/registry";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { BuildDetailSheet } from "./BuildDetailSheet";
import { menuContent, menuItem, groupHeading, SearchField } from "./GalleryFeedView";
import {
  ACTIVE_ITEMS,
  DASHBOARD_SORT_ITEMS,
  audienceCounts,
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
  type DashboardCounts,
} from "./dashboardModel";
import { formatCount } from "./galleryModel";

/* ── the view's props ── */

export interface GalleryDashboardViewProps {
  fit?: PageFit;
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onViewChange: (view: GalleryViewMode) => void;
  /** The builds the filters leave, in no particular order: the view sorts them. */
  rows: readonly DashboardRow[];
  /** Every gallery build, for the "Made for" menu's counts. */
  allRows: readonly DashboardRow[];
  /** The sidebar's numbers, over every gallery build. */
  counts: DashboardCounts;
  status: "loading" | "error" | "ready";
  error?: unknown;
  onRetry: () => void;
  query: string | null;
  onSearch: (query: string | null) => void;
  /** A ModelVersion id, or null for all. */
  model: string | null;
  onModelChange: (id: string | null) => void;
  lab: Lab | null;
  onLabChange: (lab: Lab | null) => void;
  audience: string | null;
  onAudienceChange: (audience: string | null) => void;
  report: DashboardReport | null;
  onReportChange: (report: DashboardReport | null) => void;
  active: DashboardActive | null;
  onActiveChange: (days: DashboardActive | null) => void;
  sort: DashboardSort;
  onSortChange: (sort: DashboardSort) => void;
  onClearFilters: () => void;
  /** The signed-in reader's drafts box; absent when signed out. */
  drafts?: { count: number | null };
  onConnect: () => void;
  /** Opens a build's detail sheet. */
  onOpenBuild: (row: DashboardRow) => void;
  /** Closes it. */
  onCloseBuild: () => void;
  /** The build open in the sheet, which keeps its row highlighted. */
  openId?: string | null;
  /** The Models tab's version button: the Builds tab, filtered to that ModelVersion id. */
  onOpenModel: (id: string) => void;
}

/* ── small pieces ── */

const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  fontVariantNumeric: "tabular-nums",
  ...extra,
});

const figtree = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

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

/** The 18px checkbox: a button with `role="checkbox"`, so it can say "mixed". */
function Box({ checked, label, onChange }: { checked: boolean | "mixed"; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{
        ...bareButton,
        width: 18,
        height: 18,
        borderRadius: 5,
        boxSizing: "border-box",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: checked ? t.text : "transparent",
        border: `1px solid ${checked ? t.text : t.line}`,
        color: t.onText,
      }}
    >
      {checked === "mixed" ? (
        <Minus size={12} strokeWidth={2} aria-hidden="true" />
      ) : checked ? (
        <Check size={12} strokeWidth={2} aria-hidden="true" />
      ) : null}
    </button>
  );
}

/** A sidebar row: the label grows, the count sits on the right. */
function NavButton({
  label,
  count,
  on,
  onClick,
  minHeight,
  pressed,
  lead,
  current,
  testId,
}: {
  label: string;
  count?: number;
  on: boolean;
  onClick: () => void;
  minHeight: number;
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
        ...figtree(14, { fontWeight: on ? 600 : 400, color: t.text }),
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight,
        padding: "0 8px",
        boxSizing: "border-box",
        borderRadius: 10,
        background: on ? t.rowHighlight : "transparent",
      }}
    >
      {lead}
      <span style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count !== undefined ? <span style={mono(12, { color: t.text2, fontWeight: 400 })}>{formatCount(count)}</span> : null}
    </button>
  );
}

const sectionHeading: CSSProperties = mono(11, {
  color: t.label,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  padding: "0 8px 4px",
});

const linkRow: CSSProperties = {
  ...figtree(14, { color: t.text2 }),
  display: "flex",
  alignItems: "center",
  minHeight: 36,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 10,
  textDecoration: "none",
  width: "100%",
};

/* ── the sidebar ── */

function Sidebar(props: GalleryDashboardViewProps) {
  const { tab, onTabChange, counts, lab, onLabChange, report, onReportChange, drafts, onConnect } = props;
  const tabs: { value: DashboardTab; label: string; count: number }[] = [
    { value: "builds", label: "Builds", count: counts.builds },
    { value: "models", label: "Models", count: MODEL_VERSIONS.length },
    { value: "makers", label: "Makers", count: counts.makers },
  ];
  const draftCount = drafts?.count ?? null;
  return (
    <Panel as="aside" padding="16px 12px" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "0 8px" }}>
        <div style={figtree(15, { fontWeight: 600, color: t.text })}>Gallery</div>
        <div style={figtree(13, { color: t.text2 })}>How builds were made</div>
      </div>

      <nav aria-label="Dashboard" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tabs.map((item) => (
          <NavButton
            key={item.value}
            testId={`dash-nav-${item.value}`}
            label={item.label}
            count={item.count}
            on={tab === item.value}
            current
            minHeight={38}
            onClick={() => onTabChange(item.value)}
          />
        ))}
      </nav>

      <div role="group" aria-label="Labs" style={{ display: "flex", flexDirection: "column" }}>
        <div style={sectionHeading}>Labs</div>
        {LABS.map((name) => (
          <NavButton
            key={name}
            testId={`dash-lab-${name}`}
            label={name}
            count={counts.byLab[name] ?? 0}
            on={lab === name}
            pressed
            minHeight={36}
            onClick={() => onLabChange(lab === name ? null : name)}
            lead={
              <span
                aria-hidden="true"
                style={mono(11, {
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: t.cell,
                  color: t.text,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontWeight: 400,
                })}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            }
          />
        ))}
      </div>

      <div role="group" aria-label="Reporting" style={{ display: "flex", flexDirection: "column" }}>
        <div style={sectionHeading}>Reporting</div>
        <NavButton
          testId="dash-report-month"
          label="Active this month"
          count={counts.activeThisMonth}
          on={report === "month"}
          pressed
          minHeight={36}
          onClick={() => onReportChange(report === "month" ? null : "month")}
        />
        <NavButton
          testId="dash-report-multi"
          label="Built over 3+ sessions"
          count={counts.multiSession}
          on={report === "multi"}
          pressed
          minHeight={36}
          onClick={() => onReportChange(report === "multi" ? null : "multi")}
        />
      </div>

      <div style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 8, display: "flex", flexDirection: "column" }}>
        <button type="button" onClick={onConnect} style={{ ...bareButton, ...linkRow }}>
          Connect a tool
        </button>
        <Link to="/about" style={linkRow}>
          Help
        </Link>
      </div>

      {drafts ? (
        <div
          data-testid="dash-drafts"
          style={{
            padding: 12,
            borderRadius: 12,
            background: t.cell,
            border: `1px solid ${t.hairline}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div>
            <div style={figtree(14, { fontWeight: 600, color: t.text })}>
              {draftCount === null ? "Drafts" : `${formatCount(draftCount)} ${draftCount === 1 ? "draft" : "drafts"}`}
            </div>
            <div style={figtree(13, { color: t.text2 })}>Waiting to be finished</div>
          </div>
          <Link
            to="/drafts"
            style={{
              ...figtree(13, { fontWeight: 500, color: t.text }),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 36,
              width: "100%",
              boxSizing: "border-box",
              borderRadius: r.control,
              border: `1px solid ${t.line}`,
              background: t.glass2,
              textDecoration: "none",
            }}
          >
            Open drafts
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}

/* ── the toolbar's menus ── */

interface ToolbarOption {
  key: string;
  label: string;
  /** A mono note on the right: a count, or a model's lab. */
  note?: string;
  selected: boolean;
  onSelect: () => void;
}

interface ToolbarMenu {
  key: string;
  label: string;
  value: string;
  groups: { heading?: string; options: ToolbarOption[] }[];
}

function ToolbarMenuView({ menu }: { menu: ToolbarMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size={36} fontSize={13} data-testid={`dash-menu-${menu.key}`}>
          <span style={{ color: t.text2, fontWeight: 500 }}>{menu.label}</span>
          <span style={{ fontWeight: 600, color: t.text }}>{menu.value}</span>
          <ChevronDown size={12} strokeWidth={1.8} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} style={menuContent} aria-label={menu.label}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} role="group" aria-label={group.heading}>
            {group.heading ? <div style={groupHeading}>{group.heading}</div> : null}
            {group.options.map((option) => (
              <DropdownMenuItem
                key={option.key}
                role="menuitemradio"
                aria-checked={option.selected}
                className={MENU_ITEM_CLASS}
                style={menuItem}
                onSelect={option.onSelect}
              >
                <span
                  style={{
                    flexGrow: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: option.selected ? 600 : 500,
                    color: option.selected ? t.text : undefined,
                  }}
                >
                  {option.label}
                </span>
                {option.selected ? <Check size={14} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
                {option.note ? <span style={mono(12, { color: t.label, flexShrink: 0 })}>{option.note}</span> : null}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function menusFor(props: GalleryDashboardViewProps): ToolbarMenu[] {
  const { sort, onSortChange, model, onModelChange, audience, onAudienceChange, allRows, active, onActiveChange } = props;
  const audiences = audienceCounts(allRows);
  // A chosen audience nobody lists any more (an old link) can still be seen and turned off.
  if (audience && !audiences.some((entry) => entry.value === audience)) audiences.push({ value: audience, count: 0 });
  const chosenModel = model ? (MODEL_VERSIONS.find((entry) => entry.id === model) ?? null) : null;

  return [
    {
      key: "sort",
      label: "Sort by",
      value: DASHBOARD_SORT_ITEMS.find((item) => item.value === sort)?.label ?? "Engagement",
      groups: [
        {
          options: DASHBOARD_SORT_ITEMS.map((item) => ({
            key: item.value,
            label: item.label,
            selected: sort === item.value,
            onSelect: () => onSortChange(item.value),
          })),
        },
      ],
    },
    {
      key: "model",
      label: "AI model",
      value: chosenModel ? chosenModel.name : "All models",
      groups: [
        { options: [{ key: "all", label: "All models", selected: model === null, onSelect: () => onModelChange(null) }] },
        {
          options: MODEL_VERSIONS.map((version) => ({
            key: version.id,
            label: version.name,
            note: version.lab,
            selected: model === version.id,
            onSelect: () => onModelChange(version.id),
          })),
        },
      ],
    },
    {
      key: "for",
      label: "Made for",
      value: audience ?? "Any",
      groups: [
        {
          options: [
            { key: "any", label: "Any", selected: audience === null, onSelect: () => onAudienceChange(null) },
            ...audiences.map((entry) => ({
              key: entry.value,
              label: entry.value,
              note: formatCount(entry.count),
              selected: audience === entry.value,
              onSelect: () => onAudienceChange(entry.value),
            })),
          ],
        },
      ],
    },
    {
      key: "active",
      label: "Last activity",
      value: ACTIVE_ITEMS.find((item) => item.value === active)?.label ?? "Any time",
      groups: [
        {
          options: ACTIVE_ITEMS.map((item) => ({
            key: String(item.value),
            label: item.label,
            selected: active === item.value,
            onSelect: () => onActiveChange(item.value),
          })),
        },
      ],
    },
  ];
}

/* ── the table ── */

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) 210px 68px 68px 72px 92px 88px 150px 36px",
  columnGap: 10,
  alignItems: "center",
  padding: "0 8px",
  borderBottom: `1px solid ${t.hairline}`,
};

/* The prompt says 900, but its own tracks need 220 + 784 of fixed columns, 80 of gaps and 16 of padding: at
   900 the last columns spill out of the row's hairline and highlight. The table scrolls sideways from here. */
const TABLE_MIN_WIDTH = 1100;

const headCell: CSSProperties = figtree(12, { color: t.text2, fontWeight: 500 });
const rightCell: CSSProperties = { textAlign: "right" };
const numberCell: CSSProperties = mono(13, { color: t.text, textAlign: "right" });

function Header({ all, onToggleAll }: { all: boolean | "mixed"; onToggleAll: () => void }) {
  return (
    <div role="row" style={{ ...GRID, height: 38 }}>
      <div role="columnheader" style={{ ...headCell, display: "flex", alignItems: "center", gap: 10 }}>
        <Box checked={all} label="Select all builds" onChange={onToggleAll} />
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
      <div
        role="columnheader"
        title="Messages back and forth with the AI, across every session"
        style={{ ...headCell, ...rightCell }}
      >
        AI turns
      </div>
      <div
        role="columnheader"
        title="Runs, rebuilds, comments and saves from other people"
        style={{ ...headCell, ...rightCell }}
      >
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

function ModelsCell({ row }: { row: Pick<DashboardRow, "modelsUsed"> }) {
  const names = modelNamesOf(row);
  if (names.length === 0) return <span style={mono(13, { color: t.text2 })}>—</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span
        data-testid="dash-model-count"
        style={mono(11, {
          minWidth: 20,
          height: 20,
          boxSizing: "border-box",
          padding: "0 4px",
          borderRadius: 6,
          background: t.text,
          color: t.onText,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        })}
      >
        {names.length}
      </span>
      {names.slice(0, 2).map((name) => (
        <span
          key={name}
          style={mono(11, {
            padding: "1px 6px",
            borderRadius: 6,
            background: t.cell,
            color: t.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          })}
        >
          {name}
        </span>
      ))}
      {names.length > 2 ? <span style={mono(11, { color: t.text2, flexShrink: 0 })}>+{names.length - 2}</span> : null}
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
  const [hovered, setHovered] = useState(false);
  const total = seriesTotal(row.series);
  return (
    <div
      role="row"
      data-testid="dash-row"
      aria-selected={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...GRID, minHeight: 56, background: hovered || selected || open ? t.rowHighlight : "transparent" }}
    >
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Box checked={selected} label={`Select ${row.title}`} onChange={onToggle} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
          <button
            type="button"
            onClick={onOpen}
            style={{
              ...bareButton,
              ...figtree(14, { fontWeight: 600, color: t.text }),
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {row.title}
          </button>
          <span style={figtree(12, { color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>
            by {row.creator.handle ? `@${row.creator.handle}` : "a maker"}
          </span>
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
      <div role="cell">
        <Sparkline values={sparkValues(row.series)} width={80} height={22} label={`${total} engagements over 14 weeks`} />
      </div>
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {row.lastActivity.at ? (
          <>
            <span style={mono(13, { color: t.text, flexShrink: 0 })}>{shortDate(row.lastActivity.at)}</span>
            <span aria-hidden="true" style={{ width: 1, height: 12, background: t.line, flexShrink: 0 }} />
            <span
              title={row.lastActivity.what}
              style={figtree(13, { color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 })}
            >
              {row.lastActivity.what}
            </span>
          </>
        ) : (
          <span style={mono(13, { color: t.text2 })}>—</span>
        )}
      </div>
      <div role="cell">
        <IconButton icon={MoreHorizontal} size={30} label={`Open details for ${row.title}`} onClick={onOpen} />
      </div>
    </div>
  );
}

/* ── the Models and Makers tabs (UI-P51) ── */

const MODELS_GRID: CSSProperties = {
  ...GRID,
  gridTemplateColumns: "minmax(200px, 1.2fr) 110px 72px 72px 72px 80px 92px minmax(200px, 1fr)",
};
const MAKERS_GRID: CSSProperties = {
  ...GRID,
  gridTemplateColumns: "minmax(180px, 1fr) 64px 72px 230px 72px 80px 92px 110px",
};
/* Both sets of tracks plus their gaps and the row's padding come to about 990; the table scrolls sideways below that. */
const SIMPLE_TABLE_MIN_WIDTH = 1000;

function PlainHeader({ grid, columns }: { grid: CSSProperties; columns: { label: string; right?: boolean }[] }) {
  return (
    <div role="row" style={{ ...grid, height: 38 }}>
      {columns.map((column) => (
        <div key={column.label} role="columnheader" style={{ ...headCell, ...(column.right ? rightCell : null) }}>
          {column.label}
        </div>
      ))}
    </div>
  );
}

function NewBadge() {
  return (
    <span
      style={mono(10, {
        padding: "1px 6px",
        borderRadius: r.chip,
        background: t.evidenceFill,
        color: t.onEvidenceFill,
        flexShrink: 0,
      })}
    >
      new
    </span>
  );
}

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function ModelsTable({ rows, lab, onOpenModel }: { rows: readonly DashboardRow[]; lab: Lab | null; onOpenModel: (id: string) => void }) {
  const list = useMemo(() => sortModelRows(modelRows(rows), lab), [rows, lab]);
  return (
    <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
      <div role="table" aria-label="Models" style={{ minWidth: SIMPLE_TABLE_MIN_WIDTH }}>
        <PlainHeader
          grid={MODELS_GRID}
          columns={[
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
              <div key={row.modelId ?? `raw:${row.modelName}`} role="row" data-testid="dash-model-row" style={{ ...MODELS_GRID, minHeight: 48 }}>
                <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {row.modelId ? (
                    <button
                      type="button"
                      onClick={() => onOpenModel(row.modelId as string)}
                      style={{
                        ...bareButton,
                        ...mono(13, { fontWeight: 500, color: t.text }),
                        ...ellipsis,
                        textDecoration: "underline",
                        textDecorationColor: t.line,
                        textUnderlineOffset: 3,
                      }}
                    >
                      {row.modelName}
                    </button>
                  ) : (
                    /* A model the registry does not name has no id to filter by, so it is a name, not a button. */
                    <span style={mono(13, { fontWeight: 500, color: t.text, ...ellipsis })}>{row.modelName}</span>
                  )}
                  {isNew ? <NewBadge /> : null}
                </div>
                <div role="cell" style={figtree(14, { color: t.text2 })}>
                  {row.lab ?? "—"}
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
                <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {row.lastUsed ? (
                    <>
                      <span style={mono(13, { color: t.text, flexShrink: 0 })}>{shortDate(row.lastUsed.at)}</span>
                      <span aria-hidden="true" style={{ width: 1, height: 12, background: t.line, flexShrink: 0 }} />
                      <span title={row.lastUsed.buildTitle} style={figtree(13, { color: t.text2, minWidth: 0, ...ellipsis })}>
                        {row.lastUsed.buildTitle}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={mono(13, { color: t.text2 })}>—</span>
                      <span style={figtree(13, { color: t.text2, ...ellipsis })}>Not used in any build yet</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {list.length === 0 ? (
        <p data-testid="dash-empty" style={{ ...display(20), margin: 0, padding: "24px 8px 8px", color: t.text }}>
          No models match these filters.
        </p>
      ) : null}
    </div>
  );
}

function MakersTable({ rows }: { rows: readonly DashboardRow[] }) {
  const list = useMemo(() => sortMakerRows(makerRows(rows)), [rows]);
  return (
    <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
      <div role="table" aria-label="Makers" style={{ minWidth: SIMPLE_TABLE_MIN_WIDTH }}>
        <PlainHeader
          grid={MAKERS_GRID}
          columns={[
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
              <div key={row.creator.id} role="row" data-testid="dash-maker-row" style={{ ...MAKERS_GRID, minHeight: 48 }}>
                <div role="cell" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar size={26} userId={row.creator.id} name={handle || "Maker"} />
                  {handle ? (
                    <Link
                      to={`/profile/${encodeURIComponent(handle)}`}
                      style={{ ...figtree(14, { fontWeight: 500, color: t.text, ...ellipsis }), textDecoration: "none" }}
                    >
                      @{handle}
                    </Link>
                  ) : (
                    <span style={figtree(14, { fontWeight: 500, color: t.text2 })}>a maker</span>
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
                <div role="cell" style={mono(13, { color: row.lastPublishedAt ? t.text : t.text2 })}>
                  {row.lastPublishedAt ? shortDate(row.lastPublishedAt) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {list.length === 0 ? (
        <p data-testid="dash-empty" style={{ ...display(20), margin: 0, padding: "24px 8px 8px", color: t.text }}>
          No makers match these filters.
        </p>
      ) : null}
    </div>
  );
}


function TableSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading builds" style={{ padding: "0 16px" }}>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} style={{ ...GRID, height: 56 }}>
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={22} width={80} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={22} width={30} />
        </div>
      ))}
    </div>
  );
}

/* ── the main panel ── */

function CalcToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ ...bareButton, ...figtree(13, { color: on ? t.text : t.text2, fontWeight: on ? 600 : 400 }) }}
    >
      {children}
    </button>
  );
}

function Main(props: GalleryDashboardViewProps) {
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
  const tabs: { value: DashboardTab; label: string }[] = [
    { value: "builds", label: "Builds" },
    { value: "models", label: "Models" },
    { value: "makers", label: "Makers" },
  ];

  return (
    <Panel padding="0" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ ...display(30), margin: 0, color: t.text }}>{title}</h1>
          <span
            data-testid="dash-pill"
            style={{
              ...figtree(13, { color: t.text }),
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "2px 10px",
              borderRadius: r.chip,
              background: t.cell,
            }}
          >
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: r.full, background: t.evidence }} />
            {pillText(props.model, props.lab)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SearchField query={query} onSearch={onSearch} phone={false} size={{ width: 260, height: 38 }} />
          <Segmented<GalleryViewMode>
            label="Gallery view"
            size={34}
            fontSize={13}
            semantics="radio"
            value="dashboard"
            onChange={onViewChange}
            items={[
              { value: "feed", label: "Feed" },
              { value: "dashboard", label: "Dashboard" },
            ]}
          />
        </div>
      </div>

      <div role="tablist" aria-label="Dashboard tabs" style={{ display: "flex", gap: 20, padding: "8px 16px 0", borderBottom: `1px solid ${t.hairline}` }}>
        {tabs.map((item) => {
          const on = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTabChange(item.value)}
              style={{
                ...bareButton,
                ...figtree(14, { color: on ? t.text : t.text2, fontWeight: on ? 600 : 400 }),
                height: 40,
                boxSizing: "border-box",
                borderBottom: `2px solid ${on ? t.text : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab !== "builds" ? (
        <div role="tabpanel" aria-label={title}>
          {status === "loading" ? (
            <div style={{ paddingTop: 8 }}>
              <TableSkeleton />
            </div>
          ) : status === "error" ? (
            <div style={{ padding: "16px 24px" }}>
              <ErrorState panel={`The ${title.toLowerCase()} table`} onRetry={props.onRetry} error={props.error} />
            </div>
          ) : tab === "models" ? (
            <ModelsTable rows={rows} lab={props.lab} onOpenModel={props.onOpenModel} />
          ) : (
            <MakersTable rows={rows} />
          )}
        </div>
      ) : (
        <div role="tabpanel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "12px 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {menus.map((menu) => (
                <ToolbarMenuView key={menu.key} menu={menu} />
              ))}
            </div>
            <Button
              variant="secondary"
              size={36}
              fontSize={13}
              data-testid="dash-export"
              disabled={status !== "ready"}
              onClick={() => downloadText("gallery-builds.csv", buildCsv(sorted))}
            >
              <Download size={14} strokeWidth={1.8} aria-hidden="true" />
              Export
            </Button>
          </div>

          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <div style={{ padding: "16px 24px" }}>
              <ErrorState panel="The builds table" onRetry={props.onRetry} error={props.error} />
            </div>
          ) : (
            <div style={{ padding: "0 16px", overflowX: "auto" }}>
              <div role="table" aria-label="Builds" style={{ minWidth: TABLE_MIN_WIDTH }}>
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
              {sorted.length === 0 ? (
                <div data-testid="dash-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "24px 8px 0" }}>
                  <p style={{ ...display(20), margin: 0, color: t.text }}>No builds match these filters.</p>
                  <button
                    type="button"
                    onClick={onClearFilters}
                    style={{ ...bareButton, ...figtree(14, { fontWeight: 600, color: t.text }), padding: "24px 8px" }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div
            data-testid="dash-footer"
            style={{ ...figtree(13, { color: t.text2 }), display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 20px", padding: "12px 24px 16px" }}
          >
            <span>
              <span style={mono(13, { color: t.text })}>{formatCount(sorted.length)}</span> {sorted.length === 1 ? "build" : "builds"} in view
              {selected.length > 0 ? (
                <>
                  {" · "}
                  <span style={mono(13, { color: t.text })}>{formatCount(selected.length)}</span> selected
                </>
              ) : null}
            </span>
            <CalcToggle on={sum} onClick={() => setSum(!sum)}>
              Sum of prompts
              {sum ? <span style={mono(13, { color: t.text, marginLeft: 6 })}>{formatCount(sumOfPrompts(sorted))}</span> : null}
            </CalcToggle>
            <CalcToggle on={average} onClick={() => setAverage(!average)}>
              Avg sessions per build
              {average ? <span style={mono(13, { color: t.text, marginLeft: 6 })}>{averageSessions(sorted)}</span> : null}
            </CalcToggle>
            <span aria-disabled="true" style={{ opacity: 0.6, cursor: "not-allowed" }}>
              + Add calculation
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── the view ── */

export function GalleryDashboardView(props: GalleryDashboardViewProps) {
  /* Looked up in every build, not the filtered rows: a linked build opens even when a filter hides it. */
  const openBuild = props.openId ? (props.allRows.find((row) => row.id === props.openId) ?? null) : null;
  return (
    <div
      data-testid="gallery-dashboard"
      style={{
        display: "grid",
        gridTemplateColumns: "236px minmax(0, 1fr)",
        gap: 16,
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <Sidebar {...props} />
      <Main {...props} />
      <BuildDetailSheet build={openBuild} onClose={props.onCloseBuild} />
    </div>
  );
}

export default GalleryDashboardView;
