// The profile's tabs, on builds (RC-P21).
//
// THREE TABS, AND A FOURTH THAT IS A LINK ⟦hicks-law › Budgets: tabs ≤ 5; the
// page's own sequence⟧, in the order a reader weighs a maker: what they made,
// what they built on, where they helped.
//
//   Builds      their published builds, in the gallery's order
//   Rebuilds    the ones that rebuild somebody's work
//   Solutions   the builds on which a solution of theirs was accepted
//   Drafts      the viewer's own profile only: a link to /drafts, because a
//               draft is nobody else's business and already has its page
//
// The old zones filtered the product that was cleared (blueprints, blogs,
// reblogs, bounties, ratings, verifications), under a sort menu the order can
// be stated instead of offered; both are gone. The tab lives in the address
// (?tab=rebuilds), so Back and a shared link land where the reader was.
//
// THE DRAFTS LINK SITS IN THE ROW BUT OUTSIDE THE TABLIST: it opens another
// page rather than a panel, so it is a link and says so to assistive
// technology, and it is drawn as the row's other labels are so the row stays
// one set of peers.
//
// EVERY BUILD IS THE GALLERY'S CARD, signed and counted once for the tab's
// list: one useEngagement call, as the Gallery makes ⟦neoscale-performance⟧.
// A tab asks for its builds only when it is open.
//
// STATES (STATES.md): loading is the cards' own skeleton (row 20); a refusal
// is its sentence and "Try again" (row 21); an empty tab is one sentence in
// --text2 and at most one action, secondary because the header already holds
// the view's one filled button (row 19) ⟦aesthetic-usability › Applying It 4⟧.

import { useMemo, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { GalleryCard, GalleryCardSkeleton } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import type { GalleryBuild } from "@/lib/build/gallery";
import { isPermissionError } from "@/lib/errors/permission";
import {
  listMakerBuilds,
  listMakerSolvedBuilds,
  type MakerBuildsCursor,
  type MakerBuildsPage,
  type SolvedBuildsCursor,
} from "@/lib/profile/makerBuilds";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, label as labelType } from "@/lib/theme/type";

/** The tabs, in the row's order. Drafts is not one of them: it is a link. */
export const PROFILE_TABS = [
  { id: "builds", label: "Builds" },
  { id: "rebuilds", label: "Rebuilds" },
  { id: "solutions", label: "Solutions" },
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number]["id"];

/** "?tab=" as the page reads it; anything unknown is Builds. */
export function profileTabOf(value: string | null | undefined): ProfileTab {
  return PROFILE_TABS.some((tab) => tab.id === value) ? (value as ProfileTab) : "builds";
}

/** The cache root of every tab's list, for a caller that must refresh them. */
export const PROFILE_BUILDS_KEY = "profile-builds";

export interface ProfileContentZonesProps {
  /** The maker whose profile this is. */
  userId: string;
  /** The viewer is the maker: Drafts joins the row and the empty states offer a way on. */
  isOwnProfile: boolean;
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

/** Two cards a row in the profile's column; one on a phone. */
const COLUMNS = {
  xl: "repeat(2, minmax(0, 1fr))",
  lg: "repeat(2, minmax(0, 1fr))",
  md: "repeat(2, minmax(0, 1fr))",
  mobile: "minmax(0, 1fr)",
} as const;

/** The RC secondary action (STATES.md row 2): transparent, a --line border, 44 tall. */
const SECONDARY: CSSProperties = { background: "transparent", minHeight: 44 };

/* The build page's tab treatment (BuildTabs), so the two tab rows on the site
   read as one kind of thing ⟦law-of-similarity⟧: the label on --text2, the
   current tab --text over a 2px --action underline that is always there, only
   transparent at rest, so becoming current moves nothing. 44 tall
   ⟦responsive-design › Input Method Adaptation⟧. */
const tabBase: CSSProperties = {
  ...labelType,
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: 0,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  cursor: "pointer",
  textDecoration: "none",
  transition: feedback("color", "border-color"),
};

function TabButton({
  id,
  label,
  selected,
  onSelect,
  onKeyDown,
}: {
  id: ProfileTab;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="tab"
      id={`profile-tab-${id}`}
      aria-selected={selected}
      aria-controls={selected ? `profile-panel-${id}` : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        ...tabBase,
        color: selected || state.hovered ? t.text : t.text2,
        borderBottomColor: selected ? t.action : "transparent",
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

function DraftsLink() {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to="/drafts"
      data-testid="profile-drafts-link"
      {...handlers}
      style={{ ...tabBase, color: state.hovered ? t.text : t.text2, ...ring(state.focusVisible) }}
    >
      Drafts
    </Link>
  );
}

export function ProfileContentZones({ userId, isOwnProfile, activeTab, onTabChange }: ProfileContentZonesProps) {
  /** Left and right move between the tabs, as a tablist is expected to. */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: ProfileTab) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = PROFILE_TABS.findIndex((tab) => tab.id === id);
    const next = PROFILE_TABS[(index + step + PROFILE_TABS.length) % PROFILE_TABS.length];
    onTabChange(next.id);
    document.getElementById(`profile-tab-${next.id}`)?.focus();
  };

  return (
    <section data-testid="profile-tabs" style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      <div
        data-testid="profile-tab-row"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: SPACE.md,
          borderBottom: `1px solid ${t.line}`,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <div role="tablist" aria-label="Profile sections" style={{ display: "flex", gap: SPACE.md }}>
          {PROFILE_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              selected={tab.id === activeTab}
              onSelect={() => onTabChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, tab.id)}
            />
          ))}
        </div>
        {isOwnProfile ? <DraftsLink /> : null}
      </div>

      <div role="tabpanel" id={`profile-panel-${activeTab}`} aria-labelledby={`profile-tab-${activeTab}`}>
        {activeTab === "solutions" ? (
          <SolutionsPanel userId={userId} isOwnProfile={isOwnProfile} />
        ) : (
          <BuildsPanel key={activeTab} userId={userId} isOwnProfile={isOwnProfile} rebuildsOnly={activeTab === "rebuilds"} />
        )}
      </div>
    </section>
  );
}

/* ── The panels ──────────────────────────────────────────────────────────── */

function BuildsPanel({ userId, isOwnProfile, rebuildsOnly }: { userId: string; isOwnProfile: boolean; rebuildsOnly: boolean }) {
  const list = useInfiniteQuery({
    queryKey: [PROFILE_BUILDS_KEY, userId, rebuildsOnly ? "rebuilds" : "builds"],
    initialPageParam: null as MakerBuildsCursor | null,
    queryFn: ({ pageParam }): Promise<MakerBuildsPage<MakerBuildsCursor>> =>
      listMakerBuilds(userId, { rebuildsOnly, after: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
    refetchOnWindowFocus: false,
  });

  const empty = rebuildsOnly ? (
    <EmptyTab testId="profile-empty-rebuilds" sentence="No rebuilds yet." />
  ) : isOwnProfile ? (
    <EmptyTab
      testId="profile-empty-builds"
      sentence="You haven't published a build yet."
      action={
        <Button asChild variant="outline" style={SECONDARY}>
          <Link to="/compose/new">New build</Link>
        </Button>
      }
    />
  ) : (
    <EmptyTab testId="profile-empty-builds" sentence="Nothing published yet." />
  );

  return <TabList list={list} empty={empty} />;
}

function SolutionsPanel({ userId, isOwnProfile }: { userId: string; isOwnProfile: boolean }) {
  const list = useInfiniteQuery({
    queryKey: [PROFILE_BUILDS_KEY, userId, "solutions"],
    initialPageParam: null as SolvedBuildsCursor | null,
    queryFn: ({ pageParam }): Promise<MakerBuildsPage<SolvedBuildsCursor>> =>
      listMakerSolvedBuilds(userId, { after: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
    refetchOnWindowFocus: false,
  });

  const empty = (
    <EmptyTab
      testId="profile-empty-solutions"
      sentence="No solved gaps yet."
      action={
        isOwnProfile ? (
          <Button asChild variant="outline" style={SECONDARY}>
            <Link to="/bounties">See open bounties</Link>
          </Button>
        ) : undefined
      }
    />
  );

  return <TabList list={list} empty={empty} />;
}

interface TabListQuery {
  data?: { pages: Array<{ builds: GalleryBuild[] }> };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}

function TabList({ list, empty }: { list: TabListQuery; empty: ReactNode }) {
  const builds = useMemo(() => {
    // A build solved twice, on two pages, is one card.
    const seen = new Set<string>();
    const out: GalleryBuild[] = [];
    for (const page of list.data?.pages ?? []) {
      for (const build of page.builds) {
        if (seen.has(build.id)) continue;
        seen.add(build.id);
        out.push(build);
      }
    }
    return out;
  }, [list.data]);

  if (list.isLoading) return <CardGridSkeleton />;
  if (list.isError && builds.length === 0) {
    return <RefusedTab error={list.error} onRetry={() => void list.refetch()} />;
  }
  if (builds.length === 0) return empty;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <ProfileCardGrid builds={builds} />
      {list.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
          style={{ ...SECONDARY, alignSelf: "flex-start" }}
        >
          Show more
        </Button>
      ) : null}
    </div>
  );
}

/** The gallery's cards, signed and counted once for the whole list. */
function ProfileCardGrid({ builds }: { builds: GalleryBuild[] }) {
  const columns = COLUMNS[useBreakpoint()];
  const mediaRows = useMemo(() => builds.flatMap(cardMedia), [builds]);
  const srcByPath = useSignedMedia(mediaRows);
  const engagement = useEngagement(useMemo(() => builds.map((build) => build.id), [builds]));

  return (
    <ul
      data-testid="profile-cards"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: columns, gap: SPACE.sm }}
    >
      {builds.map((build) => (
        <li key={build.id} data-testid="profile-card" style={{ minWidth: 0 }}>
          <GalleryCard build={build} srcByPath={srcByPath} engagement={engagementFor(engagement, build.id)} />
        </li>
      ))}
    </ul>
  );
}

function CardGridSkeleton() {
  const columns = COLUMNS[useBreakpoint()];
  return (
    <div
      data-testid="profile-cards-loading"
      role="status"
      aria-label="Loading builds"
      style={{ display: "grid", gridTemplateColumns: columns, gap: SPACE.sm }}
    >
      {[0, 1].map((index) => (
        <GalleryCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** STATES.md row 19: one sentence in --text2 and at most one action. */
function EmptyTab({ testId, sentence, action }: { testId: string; sentence: string; action?: ReactNode }) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm, paddingBlock: SPACE.sm }}
    >
      <p style={{ ...body, color: t.text2, margin: 0 }}>{sentence}</p>
      {action ?? null}
    </div>
  );
}

/** STATES.md row 21: one sentence and a secondary "Try again". */
function RefusedTab({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div
      data-testid="profile-tab-error"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs, paddingBlock: SPACE.sm }}
    >
      <p style={{ ...body, color: t.text, margin: 0 }}>
        {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
      </p>
      <Button type="button" variant="outline" onClick={onRetry} style={SECONDARY}>
        Try again
      </Button>
    </div>
  );
}
