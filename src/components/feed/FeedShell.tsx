// The home feed's chrome: the compose strip, the competitions strip, the tab
// bar, and the three things a tab shows when it has no items (BG-P18).
//
// EVERYTHING HERE IS IN THE ENTRY BUNDLE, and that is the constraint that
// decides half the decisions below. Home is the page every visitor loads before
// anything else, so this file may import the token modules (already in Home's
// graph through `ui/badge`) and the two smallest kit components, and may NOT
// import the gallery card, the brand components, or anything that would drag
// them in. That is why the competitions strip does not reach for `gapEdge`,
// whose module brings two brand components with it.
//
// THE FEED IS A READING SURFACE, SO THE CARDS CARRY THE GLASS AND THE CHROME
// DOES NOT. The theme's blur budget is about twenty surfaces per page and a
// loaded feed spends all twenty on build cards, so the strips and the tab bar
// take `--glass` and `--recess` as COLOURS with no `backdrop-filter` — the same
// distinction `controls.ts` already draws for a secondary button. The tab bar in
// particular is better off opaque: it is sticky, so content scrolls under it,
// and `--recess` hides that where a translucent bar only half did.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.
// TWO THINGS HERE ARE CLASSES RATHER THAN STYLE OBJECTS, and both are
// Tailwind's OWN generated output rather than the hand-written CSS `neoscale-ui`
// forbids: `.scrollbar-hide`, the utility `index.css` already carries for a
// horizontal strip that must not show a bar; and BG-P07's own
// `TAB_TRIGGER_CLASS` and `FOCUS_RING_CLASS`, which carry the states — active,
// hover, focus-visible — that a style object cannot read.

import React from "react";
import {
  PlusCircle,
  Trophy,
  Sparkles,
  Users,
  TrendingUp,
  Clock,
  ChevronUp,
  Layers,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FOCUS_RING_CLASS,
  TAB_TRIGGER_CLASS,
  chipStyle,
  prefersReducedMotion,
  tabTriggerStyle,
  uiTransition,
} from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyText,
  cardTitle,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
  tabular,
} from "@/lib/theme/type";

export type FeedTabKey =
  // NS-P41. First in the union and first in TABS below, additive: the five
  // that follow it keep their order, their labels and their data paths.
  | "builds"
  | "foryou"
  | "following"
  | "trending"
  | "recent"
  | "bounties";

export interface BountyPreview {
  id: string;
  slug?: string | null;
  title: string;
  reward: string;
  endsIn: string;
}

export interface FeedCurrentUser {
  displayName: string;
  handle: string;
  avatarUrl?: string;
  initials: string;
}

interface FeedShellProps {
  currentUser: FeedCurrentUser | null;
  activeTab: FeedTabKey;
  onTabChange: (tab: FeedTabKey) => void;
  activeBounties: BountyPreview[];
  onBountySeeAll?: () => void;
  onBountyClick?: (b: BountyPreview) => void;
  feedCards: React.ReactNode[];
  isLoading: boolean;
  hasNewPosts: boolean;
  newPostCount: number;
  onLoadNewPosts: () => void;
  onComposeClick: () => void;
  isEmpty: boolean;
  onEmptyCTAClick: () => void;
  liveActive: boolean;
  /**
   * BG-P18. The tab's own data failed.
   *
   * A tab that errors shows the error INSTEAD of an empty state, because
   * "there is nothing here" and "we could not find out" are different facts
   * and only one of them is a reason to send a reader somewhere else.
   */
  isError?: boolean;
  /** What the data layer said, shown verbatim. Never invented. */
  errorMessage?: string | null;
  /** Asks the tab's queries again. Absent means no retry is offered. */
  onRetry?: () => void;
}

const TABS: { key: FeedTabKey; label: string }[] = [
  { key: "builds", label: "Builds" },
  { key: "foryou", label: "For You" },
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
  { key: "recent", label: "Recent" },
  { key: "bounties", label: "Bounties" },
];

/** The tab's own name, for the one sentence that has to say which failed. */
const TAB_LABEL: Record<FeedTabKey, string> = TABS.reduce(
  (acc, tab) => ({ ...acc, [tab.key]: tab.label }),
  {} as Record<FeedTabKey, string>,
);

/**
 * A tab's label, at the size the tab bar sets it.
 *
 * `label` is the role — 13px Figtree 500 — spent two steps larger, which is the
 * one size in this file that is not the role's own. A tab is the page's primary
 * navigation and the six of them are the only thing in the bar; at 13 they read
 * as metadata beside the 16px body below them. 15 at weight 500 clears the
 * theme's weight floor (which binds anything under 18px to 400 or more), so the
 * step up is legal rather than a waiver.
 */
const TAB_LABEL_TYPE = { ...labelText, fontSize: 15 } as const;

/**
 * What each tab says when it has nothing, in the platform's voice.
 *
 * QUIET, AND POINTING SOMEWHERE. Every one of these ends by naming a place with
 * more in it, because an empty feed is nearly always a reader who has not
 * followed anybody yet rather than a platform with nothing on it — and a dead
 * end teaches them the product is empty. None of them apologises, and none
 * suggests the reader did something wrong: an empty Following tab is a fact
 * about who they follow, not a fault.
 */
const EMPTY_STATES: Record<
  FeedTabKey,
  { icon: React.ElementType; headline: string; body: string; cta?: string }
> = {
  builds: {
    icon: Layers,
    headline: "Nothing here yet",
    body: "Builds, rebuilds and the notes people leave after running one land here as they are published. The gallery has more.",
    cta: "Open the gallery",
  },
  foryou: {
    icon: Sparkles,
    headline: "Nothing here yet",
    body: "This fills as the people you follow publish, run and rebuild things. The gallery has more.",
    cta: "Open Discover",
  },
  following: {
    icon: Users,
    headline: "Nothing here yet",
    body: "When somebody you follow publishes, shares or comments, it lands here. The gallery has more.",
    cta: "Open Discover",
  },
  trending: {
    icon: TrendingUp,
    headline: "Nothing trending right now",
    body: "Trending is recalculated through the day, so this is a lull rather than a wall. The gallery has more.",
  },
  recent: {
    icon: Clock,
    headline: "Nothing published recently",
    body: "New builds, collections and rebuilds arrive here first. The gallery has more.",
  },
  bounties: {
    icon: Trophy,
    headline: "No open bounties",
    body: "A bounty is a part of a build somebody marked unsolved. None are open right now — and you can mark one on a build of your own.",
    cta: "Start a bounty",
  },
};

/**
 * The reader's own avatar, beside the compose field.
 *
 * `--r-full` is correct here and is one of only two places it is: an avatar is
 * a genuinely circular object, which is the whole of what that step is for.
 */
function UserAvatar({ avatarUrl, initials }: { avatarUrl?: string; initials: string }) {
  return (
    <div
      className="shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        borderRadius: r.full,
        background: t.action,
        color: t.onAction,
        ...labelText,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function ComposeStrip({
  currentUser,
  onComposeClick,
}: {
  currentUser: FeedCurrentUser;
  onComposeClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        // `--glass` as a COLOUR, no blur: the cards below spend the page's blur
        // budget, and this strip sits directly above the tab bar, so the two
        // read as one group of chrome at one hairline weight.
        background: t.glass,
        ...elevation.flat,
        borderColor: t.glassBorder,
        borderRadius: r.card,
        padding: "12px 16px",
      }}
    >
      <UserAvatar avatarUrl={currentUser.avatarUrl} initials={currentUser.initials} />
      <button
        onClick={onComposeClick}
        className="flex-1 text-left"
        style={{
          // The body role, because this is where a reader's own prose will go
          // and the placeholder should be the size that prose will be. It was
          // 14px at weight 300, which the theme's weight floor forbids outright.
          ...bodyText,
          color: t.text2,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          transition: uiTransition(),
        }}
      >
        Share something…
      </button>
      <Button
        type="button"
        size="sm"
        onClick={onComposeClick}
        className="shrink-0"
      >
        <PlusCircle />
        New
      </Button>
    </div>
  );
}

/**
 * The open bounties, as a row of links above the feed.
 *
 * NO DASHED EDGE, AND THAT IS THE ONE DECISION HERE WORTH DEFENDING. The theme
 * gives a gap a 1.5px dashed `--cat-breakage` edge, and these tiles are not
 * gaps: they are LINKS to builds that have one. The dashed edge means "the thing
 * you are looking at has a hole in it", and spending it on a navigation tile
 * would teach a reader the wrong thing about the mark before they ever meet it
 * on a card. So a tile is an ordinary surface and the breakage hue appears only
 * on the reward, in `categoryFill`'s measured pair — which is also the only
 * ground that hue is legal as ink on.
 */
function ActiveCompetitionsStrip({
  bounties,
  onSeeAll,
  onBountyClick,
}: {
  bounties: BountyPreview[];
  onSeeAll?: () => void;
  onBountyClick?: (b: BountyPreview) => void;
}) {
  if (bounties.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: t.text2 }} />
          <span style={{ ...eyebrowText, color: t.text2 }}>Active competitions</span>
        </div>
        <button
          onClick={onSeeAll}
          style={{
            ...labelText,
            color: t.text2,
            background: "none",
            border: "none",
            cursor: "pointer",
            transition: uiTransition(),
          }}
        >
          See all →
        </button>
      </div>
      {/* `contain: inline-size` for the reason the tab row carries it: a
          horizontal scroller's width must not be computed from the tiles inside
          it, or eight 240px tiles push the frame's centre column past the left
          rail at 768. See the longer note on the tab row. */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        style={{ contain: "inline-size" }}
      >
        {bounties.map((bounty) => (
          <button
            key={bounty.id}
            onClick={() => onBountyClick?.(bounty)}
            className="shrink-0 text-left"
            style={{
              width: 240,
              padding: 14,
              borderRadius: r.control,
              background: t.glass,
              ...elevation.flat,
              cursor: "pointer",
              transition: uiTransition(),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ ...chipStyle("category", { category: "breakage" }), ...tabular, padding: "2px 8px" }}>
                {bounty.reward}
              </span>
              <span style={{ ...dataText, ...tabular, color: t.text2 }}>
                ends in {bounty.endsIn}
              </span>
            </div>
            <div
              style={{
                ...labelText,
                color: t.text,
                marginBottom: 8,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {bounty.title}
            </div>
            <div style={{ ...dataText, color: t.text2 }}>
              Submit a solution →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The six tabs.
 *
 * THIS IS BG-P07's TAB, NOT A SECOND ONE THAT LOOKS LIKE IT. The row spends
 * `tabTriggerStyle` and `TAB_TRIGGER_CLASS` — the same two the kit's
 * `ui/tabs.tsx` spends — so "what an active tab looks like" stays one decision.
 * The active tab is marked by an `--action` underline and a step up to full
 * `--text`, never by colouring the label `--action`: a coloured label says "this
 * is a link", and the underline says "you are here", which is the only thing a
 * tab row has to say. The list itself takes `--recess` at `--r-control` so the
 * six read as one grouped control cut into the page.
 *
 * THE UNDERLINE IS AN INSET BOX-SHADOW AND THERE IS NO SLIDING BAR. A
 * framer-motion spring used to animate the bar's `left` and `width`, which are
 * layout properties the theme forbids animating outright — every frame re-ran
 * layout on the sticky bar at the top of a page the reader is scrolling, and it
 * was the only reason Home's entry graph reached for framer-motion at all.
 * BG-P07's own answer is an inset shadow that occupies no space and needs no
 * measurement, which is what the kit's tabs already wear everywhere else.
 *
 * A KEYBOARD RING, FROM THE CLASS FORM. These triggers track no hover state of
 * their own — the class above carries the hover colour — so they take
 * `FOCUS_RING_CLASS` rather than growing a `useState` purely to draw an outline.
 *
 * IT SCROLLS WHEN IT HAS TO, AND THERE IS NO BREAKPOINT IN IT. Task 1 asks for a
 * row that scrolls below 768px; a media query would have been the wrong way to
 * get one, because the width the tabs actually have is the frame's centre
 * COLUMN and not the viewport — at 768 the two rails leave the column ~440px,
 * which is narrower than the 358px a 390px phone gives it is wide. So each tab
 * takes its own width (`flex-none`, never `flex: 1 1 0`, which lets a nowrap
 * label clip rather than open), the row is a scroller, and `justify-between`
 * spreads the six when they fit and lays them out from the left when they do
 * not. One rule, correct at every width the column can be, and it covers the
 * 768-to-1024 band a `md:` pair would have missed. `.scrollbar-hide` is the
 * utility `index.css` already carries for keeping the bar itself out of sight.
 *
 * The scroller is the one structural change in this file and it is what task 1
 * asks for; nothing else about the bar's box moves.
 */
function FeedTabBar({
  activeTab,
  onTabChange,
  liveActive,
}: {
  activeTab: FeedTabKey;
  onTabChange: (t: FeedTabKey) => void;
  liveActive: boolean;
}) {
  const still = prefersReducedMotion();

  return (
    <div
      className="sticky top-2 z-10 flex items-center w-full"
      style={{
        minWidth: 0,
        height: 44,
        // Opaque, because the bar is sticky and the feed scrolls under it.
        background: t.recess,
        ...elevation.flat,
        borderRadius: r.control,
      }}
    >
      <div
        className="relative flex h-full flex-1 min-w-0 items-center gap-1 justify-between overflow-x-auto scrollbar-hide"
        style={{
          padding: "0 12px",
          /* `min-width: 0` IS NOT ENOUGH, and the reason is worth writing down
             because it cost a measurement to find. It removes the flex item's
             automatic minimum, but the bar's own min-content is still computed
             from six nowrap labels — so at 768, where the frame gives the centre
             column 456px, the row pushed the column out to 580 and shoved the
             left rail off the screen. Nothing about the row's inline size
             depends on what is inside it: it is a horizontal scroller. Saying so
             is what lets the column shrink and the tabs scroll instead. */
          contain: "inline-size",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            data-testid={`feed-tab-${tab.key}`}
            // The kit's own attribute, because the kit's own class reads it.
            // Radix sets this on a real Tabs.Trigger; this row drives a URL
            // parameter rather than Radix state, so it sets it itself and the
            // paint is shared rather than reimplemented.
            data-state={activeTab === tab.key ? "active" : "inactive"}
            className={`flex-none ${TAB_TRIGGER_CLASS} ${FOCUS_RING_CLASS}`}
            style={{
              ...tabTriggerStyle(),
              ...TAB_LABEL_TYPE,
              textAlign: "center",
              whiteSpace: "nowrap",
              padding: "8px 12px",
              border: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {liveActive && (
        <div
          className="flex items-center gap-1.5"
          style={{ flex: "0 0 auto", paddingRight: 12, paddingLeft: 8 }}
        >
          {/* `--evidence` is the token for "it worked, it is live", and the lamp
              carries the signal rather than the word: amber is spoken for by the
              reproduction lamp, and neither accent is legal as 12px type. */}
          <span className="relative flex h-[6px] w-[6px]">
            {still ? null : (
              <span
                className="absolute inline-flex h-full w-full animate-ping"
                style={{ borderRadius: r.full, background: t.evidence, opacity: 0.75 }}
              />
            )}
            <span
              className="relative inline-flex h-[6px] w-[6px]"
              style={{ borderRadius: r.full, background: t.evidence }}
            />
          </span>
          <span style={{ ...eyebrowText, color: t.text2, whiteSpace: "nowrap" }}>Live</span>
        </div>
      )}
    </div>
  );
}

function NewPostsPill({
  hasNewPosts,
  newPostCount,
  onLoadNewPosts,
}: {
  hasNewPosts: boolean;
  newPostCount: number;
  onLoadNewPosts: () => void;
}) {
  if (!hasNewPosts || newPostCount === 0) return null;
  const display = newPostCount > 20 ? "20+" : String(newPostCount);
  const noun = newPostCount === 1 ? "new post" : "new posts";
  return (
    <button
      onClick={onLoadNewPosts}
      className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5"
      style={{
        top: 90,
        padding: "8px 16px",
        // `--r-control`, not 999px: the capsule rule was dropped, and a floating
        // control is still a control.
        borderRadius: r.control,
        background: t.action,
        color: t.onAction,
        border: "none",
        ...labelText,
        // The one raised surface in the feed, because it floats over the page
        // rather than sitting in it.
        ...elevation.raised,
        cursor: "pointer",
        transition: uiTransition(),
      }}
    >
      <ChevronUp className="h-3.5 w-3.5" />
      {display} {noun}
    </button>
  );
}

function FeedContentArea({
  activeTab,
  feedCards,
  isLoading,
  isEmpty,
  isError,
  errorMessage,
  onRetry,
  onEmptyCTAClick,
}: {
  activeTab: FeedTabKey;
  feedCards: React.ReactNode[];
  isLoading: boolean;
  isEmpty: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onEmptyCTAClick: () => void;
}) {
  // An error outranks both of the others: a tab whose queries failed is not
  // loading and is not empty, and saying either would be a claim nobody checked.
  if (isError) {
    return (
      <FeedErrorState activeTab={activeTab} message={errorMessage} onRetry={onRetry} />
    );
  }

  if (isLoading) return <FeedSkeleton />;

  if (isEmpty) {
    return (
      <FeedEmptyState activeTab={activeTab} onEmptyCTAClick={onEmptyCTAClick} />
    );
  }

  return (
    <div>
      {feedCards.map((card, i) => (
        <React.Fragment key={i}>
          {card}
          {(i + 1) % 5 === 0 && i < feedCards.length - 1 && (
            <div
              className="my-4"
              style={{
                // Dotted, still: a rhythm marker every fifth item, which has to
                // be distinguishable at a glance from the solid hairline every
                // card wears. Only the colour moved.
                borderTop: `1px dotted ${t.line}`,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The three states
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The legacy feed card's own measurements, which the skeleton reserves.
 *
 * Read off the cards rather than guessed, which is the only way a placeholder
 * can promise not to move the page when the data lands.
 */
const LEGACY_CARD = {
  /** `18px 20px` on every `content_items` card in the five older tabs. */
  padY: 18,
  padX: 20,
  /** The author row, which is an avatar's height and nothing more. */
  header: 34,
  /**
   * The cover, at the fixed height `feed-card.tsx` gives it — NOT an aspect
   * ratio. A build card reserves its picture from stored dimensions; a legacy
   * card crops every cover into a 160px letterbox, so 160 is what a reader
   * actually gets and an aspect ratio here would reserve twice the height and
   * then collapse.
   */
  cover: 160,
  /** The gap to the next item down. */
  gap: 12,
} as const;

/**
 * The three shimmering cards a tab shows while its first page is in flight.
 *
 * AT THE LEGACY CARD'S PROPORTIONS, NOT THE BUILD CARD'S, and which one is
 * right depends on which tab is loading. Five of the six render `content_items`
 * cards and this stands in for those: the same 18/20 padding, the same 34px
 * author row, a media block at the 3:2 their covers are capped to, and the same
 * stats hairline — so the swap when the data lands does not move the page. The
 * Builds tab does NOT use this. It shows `GalleryCardSkeleton` at the build
 * card's real proportions, from inside its own lazy chunk, because importing
 * the card's skeleton HERE would put the whole gallery card in Home's entry
 * bundle for the sake of a placeholder.
 *
 * EXPORTED because it is also Home's `Suspense` fallback while the Builds tab's
 * chunk is on the wire — the one moment when nothing yet knows which card is
 * coming, and where the generic shape is the honest one.
 *
 * The shimmer is BG-P07's `Skeleton`: `--recess` with a highlight swept over it
 * by the `bgShimmer` keyframe, reduced motion answered in the style object and
 * again in the stylesheet. This file no longer injects a keyframe of its own,
 * and the three `h-32` grey rectangles it used to draw — which were a card's
 * shape only by coincidence — are gone.
 */
export function FeedSkeleton() {
  return (
    <div data-visual-slot="feed-skeleton" data-testid="feed-skeleton" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: LEGACY_CARD.gap,
            padding: `${LEGACY_CARD.padY}px ${LEGACY_CARD.padX}px`,
            background: t.glass,
            ...elevation.flat,
            borderRadius: r.card,
          }}
        >
          {/* The author row: avatar, name, handle. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Skeleton
              style={{
                width: LEGACY_CARD.header,
                height: LEGACY_CARD.header,
                borderRadius: r.full,
                flexShrink: 0,
              }}
            />
            <Skeleton style={{ height: 13, width: 120, borderRadius: r.chip }} />
            <Skeleton style={{ height: 12, width: 64, borderRadius: r.chip }} />
          </div>
          {/* The type badge, then two lines of title. */}
          <Skeleton style={{ height: 18, width: 76, borderRadius: r.chip }} />
          <Skeleton style={{ height: 20, borderRadius: r.chip }} />
          <Skeleton style={{ height: 20, width: "58%", borderRadius: r.chip }} />
          {/* The cover, at the height the card crops one to. */}
          <Skeleton style={{ height: LEGACY_CARD.cover, borderRadius: r.media }} />
          {/* The stats row, under its hairline. */}
          <div
            style={{
              borderTop: `1px solid ${t.line}`,
              paddingTop: 14,
              display: "flex",
              gap: 16,
            }}
          >
            <Skeleton style={{ height: 14, width: 56, borderRadius: r.chip }} />
            <Skeleton style={{ height: 14, width: 56, borderRadius: r.chip }} />
            <Skeleton style={{ height: 14, width: 40, borderRadius: r.chip }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The frame the empty and the error state share: a quiet mark, a line of
 * display type, a sentence, and at most one control.
 *
 * ONE COMPONENT FOR BOTH, so the two cannot drift into two different ways of
 * saying "there is nothing to show here". They differ in their words and in
 * which control they offer, which is exactly as much as they should differ.
 */
function FeedNotice({
  icon: Icon,
  headline,
  body,
  testId,
  children,
}: {
  icon: React.ElementType;
  headline: string;
  body: React.ReactNode;
  testId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      data-visual-slot="feed-notice"
      data-testid={testId}
      style={{ marginTop: 48 }}
    >
      {/* `--recess` under a hairline, not an accent wash. An empty tab is an
          ordinary state, and a tinted disc around an icon reads as a warning
          about one. */}
      <div
        className="flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: r.full,
          background: t.recess,
          ...elevation.flat,
          marginBottom: 16,
        }}
      >
        <Icon style={{ width: 28, height: 28, color: t.text2 }} />
      </div>
      <div style={{ ...cardTitle, color: t.text, marginBottom: 8 }}>{headline}</div>
      <p
        style={{
          ...bodyText,
          color: t.text2,
          /* A measure, not a width: 44 characters is short enough that a
             two-sentence notice breaks where it reads best. */
          maxWidth: "44ch",
          marginBottom: children ? 20 : 0,
        }}
      >
        {body}
      </p>
      {children}
    </div>
  );
}

/**
 * What a tab says when it has nothing.
 *
 * Exported because the Builds tab draws its own — it is the thing that knows
 * when its own lazily loaded page has arrived — and two implementations of
 * "this tab is empty" would drift the first time either changed.
 */
export function FeedEmptyState({
  activeTab,
  onEmptyCTAClick,
}: {
  activeTab: FeedTabKey;
  onEmptyCTAClick: () => void;
}) {
  const e = EMPTY_STATES[activeTab];
  return (
    <FeedNotice icon={e.icon} headline={e.headline} body={e.body} testId="feed-empty">
      {e.cta ? (
        /* SECONDARY, NOT PRIMARY. The theme allows one primary action per view
           and the compose strip at the top of the feed is already spending it;
           an empty tab is a signpost, not a second call to action. It was an
           `--action`-tinted capsule with a hand-written `.feed-empty-cta` hover
           rule in an injected <style> — a class, which Tailwind's own output
           beats at build time, and which is the one styling mechanism
           `neoscale-ui` forbids outright. */
        <Button type="button" variant="secondary" onClick={onEmptyCTAClick}>
          {e.cta}
        </Button>
      ) : null}
    </FeedNotice>
  );
}

/**
 * What a tab says when its data failed.
 *
 * IT NAMES THE TAB AND REPEATS WHAT THE DATA LAYER SAID. "Something went wrong"
 * on its own leaves a reader unable to tell a dropped connection from a broken
 * deploy, and this application's one maintainer is not a developer — the
 * sentence they can paste into a bug report is most of the state's value. The
 * message is rendered in the data face, because it is a machine's words inside
 * a human sentence and should not be mistaken for the platform's own voice.
 *
 * THE RETRY RE-ASKS THE TAB'S QUERIES rather than reloading the page, so the
 * reader keeps their scroll position, their tab and everything else already
 * fetched. A tab whose caller offers no retry gets the sentence without the
 * button rather than a button that does nothing.
 */
export function FeedErrorState({
  activeTab,
  message,
  onRetry,
}: {
  activeTab: FeedTabKey;
  message?: string | null;
  onRetry?: () => void;
}) {
  const said = (message ?? "").trim();
  return (
    <FeedNotice
      icon={RotateCw}
      headline={`${TAB_LABEL[activeTab]} could not be loaded`}
      testId="feed-error"
      body={
        <>
          The request for this tab failed. Nothing is lost — the feed only reads,
          and a retry asks again.
          {said ? (
            <>
              {" "}
              <span style={{ ...dataText, color: t.text2 }}>{said}</span>
            </>
          ) : null}
        </>
      }
    >
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </FeedNotice>
  );
}

export function FeedShell({
  currentUser,
  activeTab,
  onTabChange,
  activeBounties,
  onBountySeeAll,
  onBountyClick,
  feedCards,
  isLoading,
  hasNewPosts,
  newPostCount,
  onLoadNewPosts,
  onComposeClick,
  isEmpty,
  onEmptyCTAClick,
  liveActive,
  isError,
  errorMessage,
  onRetry,
}: FeedShellProps) {
  return (
    <div
      className="w-full max-w-[600px] mx-auto flex flex-col gap-3"
      style={{
        /* THE PAGE PAINTS ITS OWN GROUND, and this is the third surface in the
           codebase to have to: the frame's centre column is transparent by
           design ("no page background — BlobBackground paints it") and
           BlobBackground is hard-coded to #25252F in BOTH themes. Every
           element in this feed that is not inside a card — a rebuild note, an
           empty state, a section label — is `--text` or `--text2` laid
           directly on the centre, which in Exhibition is dark ink in a dark
           room. `--bg` is the room this feed's tokens were measured against,
           so painting it here is what makes the pairings in the colour
           contract true rather than nominal. Gallery.tsx and /dev/wide do the
           same thing for the same reason and say so; the real fix is
           BlobBackground following the theme, which is nobody's prompt yet. */
        background: t.bg,
      }}
    >
      <NewPostsPill
        hasNewPosts={hasNewPosts}
        newPostCount={newPostCount}
        onLoadNewPosts={onLoadNewPosts}
      />
      {currentUser && (
        <ComposeStrip currentUser={currentUser} onComposeClick={onComposeClick} />
      )}
      <ActiveCompetitionsStrip
        bounties={activeBounties}
        onSeeAll={onBountySeeAll}
        onBountyClick={onBountyClick}
      />
      <FeedTabBar activeTab={activeTab} onTabChange={onTabChange} liveActive={liveActive} />
      <FeedContentArea
        activeTab={activeTab}
        feedCards={feedCards}
        isLoading={isLoading}
        isEmpty={isEmpty}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
        onEmptyCTAClick={onEmptyCTAClick}
      />
    </div>
  );
}

export default FeedShell;
