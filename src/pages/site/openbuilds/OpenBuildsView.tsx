/* SV-14: /openbuilds, the view. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The board is `design/reference/vision/dusk/openbuilds.html`: published builds that take contributions. The main column
   leads with the model release check, then the requests under their type tabs and a Sort; the side column holds the
   reader's requests, claims and record, Groups, the top contributors and the week's goal.

   EVERY SECTION IS ITS OWN COMPONENT and its own prop, and a section whose prop is absent is not drawn. That is how the
   live page leaves out what has no data yet (SV-14's README rule) while the dev page draws the whole board: the release
   check and the week's goal (SV-22), Your claims (SV-21), Groups (SV-24), and the session, part, brief, model test and
   review requests (SV-21, SV-22). Every request kind is drawn here already. */

import { Fragment, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { LampBar } from "@/components/brand/LampDot";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { InnerTile } from "@/components/vision/InnerTile";
import { PageFigure, type FigurePart } from "@/components/vision/PageFigure";
import { PlainRow } from "@/components/vision/PlainRow";
import { SectionChevron, SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { TypeChip } from "@/components/vision/TypeChip";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { OpenBuildsColumns, OpenBuildsPrimary, RequestAction, RequestSkeletons, SideRowSkeletons, SideSection, SortControl } from "./OpenBuildsFrame";
import type { OpenBuildsSort, OpenBuildsTab, StripTile } from "./openBuildsModel";

/* ── props ── */

export type PanelStatus = "loading" | "error" | "ready";

/** A clause in a facts line or a meta line: plain, in `--text`, or toned by meaning. */
export interface FactPart {
  text: string;
  tone?: "text" | "evidence" | "breakage" | "lit";
}
export type Fact = { parts: readonly FactPart[] } | { meToo: true };

export interface MeToo {
  count: number;
  pressed: boolean;
  onToggle: () => void;
}

interface RequestBase {
  id: string;
  title: string;
  /** "£40", or the muted "No reward" / "Any model". Absent: nothing on the right. */
  reward?: { text: string; muted?: boolean };
  /** "<build> · @maker · <origin> · <age>", joined with " · ". */
  meta: readonly string[];
  facts?: readonly Fact[];
  meToo?: MeToo;
  action: { label: string; to: string };
}

export interface StepRequest extends RequestBase {
  kind: "step";
  problem?: string | null;
  strip: readonly StripTile[];
}

export interface SessionRequest extends RequestBase {
  kind: "session";
  sessions: readonly { key: string; label: string; detail: string; open?: boolean }[];
}

export interface BriefAnswer {
  id: string;
  userId: string;
  handle: string;
  detail: string;
  runs: number;
  lit: boolean;
  hue?: number;
}

export interface BriefRequest extends RequestBase {
  kind: "brief";
  answersLine: string;
  compareTo: string;
  answers: readonly BriefAnswer[];
}

export interface ModelTestRequest extends RequestBase {
  kind: "model-test";
  models: readonly { model: string; state: "untested" | "worked" | "failed"; runs?: number; worked?: number }[];
}

export interface ReviewRequest extends RequestBase {
  kind: "review";
}

export type RequestItem = StepRequest | SessionRequest | BriefRequest | ModelTestRequest | ReviewRequest;

export interface ReleaseCheckProps {
  model: string;
  works: number;
  total: number;
  fails: number;
  untested: number;
  /** "released 3 days ago". */
  released: string;
  /** One per reproduced build, in the order drawn; height is a share of the row's 40. */
  bars: readonly { state: "works" | "fails" | "untested"; height: number }[];
  to: string;
  runTo: string;
}

export interface RequestsProps {
  tabs: readonly { value: OpenBuildsTab; label: string }[];
  tab: OpenBuildsTab;
  onTab: (tab: OpenBuildsTab) => void;
  sorts: readonly { value: OpenBuildsSort; label: string }[];
  sort: OpenBuildsSort;
  onSort: (sort: OpenBuildsSort) => void;
  status: PanelStatus;
  onRetry: () => void;
  items: readonly RequestItem[];
  /** The next page, when there is one. */
  more?: { loading: boolean; onMore: () => void };
}

export interface SideRow {
  id: string;
  label: string;
  detail?: string;
  to: string;
}

export interface SideListProps {
  status: PanelStatus;
  onRetry: () => void;
  meta: string;
  /** The section's own page, for its chevron. None: no chevron. */
  to?: string;
  rows: readonly SideRow[];
}

export interface RecordProps {
  status: PanelStatus;
  onRetry: () => void;
  meta: string;
  to: string;
  rows: readonly { label: string; value: string; detail?: string }[];
}

export interface ContributorsProps {
  status: PanelStatus;
  onRetry: () => void;
  meta: string;
  to: string;
  rows: readonly { id: string; handle: string; count: number; to: string; avatarUrl?: string | null; hue?: number }[];
}

export interface WeekGoalProps {
  percent: number;
  closed: number;
  goal: number;
}

export interface OpenBuildsViewProps {
  release?: ReleaseCheckProps;
  requests: RequestsProps;
  yourRequests?: SideListProps;
  yourClaims?: SideListProps;
  record?: RecordProps;
  groups?: SideListProps;
  contributors?: ContributorsProps;
  week?: WeekGoalProps;
}

/* ── pieces ── */

const TONE: Record<NonNullable<FactPart["tone"]>, string> = { text: t.text, evidence: t.evidence, breakage: t.catBreakage, lit: t.lit };

function Parts({ parts }: { parts: readonly FactPart[] }) {
  return (
    <>
      {parts.map((part, index) => (part.tone ? <span key={index} style={{ color: TONE[part.tone] }}>{part.text}</span> : <Fragment key={index}>{part.text}</Fragment>))}
    </>
  );
}

/** One sentence and Retry (CA-28's wording). */
function PanelError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 12.5, color: t.text2 }}>
      <span style={{ flexGrow: 1 }}>{what}</span>
      <RequestAction onClick={onRetry}>Retry</RequestAction>
    </div>
  );
}

/** Me too, in the facts line: the count changes at once and the button says whether it is pressed. */
function MeTooButton({ count, pressed, onToggle }: MeToo) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      {...handlers}
      style={{
        boxSizing: "content-box",
        padding: phone ? `${(TOUCH_MIN - 20) / 2}px 0` : 0,
        margin: phone ? `${(20 - TOUCH_MIN) / 2}px 0` : 0,
        background: "none",
        border: 0,
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize: 12,
        lineHeight: "20px",
        fontVariantNumeric: "tabular-nums",
        color: pressed || state.hovered ? t.text : t.label,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      Me too {count}
    </button>
  );
}

/* ── the model release check ── */

const BAR: Record<ReleaseCheckProps["bars"][number]["state"], string> = { works: t.evidence, fails: t.catBreakage, untested: t.line };

function LegendItem({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden="true" style={{ width: 3, height: 10, borderRadius: 1, background: colour }} />
      {children}
    </span>
  );
}

export function ReleaseCheck({ model, works, total, fails, untested, released, bars, to, runTo }: ReleaseCheckProps) {
  const parts: FigurePart[] = [
    { text: `Reproduced builds that work on ${model}` },
    { text: released },
    { text: `${fails} fail`, tone: "breakage" },
    { text: `${untested} not tested`, tone: "lit" },
  ];
  return (
    <section aria-label="Model release check">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <PageFigure figure={`${works} of ${total}`} parts={parts} />
        <SectionChevron to={to} name="the model release check" />
      </div>
      <div role="img" aria-label={`${works} of ${total} work on ${model}, ${fails} fail, ${untested} not tested`} style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40, marginTop: 24 }}>
        {bars.map((bar, index) => (
          <span key={index} aria-hidden="true" style={{ flex: 1, height: `${bar.height}%`, borderRadius: 1, background: BAR[bar.state] }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 20px", marginTop: 12, fontSize: 12, color: t.text2 }}>
        <LegendItem colour={t.evidence}>Works</LegendItem>
        <LegendItem colour={t.catBreakage}>Fails</LegendItem>
        <LegendItem colour={t.line}>Not tested</LegendItem>
        <span style={{ flex: 1 }} />
        <OpenBuildsPrimary to={runTo}>Run an untested build</OpenBuildsPrimary>
      </div>
    </section>
  );
}

/* ── requests ── */

const tileBox: CSSProperties = { boxSizing: "border-box", minWidth: 0, background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: r.control, padding: "10px 12px" };

/** The build's top-level steps around the gap: "n · Type" over the title, the open one a dashed slot. */
export function StepStripTiles({ tiles }: { tiles: readonly StripTile[] }) {
  const phone = useIsPhone();
  if (tiles.length === 0) return null;
  const columns = phone ? Math.min(tiles.length, 2) : tiles.length;
  return (
    <ol aria-label="Steps" style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6 }}>
      {tiles.map((tile) => {
        const head = [tile.number, tile.kind].filter(Boolean).join(" · ");
        return tile.open ? (
          <DashedSlot key={tile.id} as="li" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: t.text }}>{head ? `${head} · open` : "Open"}</div>
            <div style={{ fontSize: 12.5, color: t.text2, overflowWrap: "anywhere" }}>{tile.title}</div>
          </DashedSlot>
        ) : (
          <li key={tile.id} style={tileBox}>
            <div style={{ fontSize: 11.5, color: t.label }}>{head}</div>
            <div style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{tile.title}</div>
          </li>
        );
      })}
    </ol>
  );
}

function SessionTiles({ sessions }: { sessions: SessionRequest["sessions"] }) {
  const phone = useIsPhone();
  return (
    <ol aria-label="Sessions" style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gridTemplateColumns: `repeat(${phone ? 1 : sessions.length}, minmax(0, 1fr))`, gap: 6 }}>
      {sessions.map((session) => {
        const inner = (
          <>
            <span style={{ fontSize: 12.5 }}>{session.label}</span>
            <span style={{ fontSize: 11.5, color: session.open ? t.text : t.label }}>{session.detail}</span>
          </>
        );
        return session.open ? (
          <DashedSlot key={session.key} as="li" style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
            {inner}
          </DashedSlot>
        ) : (
          <li key={session.key} style={{ ...tileBox, display: "flex", justifyContent: "space-between" }}>
            {inner}
          </li>
        );
      })}
    </ol>
  );
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...handlers} style={{ color: state.hovered ? t.text : t.text2, textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

function BriefAnswers({ answersLine, compareTo, answers }: Pick<BriefRequest, "answersLine" | "compareTo" | "answers">) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottom: `1px solid ${t.hairline}`, fontSize: 12 }}>
        <span style={{ color: t.text2 }}>{answersLine}</span>
        <TextLink to={compareTo}>Compare answers</TextLink>
      </div>
      {answers.map((answer, index) => (
        <div
          key={answer.id}
          style={{ boxSizing: "content-box", display: "grid", gridTemplateColumns: "20px 1fr auto auto", columnGap: 12, alignItems: "center", minHeight: 44, borderBottom: index === answers.length - 1 ? "none" : `1px solid ${t.hairline}` }}
        >
          <Avatar size={20} userId={answer.userId} name={answer.handle} hue={answer.hue} />
          <span style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 500 }}>{answer.handle}</span>
            <span style={{ color: t.label }}> · {answer.detail}</span>
          </span>
          <span style={{ color: answer.runs === 0 ? t.label : t.text }}>{answer.runs}</span>
          {answer.lit ? <LampBar width={8} /> : <span style={{ width: 8 }} />}
        </div>
      ))}
    </div>
  );
}

const WORKED: Record<ModelTestRequest["models"][number]["state"], string> = { untested: t.lit, worked: t.evidence, failed: t.catBreakage };

function ModelRows({ models }: Pick<ModelTestRequest, "models">) {
  return (
    <div style={{ marginTop: 16 }}>
      {models.map((row, index) => (
        <div key={row.model} style={{ boxSizing: "content-box", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 40, borderBottom: index === models.length - 1 ? "none" : `1px solid ${t.hairline}` }}>
          <span>{row.model}</span>
          {row.state === "untested" ? (
            <span style={{ color: WORKED.untested }}>Not tested</span>
          ) : (
            <span>
              <span style={{ color: t.label }}>{`${row.runs ?? 0} ${row.runs === 1 ? "run" : "runs"} · `}</span>
              <span style={{ color: WORKED[row.state] }}>{`${row.worked ?? 0} worked`}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const CHIP: Record<RequestItem["kind"], string> = { step: "STEP", session: "SESSION", brief: "BRIEF", "model-test": "MODEL TEST", review: "REVIEW" };

/** One request: its head, its meta line, its body, and a facts line ending in its one control. */
export function RequestArticle({ item, last }: { item: RequestItem; last: boolean }) {
  const facts = item.facts ?? [];
  return (
    <article data-testid="openbuilds-request" data-kind={item.kind} style={{ padding: "28px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TypeChip>{CHIP[item.kind]}</TypeChip>
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{item.title}</h2>
        {item.reward ? <span style={item.reward.muted ? { color: t.label } : { fontWeight: 500 }}>{item.reward.text}</span> : null}
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: t.label }}>{item.meta.join(" · ")}</p>
      {item.kind === "step" && item.problem ? <p style={{ margin: "12px 0 0", color: t.text2 }}>{item.problem}</p> : null}
      {item.kind === "step" ? <StepStripTiles tiles={item.strip} /> : null}
      {item.kind === "session" ? <SessionTiles sessions={item.sessions} /> : null}
      {item.kind === "brief" ? <BriefAnswers answersLine={item.answersLine} compareTo={item.compareTo} answers={item.answers} /> : null}
      {item.kind === "model-test" ? <ModelRows models={item.models} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", marginTop: 16, fontSize: 12, color: t.label }}>
        {facts.map((fact, index) =>
          "meToo" in fact ? (
            item.meToo ? <MeTooButton key={index} {...item.meToo} /> : null
          ) : (
            <span key={index}>
              <Parts parts={fact.parts} />
            </span>
          ),
        )}
        <span style={{ flex: 1 }} />
        <RequestAction to={item.action.to}>{item.action.label}</RequestAction>
      </div>
    </article>
  );
}

/** The Sort control: the board's 28px control with its "Sort" label, opening a menu of the sorts (one chosen). */
function SortMenu({ sorts, sort, onSort }: Pick<RequestsProps, "sorts" | "sort" | "onSort">) {
  const current = sorts.find((option) => option.value === sort);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SortControl aria-label={`Sort: ${current?.label ?? ""}`}>
          <span style={{ color: t.label }}>Sort</span> {current?.label}
        </SortControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSort(value as OpenBuildsSort)}>
          {sorts.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Requests({ tabs, tab, onTab, sorts, sort, onSort, status, onRetry, items, more }: RequestsProps) {
  let body: ReactNode;
  if (status === "loading") body = <RequestSkeletons />;
  else if (status === "error") body = <PanelError what="Requests didn't load." onRetry={onRetry} />;
  else if (items.length === 0)
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 0", color: t.text2 }}>
        <span style={{ flexGrow: 1 }}>No open requests right now.</span>
        <RequestAction to="/builds">Browse builds</RequestAction>
      </div>
    );
  else
    body = (
      <>
        {items.map((item, index) => (
          <RequestArticle key={item.id} item={item} last={index === items.length - 1 && !more} />
        ))}
        {more ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 28, borderTop: `1px solid ${t.hairline}` }}>
            <RequestAction onClick={more.onMore}>{more.loading ? "Loading" : "Show more"}</RequestAction>
          </div>
        ) : null}
      </>
    );
  return (
    <section aria-label="Requests">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${t.hairline}` }}>
        <TextTabs tabs={tabs} value={tab} onChange={onTab} label="Request type" rule={false} />
        <SortMenu sorts={sorts} sort={sort} onSort={onSort} />
      </div>
      <div role="tabpanel" aria-label={tabs.find((entry) => entry.value === tab)?.label ?? "All"}>
        {body}
      </div>
    </section>
  );
}

/* ── the side column ── */

function SideLink({ to, last, children }: { to: string; last: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...handlers}
      style={{
        boxSizing: "content-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        borderBottom: last ? "none" : `1px solid ${t.hairline}`,
        color: state.hovered ? t.text2 : t.text,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

function SideList({ title, label, first, status, onRetry, meta, to, rows }: SideListProps & { title: string; label: string; first: boolean }) {
  return (
    <SideSection first={first} label={title}>
      <SectionHead title={title} meta={meta} to={to} openName={label} headingLevel={2} />
      {status === "loading" ? (
        <SideRowSkeletons />
      ) : status === "error" ? (
        <PanelError what={`${title} didn't load.`} onRetry={onRetry} />
      ) : rows.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          {rows.map((row, index) => (
            <SideLink key={row.id} to={row.to} last={index === rows.length - 1}>
              <span style={{ minWidth: 0 }}>{row.label}</span>
              {row.detail ? <span style={{ flexShrink: 0, fontSize: 12, color: t.label }}>{row.detail}</span> : null}
            </SideLink>
          ))}
        </div>
      ) : null}
    </SideSection>
  );
}

export function YourRecord({ first, status, onRetry, meta, to, rows }: RecordProps & { first: boolean }) {
  return (
    <SideSection first={first} label="Your record">
      <SectionHead title="Your record" meta={meta} to={to} openName="your record" headingLevel={2} />
      {status === "loading" ? (
        <SideRowSkeletons />
      ) : status === "error" ? (
        <PanelError what="Your record didn't load." onRetry={onRetry} />
      ) : (
        <div style={{ marginTop: 12 }}>
          {rows.map((row, index) => (
            <PlainRow
              key={row.label}
              label={row.label}
              value={
                <>
                  {row.value}
                  {row.detail ? <span style={{ fontWeight: 400, color: t.label }}> · {row.detail}</span> : null}
                </>
              }
              last={index === rows.length - 1}
            />
          ))}
        </div>
      )}
    </SideSection>
  );
}

function ContributorRow({ row, last }: { row: ContributorsProps["rows"][number]; last: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={row.to}
      {...handlers}
      style={{ boxSizing: "content-box", display: "flex", alignItems: "center", gap: 10, minHeight: 44, borderBottom: last ? "none" : `1px solid ${t.hairline}`, color: state.hovered ? t.text2 : t.text, textDecoration: "none", ...ring(state.focusVisible) }}
    >
      <Avatar size={24} userId={row.id} name={row.handle} src={row.avatarUrl} hue={row.hue} />
      <span style={{ flex: 1, minWidth: 0 }}>{row.handle}</span>
      <span>{row.count}</span>
    </Link>
  );
}

export function WeekGoal({ percent, closed, goal }: WeekGoalProps) {
  return (
    <InnerTile style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span>
          <span style={{ fontWeight: 500 }}>This week</span>
          <span style={{ color: t.label }}> · {percent}%</span>
        </span>
        <span style={{ color: t.label }}>Site goal</span>
      </div>
      <div role="img" aria-label={`${closed} of ${goal} requests closed this week`} style={{ display: "flex", gap: 4, marginTop: 12 }}>
        <span aria-hidden="true" style={{ flex: closed, height: 6, borderRadius: 2, background: t.evidence }} />
        <span aria-hidden="true" style={{ flex: Math.max(0, goal - closed), height: 6, borderRadius: 2, background: t.line }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5 }}>
        {closed} <span style={{ color: t.label }}>of</span> {goal} <span style={{ color: t.label }}>requests closed</span>
      </div>
    </InnerTile>
  );
}

export function TopContributors({ first, status, onRetry, meta, to, rows, week }: ContributorsProps & { first: boolean; week?: WeekGoalProps }) {
  return (
    <SideSection first={first} label="Top contributors">
      <SectionHead title="Top contributors" meta={meta} to={to} openName="contributors" headingLevel={2} />
      {status === "loading" ? (
        <SideRowSkeletons count={3} />
      ) : status === "error" ? (
        <PanelError what="Top contributors didn't load." onRetry={onRetry} />
      ) : rows.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          {rows.map((row, index) => (
            <ContributorRow key={row.id} row={row} last={index === rows.length - 1} />
          ))}
        </div>
      ) : null}
      {week ? <WeekGoal {...week} /> : null}
    </SideSection>
  );
}

/* ── the page ── */

export function OpenBuildsView({ release, requests, yourRequests, yourClaims, record, groups, contributors, week }: OpenBuildsViewProps) {
  // The side column's sections in the board's order; the first has no hairline above it.
  const side: { key: string; draw: (first: boolean) => ReactNode }[] = [];
  if (yourRequests) side.push({ key: "requests", draw: (first) => <SideList title="Your requests" label="your requests" first={first} {...yourRequests} /> });
  if (yourClaims) side.push({ key: "claims", draw: (first) => <SideList title="Your claims" label="your claims" first={first} {...yourClaims} /> });
  if (record) side.push({ key: "record", draw: (first) => <YourRecord first={first} {...record} /> });
  if (groups) side.push({ key: "groups", draw: (first) => <SideList title="Groups" label="groups" first={first} {...groups} /> });
  if (contributors) side.push({ key: "contributors", draw: (first) => <TopContributors first={first} week={week} {...contributors} /> });

  return (
    <>
      <VisuallyHidden>
        <h1>OpenBuilds</h1>
      </VisuallyHidden>
      <OpenBuildsColumns
        main={
          <>
            {release ? <ReleaseCheck {...release} /> : null}
            <Requests {...requests} />
          </>
        }
        side={side.map((entry, index) => (
          <Fragment key={entry.key}>{entry.draw(index === 0)}</Fragment>
        ))}
      />
    </>
  );
}

export default OpenBuildsView;
