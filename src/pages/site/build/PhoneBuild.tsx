/* Prompt 22 — the build page on a phone (below 768), as the Synth mobile brand pack draws it at 390. Nothing here is drawn at
   768 and up: `BuildView` chooses this view with `useIsPhone()`, and the desktop view is untouched.

   ORDER, TOP TO BOTTOM. The top bar is the shell's (back, More: Edit for the maker, Report for everyone else; the shell's More
   sheet adds Copy link). Then, on the Page shade and never boxed:

     head         the build's title as the h1 in Geist Serif 26/30, the maker ("Sun Tzu" 15/600 and "@suntzu · published
                  19 Nov" 15 Text 3), the summary line (13 Text 2, one line, said in full in its `title`), and a rebuild's
                  credit line ("Rebuilt from <source in Geist Serif> by @maker" 13 Text 3)
     actions      Rebuild, a full-width main `BigButton`; under it one row on Card (radius 10, 48 tall) split in three by the
                  Panel shade: Copy for AI, Download (the Download sheet once the build has a setup), Lineage; "Compare with
                  the original" as an underlined 13 link under it
     the post     the feed's post, with the thread's own "1 of 3 posts · Show more"
     sections     `PhonePills` "Sections of this build", only the ones with something to show; with Steps alone, no row
     the section  the chosen one, swapped in place
     lower        What you need, Before you send it, the owner's Completeness, Classification, Discussed in OpenBuilds (the
                  page draws the comments and where next after this view)

   A build from before the steps keeps today's phone pieces (the anatomy, the viewer and the timeline) on the Page shade. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { StripedBar } from "@/components/brand/StripedBar";
import { PostThread } from "@/components/post/PostThread";
import { PostRefsProvider } from "@/components/post/RefLinks";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { BigButton, PhoneBottomSheet, PhonePills, PhoneRow } from "@/components/phone";
import { PANEL_RADIUS, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { EngagementRow } from "@/components/social/EngagementRow";
import { creditLine } from "@/lib/build/contributors";
import { mappedHarnesses } from "@/lib/build/harnessMap";
import type { NeedGroup, NeedRow, ReaderStep } from "@/lib/build/readerSteps";
import { DONE } from "@/lib/copy/copy";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, SENTIENT } from "@/lib/theme/type";

import type { BuildActionsView, BuildHeroView, BuildStepsView, BuildThreadView, CompletenessView, ProofDetailView } from "./buildModel";
import { MISSING } from "./buildModel";
import { BeforeYouSendPanel } from "./BeforeYouSend";
import { DetailsGroup, StepsList, copyTextOf, needDomId, stepDomId, toolLookup } from "./BuildSteps";
import { AnatomyPanel, DOWNLOAD_COPY, TimelinePanel, Viewer, selectedPart, useAnnouncer, useConfirmed, type BuildViewProps } from "./BuildView";

/* ── type ── */

const type = (px: number, weight: 400 | 500 | 600, color: string, lineHeight: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight,
  color,
  ...extra,
});

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** The side margin every block on the page keeps. */
const side: CSSProperties = { paddingLeft: PHONE_MARGIN, paddingRight: PHONE_MARGIN };

/** A Panel module on the Page shade: radius 12, padding 16, margin 0 16. A shade, never a line. */
const panelModule: CSSProperties = { margin: `0 ${PHONE_MARGIN}px`, padding: 16, borderRadius: PANEL_RADIUS, background: t.surface, display: "flex", flexDirection: "column", gap: 10, minWidth: 0, boxSizing: "border-box" };

/** A section head that states the fact: 20/24 600 (tracking -0.01em), padding 20 16 8, and something small at its right. */
export function PhoneFact({ id, children, right }: { id?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: `20px ${PHONE_MARGIN}px 8px` }}>
      <h2 id={id} style={{ ...type(20, 600, t.text, "24px", { letterSpacing: "-0.01em" }), flex: 1, minWidth: 0, margin: 0 }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

/* ── the head ── */

function PhoneHead({ hero, thread }: { hero: BuildHeroView; thread?: BuildThreadView | null }) {
  const { maker } = hero;
  const handle = (maker?.handle ?? "").trim();
  const name = (maker?.name ?? "").trim() || handle;
  const published = thread?.published;
  const withLine = (maker?.contributors?.length ?? 0) > 0 ? creditLine("", maker?.contributors ?? []).trim() : "";
  const follow = thread?.follow;
  const rebuilt = hero.credit.rebuiltFrom;
  const profileHref = handle ? `/profile/${encodeURIComponent(handle)}` : null;
  const meta = [handle ? `@${handle}` : null, published ? `published ${published}` : null, withLine || null].filter(Boolean).join(" · ");
  return (
    <div data-testid="build-phone-head" style={{ display: "flex", flexDirection: "column", gap: 4, padding: `4px ${PHONE_MARGIN}px 0`, minWidth: 0 }}>
      <h1 style={{ margin: 0, fontFamily: SENTIENT, fontSize: 26, fontWeight: 400, lineHeight: "30px", letterSpacing: "-0.02em", color: t.text, overflowWrap: "anywhere" }}>{hero.title}</h1>
      {name || meta ? (
        <div data-testid="build-author-row" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, minWidth: 0, whiteSpace: "nowrap" }}>
          {maker ? <Avatar size={20} userId={maker.userId} name={name || "Maker"} src={maker.avatarUrl} /> : null}
          {name ? (
            profileHref ? (
              <Link to={profileHref} data-testid="build-author-name" style={{ ...type(15, 600, t.text, "20px"), textDecoration: "none", flex: "0 100 auto", minWidth: 0, ...ellipsis }}>
                {name}
              </Link>
            ) : (
              <span data-testid="build-author-name" style={{ ...type(15, 600, t.text, "20px"), flex: "0 100 auto", minWidth: 0, ...ellipsis }}>
                {name}
              </span>
            )
          ) : null}
          {meta ? <span style={{ ...type(15, 400, t.label, "20px"), flex: "0 1 auto", minWidth: 0, ...ellipsis }}>{meta}</span> : null}
          {follow ? (
            <Button data-testid="build-follow" variant="secondary" size={32} fontSize={13} data-hit="" disabled={follow.busy} onClick={follow.onToggle} style={{ marginLeft: "auto", flexShrink: 0 }}>
              {follow.following ? "Following" : "Follow"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hero.summary ? (
        <p data-testid="build-summary" title={hero.summary} style={{ ...type(13, 400, t.text2, "16px"), margin: 0, minWidth: 0, ...ellipsis }}>
          {hero.summary}
        </p>
      ) : null}
      {/* Without a post the outcome is the only words about the build: it stays, under the summary. */}
      {!thread && hero.outcome ? <p style={{ ...type(15, 400, t.text2, "20px"), margin: 0 }}>{hero.outcome}</p> : null}
      {rebuilt ? (
        <p data-testid="build-credit" style={{ ...type(13, 400, t.label, "16px"), margin: 0 }}>
          Rebuilt from <span style={{ fontFamily: SENTIENT, color: t.text2 }}>{rebuilt.title}</span>
          {rebuilt.handle ? ` by @${rebuilt.handle}` : ""}
        </p>
      ) : null}
      {hero.delta ? <p style={{ ...type(13, 400, t.label, "16px"), margin: 0 }}>{hero.delta}</p> : null}
    </div>
  );
}

/* ── the actions ── */

/** One third of the row on Card: 48 tall, 13/500, a button or a link. */
function RowCell({ label, onClick, to, testId, haspopup }: { label: string; onClick?: () => void; to?: string; testId: string; haspopup?: "dialog" }) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style: CSSProperties = {
    appearance: "none",
    border: 0,
    margin: 0,
    padding: "0 8px",
    height: 48,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: state.hovered ? hoverFill(t.module) : t.module,
    ...type(13, 500, t.text, "16px"),
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: "pointer",
    ...ring(state.focusVisible),
  };
  if (to) {
    return (
      <Link to={to} data-testid={testId} {...handlers} style={style}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" data-testid={testId} aria-haspopup={haspopup} onClick={onClick} {...handlers} style={style}>
      {label}
    </button>
  );
}

/** The Download sheet: the build, the setup as a folder, then "Rebuild in" and one row per harness. Each does what the desktop menu does. */
function DownloadSheet({ open, onOpenChange, onBuild, onSetup }: { open: boolean; onOpenChange: (open: boolean) => void; onBuild: () => void; onSetup: (harness?: string) => void }) {
  const choose = (run: () => void) => () => {
    onOpenChange(false);
    run();
  };
  return (
    <PhoneBottomSheet open={open} onOpenChange={onOpenChange} title="Download" data-testid="build-download-sheet">
      <div role="group" aria-label="Download" style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
        <PhoneRow title={DOWNLOAD_COPY.build} lead={{ kind: "icon", icon: "download" }} onSelect={choose(onBuild)} />
        <PhoneRow title={DOWNLOAD_COPY.setup} lead={{ kind: "icon", icon: "sources" }} onSelect={choose(() => onSetup())} />
        <p style={{ ...type(13, 400, t.label, "16px"), margin: 0, padding: `12px ${PHONE_MARGIN}px 4px` }}>{DOWNLOAD_COPY.rebuildIn}</p>
        {/* Claude Code is the folder's own layout, as the desktop menu's "The setup, as a folder". */}
        {mappedHarnesses().map((entry) => (
          <PhoneRow key={entry.harness} title={entry.name} line="Harness" onSelect={choose(() => (entry.harness === "claude-code" ? onSetup() : onSetup(entry.harness)))} />
        ))}
      </div>
    </PhoneBottomSheet>
  );
}

function PhoneActions({ actions, announce }: { actions: BuildActionsView; announce: (text: string) => void }) {
  const [, confirmCopied] = useConfirmed();
  const [downloading, setDownloading] = useState(false);
  const copy = async () => {
    if (await actions.onCopyForAI()) {
      confirmCopied();
      announce(DONE.copied);
    }
  };
  const setup = actions.onDownloadSetup;
  return (
    <div data-testid="build-action-dock" role="group" aria-label="Take this build" style={{ display: "flex", flexDirection: "column", gap: 8, padding: `12px ${PHONE_MARGIN}px 0` }}>
      <BigButton main full data-testid="build-rebuild" onClick={actions.onRebuild}>
        Rebuild
      </BigButton>
      {/* One row on Card, the Panel shade showing between its three parts: a shade, never a line. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2, borderRadius: 10, overflow: "hidden", background: t.surface }}>
        <RowCell label="Copy for AI" testId="build-copy-for-ai" onClick={() => void copy()} />
        {setup ? (
          <RowCell label="Download" testId="build-download" haspopup="dialog" onClick={() => setDownloading(true)} />
        ) : (
          <RowCell label="Download" testId="build-download" onClick={actions.onDownload} />
        )}
        <RowCell label="Lineage" testId="build-lineage" to={actions.lineageTo} />
      </div>
      {actions.compareTo ? (
        <Link
          to={actions.compareTo}
          data-testid="build-compare"
          style={{ ...type(13, 400, t.text2, "16px"), alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 44, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          Compare with the original
        </Link>
      ) : null}
      {setup ? <DownloadSheet open={downloading} onOpenChange={setDownloading} onBuild={actions.onDownload} onSetup={setup} /> : null}
    </div>
  );
}

/* ── the post ── */

function PhonePost({ thread }: { thread: BuildThreadView }) {
  const engagement = <EngagementRow build={thread.build} counts={thread.engagement.counts} liked={thread.engagement.liked} saved={thread.engagement.saved} variant="page" compact />;
  const posts = <PostThread posts={thread.posts} mediaById={thread.mediaById} srcByPath={thread.srcByPath} mode="page" phone resetKey={thread.build.id} footer={engagement} />;
  return (
    <section data-testid="build-thread" aria-label="Post" style={{ ...side, paddingTop: 16, minWidth: 0 }}>
      <div data-testid="build-posts" style={{ minWidth: 0 }}>
        <MediaViewerProvider>{thread.refs ? <PostRefsProvider value={thread.refs}>{posts}</PostRefsProvider> : posts}</MediaViewerProvider>
      </div>
    </section>
  );
}

/* ── What you need ── */

/** "Model", "File · 120 KB", "Harness · Sonnet 4.6": what a row is, 13 Text 3. */
function kindLine(row: NeedRow): string {
  const file = row.kind === "file";
  const kind = row.kind === "harness" ? "Harness" : row.kind === "model" ? "Model" : row.kind === "tool" ? "Tool" : file ? "File" : "";
  const rest = file ? row.detail : row.model ? row.model : row.kind ? "" : row.detail;
  return [kind, rest].filter(Boolean).join(" · ");
}

function SmallDownload({ href, name }: { href: string; name: string }) {
  return (
    <Button variant="secondary" size={44} fontSize={13} href={href} aria-label={`Download ${name}`} {...{ download: name }}>
      Download
    </Button>
  );
}

/** Every step, its sub-steps flattened in, by id: an Other parts row that is an agent or a team offers "Copy the agent" or "Copy the team". */
function findStep(steps: readonly ReaderStep[], id: string): ReaderStep | undefined {
  for (const entry of steps) {
    if (entry.step.id === id) return entry;
    const inner = findStep(entry.children, id);
    if (inner) return inner;
  }
  return undefined;
}

function PhoneNeed({ steps, details, announce }: { steps: BuildStepsView; details: readonly ProofDetailView[]; announce: (text: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const row = open ? steps.need.flatMap((group) => group.rows).find((candidate) => candidate.id === open) : undefined;
  const entry = open ? findStep(steps.steps, open) : undefined;
  const container = entry && (entry.step.kind === "agent" || entry.step.kind === "team") ? entry : undefined;
  const madeWith = details.find((detail) => detail.label === "Made with" && detail.value !== MISSING);
  const firstResult = details.find((detail) => detail.label === "First result" && detail.value !== MISSING);
  const rest = details.filter((detail) => detail.value !== MISSING && detail.label !== "Made with" && detail.label !== "First result");
  const groups = steps.need.filter((group) => group.rows.length > 0);
  if (!madeWith && !firstResult && groups.length === 0 && rest.length === 0) return null;
  return (
    <section data-testid="build-need" aria-labelledby="build-need-heading" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <PhoneFact id="build-need-heading">What you need</PhoneFact>
      <div style={{ ...panelModule, padding: "8px 0" }}>
        {madeWith || firstResult ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 16px" }}>
            {[madeWith, firstResult].filter((line): line is ProofDetailView => Boolean(line)).map((line) => (
              <div key={line.label} style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
                <span style={{ ...type(13, 400, t.label, "16px"), flexShrink: 0 }}>{line.label}</span>
                <span style={{ ...type(13, 400, t.text, "16px"), minWidth: 0, overflowWrap: "anywhere" }}>{line.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {groups.map((group: NeedGroup) => (
          <section key={group.key} aria-label={group.label} style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ ...type(13, 400, t.label, "16px"), margin: 0, padding: "12px 16px 0" }}>{group.label}</p>
            {group.rows.map((needRow, index) => {
              const file = needRow.kind === "file";
              const line = kindLine(needRow);
              const key = `${needRow.kind ?? group.key}:${needRow.title}:${index}`;
              if (group.key === "other" && needRow.id) {
                const id = needRow.id;
                return (
                  <div key={key} id={needDomId(id)} data-testid="need-row">
                    <PhoneRow title={needRow.title} line={line || undefined} trail={{ kind: "chevron" }} onSelect={() => setOpen(id)} />
                  </div>
                );
              }
              return (
                <div key={key} data-testid="need-row">
                  <PhoneRow
                    title={needRow.title}
                    line={[line, needRow.extra].filter(Boolean).join(" · ") || undefined}
                    trail={file && needRow.download ? { kind: "node", node: <SmallDownload href={needRow.download} name={needRow.title} /> } : undefined}
                    to={file && needRow.steps?.length ? `#node-${needRow.steps[0].id}` : undefined}
                  />
                </div>
              );
            })}
            {group.note ? (
              <p data-testid="need-note" style={{ ...type(13, 400, t.text2, "18px"), margin: 0, padding: "0 16px 8px" }}>
                <span style={{ fontWeight: 500, color: t.text }}>{group.note.title}</span> {group.note.line}
              </p>
            ) : null}
          </section>
        ))}
        {rest.length > 0 ? (
          <div style={{ padding: "8px 16px 0" }}>
            <DetailsGroup details={rest} />
          </div>
        ) : null}
      </div>
      <PhoneBottomSheet open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)} title={row?.title ?? "Part"} data-testid="build-part-sheet">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: `0 ${PHONE_MARGIN}px 16px` }}>
          {open ? steps.otherBody(open) : null}
          {container ? (
            <BigButton
              full
              onClick={async () => {
                if (await steps.onCopy(copyTextOf(container))) announce(DONE.copied);
              }}
            >
              {container.step.kind === "team" ? "Copy the team" : "Copy the agent"}
            </BigButton>
          ) : null}
        </div>
      </PhoneBottomSheet>
    </section>
  );
}

/* ── Completeness ── */

function PhoneCompleteness({ completeness }: { completeness: CompletenessView }) {
  const { score, galleryAt, next } = completeness;
  return (
    <section data-testid="build-completeness" aria-label="Completeness" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <PhoneFact right={<span data-testid="build-completeness-private" style={{ ...type(13, 400, t.label, "16px"), flexShrink: 0 }}>Visible to you only</span>}>Completeness</PhoneFact>
      <div style={panelModule}>
        <div style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: t.text }}>{score}</span>
          {` of 100 · Gallery lists from ${galleryAt}`}
        </div>
        <StripedBar value={score} colour={t.evidence} height={11} label="Completeness" valueText={`${score} of 100. The gallery lists builds at ${galleryAt} or above.`} />
        {next ? <p style={{ ...type(13, 400, t.text2, "18px"), margin: 0 }}>Next: {next}.</p> : null}
      </div>
    </section>
  );
}

/* ── the view ── */

export function PhoneBuild(props: BuildViewProps) {
  const { hero, actions, proof, anatomy, viewer, timeline, steps } = props;
  const { announce, region } = useAnnouncer();
  useColumnPanels(true);
  const manyTabs = viewer.tabs.length > 1;
  const onSteps = viewer.tab === "anatomy";

  const section: ReactNode = steps ? (
    onSteps ? (
      <StepsList view={steps} phone announce={announce} titled={!manyTabs} />
    ) : (
      viewer.content
    )
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AnatomyPanel anatomy={anatomy} phone onSelect={anatomy.onSelect} />
      <Viewer viewer={viewer} part={selectedPart(anatomy)} phone announce={announce} />
      <TimelinePanel timeline={timeline} phone onPlay={timeline.onPlay} />
    </div>
  );

  return (
    <div data-testid="build-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", lineHeight: "normal", minWidth: 0, paddingBottom: 24 }}>
      <section data-testid="build-hero" data-hero={hero.thread ? "thread" : undefined} aria-label="The build" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div data-testid="build-title-block" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <PhoneHead hero={hero} thread={hero.thread} />
          <PhoneActions actions={actions} announce={announce} />
        </div>
        {hero.thread ? <PhonePost thread={hero.thread} /> : null}
      </section>

      <div data-testid="build-steps-panel" style={{ display: "flex", flexDirection: "column", minWidth: 0, paddingTop: manyTabs ? 8 : 20 }}>
        {manyTabs ? (
          <PhonePills
            label="Sections of this build"
            pills={viewer.tabs}
            value={viewer.tab}
            onChange={viewer.onTabChange}
            tabs={{ idOf: (value) => `build-tab-${value}`, controls: "build-tabpanel" }}
          />
        ) : null}
        <div role={manyTabs ? "tabpanel" : undefined} id="build-tabpanel" aria-labelledby={manyTabs ? `build-tab-${viewer.tab}` : undefined} style={{ ...side, paddingTop: manyTabs ? 8 : 0, minWidth: 0 }}>
          {section}
        </div>
      </div>

      {steps ? (
        <>
          <PhoneNeed steps={steps} details={proof.details} announce={announce} />
          <PhoneBeforeYouSend steps={steps} />
        </>
      ) : (
        <div style={{ ...side, paddingTop: 20 }}>
          <DetailsGroup details={proof.details} />
        </div>
      )}
      {proof.completeness ? <PhoneCompleteness completeness={proof.completeness} /> : null}
      {props.classification}
      {props.discussed}
      {region}
    </div>
  );
}

function PhoneBeforeYouSend({ steps }: { steps: BuildStepsView }) {
  const toolOf = toolLookup(steps.steps);
  return (
    <BeforeYouSendPanel
      phone
      steps={steps.steps}
      toolOf={toolOf}
      onSelect={(id) => document.getElementById(stepDomId(id))?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" })}
    />
  );
}

export default PhoneBuild;
