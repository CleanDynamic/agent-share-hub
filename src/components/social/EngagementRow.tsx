// Like, Comment, Save and Share on a build (RC-P16).
//
// ONE ROW, THE SAME LOOK EVERYWHERE ⟦law-of-similarity⟧. A card carries Like,
// Comment and Save; a build page's header carries the same three and Share
// ⟦hicks-law › Budgets: 3 on a card, 4 beside the header's one primary⟧. The
// reproduction count is evidence, never an action, so it is not here: it is the
// plaque's, which outranks this row by design ⟦buildgallery-theme › Plaque⟧.
//
// QUIET BY CONSTRUCTION. Every action is tertiary (STATES.md row 3): no fill,
// no border, --text2 icon and count. Active — liked, saved — is the SAME icon
// filled with --action and its count in --text (row 8) ⟦better-ui › One SVG,
// recolored per state⟧, so the state is carried by shape and aria-pressed as
// well as colour ⟦color-system › Don't rely on color alone⟧. Nothing here is a
// filled button, so the header's one primary stays the only one
// ⟦von-restorff-effect⟧.
//
// THE NUMBERS. Icons are the site's own glyphs (heart, comment, save, share,
// rebuild) at 18px; Glyph draws them at stroke 1.3 with square caps, like every
// other glyph. Counts are DM Mono 12, tabular, for Like and Comment, and for
// Rebuild where it is shown. 4 between an icon
// and its count and 12 between pairs ⟦law-of-proximity: "Icon + label"⟧: each
// button pads its content by 6 on either side, so two neighbouring pairs are
// 6 + 6 apart. Each button is at least 36×36 by its own padding, and 44×44 on a
// phone ⟦responsive-design › Input Method Adaptation: Touch⟧ (UI-P59: 16, 8 and
// 44 everywhere before the density table); the first one is pulled
// back by its own padding so its icon lines up with the text above it.
//
// REBUILD. A caller that passes withRebuild gets a link to /rebuild/{slug} with
// the build's rebuild count, and the order becomes Comment, Rebuild, Like, Save,
// Share. No caller passes it yet; without it the row is as it was.
//
// MOTION. Colour only, 150ms, and none under reduced motion ⟦better-ui › Motion
// restraint⟧ ⟦buildgallery-theme › Motion⟧; every state has a static cue (fill,
// colour, ring). Hover is a colour step to --text on a fine pointer only; a
// press sinks to the well, never fades. Nothing is hover-only
// ⟦critique-affordance › Action Discoverability⟧: all the actions are visible
// at rest, on touch too.
//
// OPTIMISTIC, AND HONEST ABOUT IT. Like and Save change on the press and ask
// the database after; if it refuses, the row goes back to what it was and says
// so in the existing toast. A 401 — nobody signed in, or a session that ended —
// sends the reader to sign in and back ⟦neoscale-error-monitoring⟧. When the
// database agrees, updateEngagement writes the change into every cached list
// holding this build, so the gallery and the build page cannot disagree.
//
// INSIDE A CARD, THE ROW IS NOT THE CARD'S LINK. The card is one link to its
// build; a press on this row must not follow it, so the row stops the click
// from reaching the link and cancels the link's own navigation.

import { useEffect, useId, useState, type CSSProperties, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { updateEngagement } from "@/hooks/useEngagement";
import { LIBRARY_SAVED_KEY, requestAddToCollection } from "@/components/library/addToCollection";
import { copyToClipboard } from "@/lib/deepLink";
import { isPermissionError } from "@/lib/errors/permission";
import { SocialError, likeBuild, saveBuild, unlikeBuild, unsaveBuild, type EngagementCounts } from "@/lib/social";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback, scrollBehavior } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, tabular } from "@/lib/theme/type";

/** Where a shared link points. Canonical, whatever address the reader is on. */
export const SHARE_ORIGIN = "https://buildgallery.ai";

/** The glyph, at the size the row draws it everywhere. */
export const ENGAGEMENT_ICON_SIZE = 18;

/** The smallest a press target may be, in either direction: 44 drawn, 36 through the density table, 44 on a phone (the touch target). */
const hitOf = (phone: boolean) => (phone ? 44 : 36);

/** Padding plus border either side of a button's content: half of the 12 between pairs. */
const PAD_INLINE = 6;

/** The border a press shows. It is there at rest, clear, so a press moves nothing. */
const BORDER = 1;

/** Top and bottom padding plus border that makes an 18px icon a full target. */
const padBlockOf = (phone: boolean) => (hitOf(phone) - ENGAGEMENT_ICON_SIZE) / 2;

/** Between an icon and its count. */
const ICON_TO_COUNT = 4;

/**
 * RC-P18 — the Save toast's action as a text action (STATES.md row 3), not the
 * toaster's filled default: the toast is a note, and the page keeps its one
 * filled button ⟦von-restorff-effect⟧.
 */
const SAVED_TOAST_ACTION: CSSProperties = {
  background: "transparent",
  color: t.text2,
  border: "none",
  boxShadow: "none",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

export interface EngagementRowProps {
  build: { id: string; slug: string; title: string; rebuild_count?: number | null };
  /** Null until the list's counts have arrived. */
  counts: EngagementCounts | null;
  liked: boolean;
  saved: boolean;
  variant: "card" | "page";
  /** Add the Rebuild link, with the build's rebuild count. Absent: Like, Comment, Save, and Share on a page. */
  withRebuild?: boolean;
}

/** One build's share of its list's engagement: what a card or header passes on. */
export type RowEngagement = Pick<EngagementRowProps, "counts" | "liked" | "saved">;

type Pending = { liked?: boolean; saved?: boolean; likes?: number };

export function EngagementRow({ build, counts, liked, saved, variant, withRebuild = false }: EngagementRowProps) {
  const { isLoggedIn } = useAuth();
  const phone = useIsPhone();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  /**
   * What the row shows ahead of the database: set on a press, cleared when the
   * list's own answer changes (the cache now agrees) or the write fails (the
   * row falls back to what it was).
   */
  const [optimistic, setOptimistic] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<{ like?: boolean; save?: boolean }>({});
  const likes = counts?.likes ?? null;
  useEffect(() => setOptimistic(null), [liked, saved, likes]);

  const shownLiked = optimistic?.liked ?? liked;
  const shownSaved = optimistic?.saved ?? saved;
  const shownLikes = likes === null ? null : Math.max(0, likes + (optimistic?.likes ?? 0));

  const signIn = () => {
    const here = `${location.pathname}${location.search}${location.hash}`;
    navigate(`/login?redirect=${encodeURIComponent(here)}`);
  };

  /** A refused write: back to sign-in on a 401, otherwise say so. */
  const refused = (error: unknown) => {
    if (error instanceof SocialError && error.status === 401) {
      signIn();
      return;
    }
    toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
  };

  const toggleLike = async () => {
    if (!isLoggedIn) return signIn();
    if (busy.like) return;
    const next = !shownLiked;
    setBusy((current) => ({ ...current, like: true }));
    setOptimistic((current) => ({ ...current, liked: next, likes: (current?.likes ?? 0) + (next ? 1 : -1) }));
    try {
      await (next ? likeBuild(build.id) : unlikeBuild(build.id));
      updateEngagement(queryClient, build.id, { liked: next, likes: next ? 1 : -1 });
    } catch (error) {
      setOptimistic(null);
      refused(error);
    } finally {
      setBusy((current) => ({ ...current, like: false }));
    }
  };

  const toggleSave = async () => {
    if (!isLoggedIn) return signIn();
    if (busy.save) return;
    const next = !shownSaved;
    setBusy((current) => ({ ...current, save: true }));
    setOptimistic((current) => ({ ...current, saved: next }));
    try {
      await (next ? saveBuild(build.id) : unsaveBuild(build.id));
      updateEngagement(queryClient, build.id, { saved: next });
      void queryClient.invalidateQueries({ queryKey: [LIBRARY_SAVED_KEY] });
      // RC-P18: one text action, the next step a saver is most likely to take.
      if (next) {
        toast("Saved.", {
          action: { label: "Add to a collection", onClick: () => requestAddToCollection(build.id) },
          actionButtonStyle: SAVED_TOAST_ACTION,
        });
      }
    } catch (error) {
      setOptimistic(null);
      refused(error);
    } finally {
      setBusy((current) => ({ ...current, save: false }));
    }
  };

  const comment = () => {
    if (!isLoggedIn) return signIn();
    if (variant === "card") {
      navigate(`/b2/${build.slug}#comments`);
      return;
    }
    focusComments();
  };

  const share = async () => {
    const url = `${SHARE_ORIGIN}/b2/${build.slug}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: build.title, url });
        return;
      } catch (error) {
        // The reader closed the share sheet: nothing to say.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const copied = await copyToClipboard(url);
    toast(copied ? "Link copied" : "The link could not be copied.");
  };

  const like: ActionSpec = {
    id: "like",
    label: shownLiked ? "Unlike" : "Like",
    pressed: shownLiked,
    count: shownLikes,
    onPress: toggleLike,
    glyph: "heart",
  };
  const commentAction: ActionSpec = {
    id: "comment",
    label: "Comment",
    count: counts?.comments ?? null,
    onPress: comment,
    glyph: "comment",
  };
  const saveAction: ActionSpec = {
    id: "save",
    label: shownSaved ? "Unsave" : "Save",
    pressed: shownSaved,
    onPress: toggleSave,
    glyph: "save",
  };
  const shareAction: ActionSpec = { id: "share", label: "Share", onPress: share, glyph: "share" };
  const rebuilds = build.rebuild_count ?? 0;
  const rebuildAction: ActionSpec = {
    id: "rebuild",
    slot: "rebuild",
    label: `Rebuild, ${rebuilds} ${rebuilds === 1 ? "rebuild" : "rebuilds"}`,
    count: rebuilds,
    href: `/rebuild/${build.slug}`,
    glyph: "rebuild",
  };

  const page = variant === "page" ? [shareAction] : [];
  const actions: ActionSpec[] = withRebuild
    ? [commentAction, rebuildAction, like, saveAction, ...page]
    : [like, commentAction, saveAction, ...page];

  /** A press inside a card is the row's, not the card link's. */
  const keepOffTheCard =
    variant === "card"
      ? (event: MouseEvent<HTMLDivElement>) => {
          event.stopPropagation();
          event.preventDefault();
        }
      : undefined;

  return (
    <div
      data-testid="engagement-row"
      data-variant={variant}
      data-card-part={variant === "card" ? "engagement" : undefined}
      onClick={keepOffTheCard}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        // The first icon lines up with the text above it; its hit area reaches
        // into the padding instead.
        marginInlineStart: -PAD_INLINE,
        ...(variant === "card" ? { marginTop: 6 } : null),
      }}
    >
      {actions.map(({ id, ...action }) => (
        <Action key={id} phone={phone} {...action} />
      ))}
    </div>
  );
}

/**
 * The page's comment box: scrolled to and focused. The comments section
 * (RC-P17) carries id="comments"; its composer is the first text field in it,
 * or, signed out, its sign-in link.
 */
function focusComments() {
  const section = document.getElementById("comments");
  if (!section) return;
  if (typeof section.scrollIntoView === "function") {
    section.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }
  const target = section.querySelector<HTMLElement>("textarea, a[href], button");
  target?.focus({ preventScroll: true });
}

/** What one action is: a button with a press handler, or a link when it has an href. */
interface ActionSpec {
  /** Stable across states, so a toggle keeps its element (and its focus) when its label changes. */
  id: string;
  /** The `data-engagement-action` value. Absent: the label, lower case. */
  slot?: string;
  label: string;
  glyph: GlyphName;
  onPress?: () => void;
  /** Rebuild only: the action is a link, not a button. */
  href?: string;
  /** Like and Save only. Absent on the actions that are not toggles. */
  pressed?: boolean;
  /** Like, Comment and Rebuild only; null while the counts are on their way. */
  count?: number | null;
}

type ActionProps = Omit<ActionSpec, "id"> & { phone: boolean };

/** One tertiary action: the glyph, and its count where it has one. */
function Action({ label, slot, glyph, onPress, href, pressed, count, phone }: ActionProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement | HTMLAnchorElement>();
  const countId = useId();
  const active = pressed === true;
  const hasCount = count !== undefined;
  const name = slot ?? label.toLowerCase();

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: ICON_TO_COUNT,
    minWidth: hitOf(phone),
    minHeight: hitOf(phone),
    padding: `${padBlockOf(phone) - BORDER}px ${PAD_INLINE - BORDER}px`,
    margin: 0,
    boxSizing: "border-box",
    // A press sinks to the well; at rest the border is there but clear.
    background: state.pressed ? t.well : "transparent",
    border: `${BORDER}px solid ${state.pressed ? t.wellBorder : "transparent"}`,
    borderRadius: r.control,
    // The count's colour; the glyph takes its own below.
    color: active || state.hovered ? t.text : t.text2,
    cursor: "pointer",
    textDecoration: "none",
    transition: feedback("color", "background-color", "border-color"),
    ...ring(state.focusVisible),
  };

  const content = (
    <>
      {/* One glyph: outline at rest, the same shape filled when active. */}
      <span
        data-engagement-icon=""
        data-active={active ? "" : undefined}
        style={{
          display: "inline-flex",
          flexShrink: 0,
          color: active ? t.action : "currentColor",
          transition: feedback("color"),
        }}
      >
        <Glyph name={glyph} size={ENGAGEMENT_ICON_SIZE} fill={active ? "currentColor" : "none"} />
      </span>
      {hasCount ? (
        <span
          id={countId}
          style={{
            fontFamily: DM_MONO,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.3,
            ...tabular,
          }}
        >
          {count ?? ""}
        </span>
      ) : null}
    </>
  );

  if (href !== undefined) {
    return (
      <Link to={href} aria-label={label} data-engagement-action={name} {...handlers} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : active}
      aria-describedby={hasCount && count !== null ? countId : undefined}
      data-engagement-action={name}
      onClick={onPress}
      {...handlers}
      style={style}
    >
      {content}
    </button>
  );
}

export default EngagementRow;
