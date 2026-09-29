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
// THE NUMBERS. Icons are lucide at 18px and stroke 1.5, the weight that sits
// beside 400-weight text ⟦better-ui › Match icon stroke to text weight⟧.
// Counts are DM Mono 12, tabular, for Like and Comment only. 4 between an icon
// and its count and 16 between pairs ⟦law-of-proximity: "Icon + label"⟧: each
// button pads its content by 8 on either side, so two neighbouring pairs are
// 8 + 8 apart. Each button is at least 44×44 by its own padding
// ⟦responsive-design › Input Method Adaptation: Touch⟧; the first one is pulled
// back by its own padding so its icon lines up with the text above it.
//
// MOTION. Colour and opacity only, 150ms, and none under reduced motion
// ⟦better-ui › Motion restraint⟧ ⟦buildgallery-theme › Motion⟧; every state has
// a static cue (fill, colour, ring). Hover is a colour step on a fine pointer
// only, and nothing is hover-only ⟦critique-affordance › Action
// Discoverability⟧: all the actions are visible at rest, on touch too.
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
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MessageCircle, Share2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { updateEngagement } from "@/hooks/useEngagement";
import { LIBRARY_SAVED_KEY, requestAddToCollection } from "@/components/library/addToCollection";
import { copyToClipboard } from "@/lib/deepLink";
import { isPermissionError } from "@/lib/errors/permission";
import { SocialError, likeBuild, saveBuild, unlikeBuild, unsaveBuild, type EngagementCounts } from "@/lib/social";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback, scrollBehavior } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, tabular } from "@/lib/theme/type";

/** Where a shared link points. Canonical, whatever address the reader is on. */
export const SHARE_ORIGIN = "https://buildgallery.ai";

/** The icon, at the size and weight the row draws everywhere. */
export const ENGAGEMENT_ICON_SIZE = 18;
export const ENGAGEMENT_ICON_STROKE = 1.5;

/** The smallest a press target may be, in either direction. */
const HIT = 44;

/** Padding either side of a button's content: half of the 16 between pairs. */
const PAD_INLINE = 8;

/** Top and bottom padding that makes an 18px icon a 44px target. */
const PAD_BLOCK = (HIT - ENGAGEMENT_ICON_SIZE) / 2;

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
  build: { id: string; slug: string; title: string };
  /** Null until the list's counts have arrived. */
  counts: EngagementCounts | null;
  liked: boolean;
  saved: boolean;
  variant: "card" | "page";
}

/** One build's share of its list's engagement: what a card or header passes on. */
export type RowEngagement = Pick<EngagementRowProps, "counts" | "liked" | "saved">;

type Pending = { liked?: boolean; saved?: boolean; likes?: number };

export function EngagementRow({ build, counts, liked, saved, variant }: EngagementRowProps) {
  const { isLoggedIn } = useAuth();
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
        ...(variant === "card" ? { marginTop: 8 } : null),
      }}
    >
      <Action
        label={shownLiked ? "Unlike" : "Like"}
        pressed={shownLiked}
        count={shownLikes}
        onPress={toggleLike}
        icon={Heart}
      />
      <Action
        label="Comment"
        count={counts?.comments ?? null}
        onPress={comment}
        icon={MessageCircle}
      />
      <Action
        label={shownSaved ? "Unsave" : "Save"}
        pressed={shownSaved}
        onPress={toggleSave}
        icon={Bookmark}
      />
      {variant === "page" ? (
        <Action
          label="Share"
          onPress={share}
          icon={Share2}
        />
      ) : null}
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

interface ActionProps {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Like and Save only. Absent on the actions that are not toggles. */
  pressed?: boolean;
  /** Like and Comment only; null while the counts are on their way. */
  count?: number | null;
}

/** One tertiary action: the icon, and its count where it has one. */
function Action({ label, icon: Icon, onPress, pressed, count }: ActionProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const countId = useId();
  const active = pressed === true;
  const hasCount = count !== undefined;

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: ICON_TO_COUNT,
    minWidth: HIT,
    minHeight: HIT,
    padding: `${PAD_BLOCK}px ${PAD_INLINE}px`,
    margin: 0,
    background: "transparent",
    border: "none",
    borderRadius: r.control,
    // The count's colour; the icon takes its own below.
    color: active || state.hovered ? t.text : t.text2,
    opacity: state.pressed ? 0.72 : 1,
    cursor: "pointer",
    transition: feedback("color", "opacity"),
    ...ring(state.focusVisible),
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : active}
      aria-describedby={hasCount && count !== null ? countId : undefined}
      data-engagement-action={label.toLowerCase()}
      onClick={onPress}
      {...handlers}
      style={style}
    >
      {/* One SVG: outline at rest, the same shape filled when active. */}
      <Icon
        aria-hidden
        data-engagement-icon=""
        data-active={active ? "" : undefined}
        size={ENGAGEMENT_ICON_SIZE}
        strokeWidth={ENGAGEMENT_ICON_STROKE}
        fill={active ? "currentColor" : "none"}
        style={{ flexShrink: 0, color: active ? t.action : "currentColor", transition: feedback("color") }}
      />
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
    </button>
  );
}

export default EngagementRow;
