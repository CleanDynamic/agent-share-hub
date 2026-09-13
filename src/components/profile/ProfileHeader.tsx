// The profile header — repainted for BG-P25.
//
// WHAT THIS HEADER IS FOR, and why it is ordered the way it is. A profile's
// entry point is the WORK, not the bio (`visual-hierarchy`): a reader arrives
// here to decide whether this creator's builds are worth their evening, and the
// header's job is to answer that in one glance and then get out of the way. So
// the weight goes, in order, to the avatar and name, to the two earned numbers,
// and to the one primary action — and the bio, the meta row and the five
// vanity counts are all `--text2` connective tissue beneath them. Nothing here
// competes with the grid below it.
//
// THE EARNED NUMBERS ARE THE PLAQUE, SPENT AGAIN. They sit directly under the
// name for the same reason a card's plaque sits directly under its title: the
// claim belongs to the thing it is about, and a trust signal in a footer is a
// trust signal nobody reads. See `EarnedNumbers.tsx` for why they wear the
// plaque's exact treatment rather than an approximation of it.
//
// WHAT MOVED AND WHAT DID NOT. Every colour in this file was a Tailwind
// semantic (`text-foreground`, `bg-primary`, `border-white/10`) or a raw
// `hsl(var(--accent))` — two palettes, neither of which reads
// `<html data-theme>`, and the white-alpha borders only ever resolved against a
// dark ground. They are now `var(--token)` references applied inline, which is
// how styling is delivered in this codebase: Tailwind's generated utilities
// beat hand-written classes at build time, and an inline style beats both. The
// LAYOUT classes are untouched — every `flex`, `gap`, `px`, `mt` and `w-` on
// this page is exactly what it was, because changing one is what breaks the
// three-panel frame.
//
// THE LEVEL BADGE IS THE THEME'S RARITY LADDER, NOT A THIRD PALETTE. Three
// steps, by weight and fill rather than by hue: builder is an outline, creator
// is a `--recess` fill, and curator — the top step — is the only one that takes
// `--lit`, with `--on-lit` on it. Amber is light here and never type, which is
// the rule the colour contract states twice.

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  BadgeCheck,
  Calendar,
  Camera,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Sparkles,
} from "lucide-react";
import type { ProfileLevel, ProfileSummary } from "@/lib/profile/types";
import LevelRing from "@/components/profile-game/LevelRing";
import CreatorMarkChip, { type CreatorMark } from "@/components/profile-game/CreatorMarkChip";
import { EarnedNumbers } from "@/components/profile/EarnedNumbers";
import { categoryFill } from "@/lib/theme/category";
import { buttonStyle, chipType, GLASS_BLUR, menuItemStyle, menuPanelStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, measure, tabular, type } from "@/lib/theme/type";

interface ProfileHeaderProps {
  profile: ProfileSummary;
  isFollowing?: boolean;
  isTrustedSolver?: boolean;
  /** When true, the avatar + name + handle + verified + level chip row is omitted. */
  hideIdentity?: boolean;
  /** Optional gamification — wraps avatar in an XP progress ring. */
  level?: number;
  progressPct?: number;
  /** Optional creator-mark chips rendered under the handle row. */
  creatorMarks?: CreatorMark[];
  /** Optional accessory (e.g. FounderMark) rendered inline with the marks row. */
  founderAccessory?: ReactNode;
  /**
   * The two earned numbers, summed across this creator's builds. Absent means
   * the caller does not have them yet — the row renders in its counting state
   * rather than asserting a zero it has not measured.
   */
  reproductionsReceived?: number;
  rebuildsReceived?: number;
  earnedLoading?: boolean;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  onBlockUser?: () => void;
  onReportUser?: () => void;
  onStatClick?: (
    stat: "followers" | "following" | "blueprints" | "blogs" | "bounties"
  ) => void;
  onAvatarEdit?: () => void;
  onCoverEdit?: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).split(".0").join("") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).split(".0").join("") + "K";
  return n.toLocaleString();
}

/**
 * The rarity ladder, three steps, by weight and fill. See the file header.
 *
 * `reader` renders nothing, as it always has: a level everybody starts at is
 * not an achievement and a chip saying so is noise on every profile.
 */
function LevelBadge({ level }: { level: ProfileLevel }) {
  if (level === "reader") return null;
  const config: Record<Exclude<ProfileLevel, "reader">, { label: string; paint: CSSProperties }> = {
    builder: {
      label: "BUILDER",
      /* Common: an outline. No fill at all, so the step up to one means
         something when it arrives. */
      paint: { background: "transparent", color: t.text2, border: `1px solid ${t.line}` },
    },
    creator: {
      label: "CREATOR",
      /* Rare: the recess fill. */
      paint: { background: t.recess, color: t.text, border: `1px solid ${t.line}` },
    },
    curator: {
      label: "SAGE",
      /* Highest: the only amber on the header, and it is a FILL with the
         measured label on it — never amber type. */
      paint: { background: t.lit, color: t.onLit, border: "1px solid transparent" },
    },
  };
  const { label, paint } = config[level];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider"
      style={{ ...chipType, borderRadius: r.chip, ...paint }}
    >
      {label}
    </span>
  );
}

/** The secondary control treatment, shared by Edit / Share / Message / more. */
function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { state, handlers } = useInteractive<HTMLButtonElement>(rest as never);
  return (
    <button
      type="button"
      {...rest}
      {...handlers}
      className={`inline-flex items-center justify-center gap-1.5 ${className ?? ""}`}
      style={{ ...body, fontSize: 12, ...buttonStyle("secondary", state) }}
    >
      {children}
    </button>
  );
}

export function ProfileHeader({
  profile,
  isFollowing = false,
  isTrustedSolver = false,
  hideIdentity = false,
  level,
  progressPct,
  creatorMarks,
  founderAccessory,
  reproductionsReceived,
  rebuildsReceived,
  earnedLoading = false,
  onEditProfile,
  onShareProfile,
  onFollow,
  onUnfollow,
  onMessage,
  onBlockUser,
  onReportUser,
  onStatClick,
  onAvatarEdit,
  onCoverEdit,
}: ProfileHeaderProps) {
  const [followHover, setFollowHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showRing = typeof level === "number";
  const hasMarksRow = (creatorMarks && creatorMarks.length > 0) || !!founderAccessory;

  const isOwnProfile = profile.isOwnProfile;
  const initials = (profile.displayName || "?").charAt(0).toUpperCase();

  const follow = useInteractive<HTMLButtonElement>();
  const evidence = categoryFill("evidence");

  const joinedLabel = (() => {
    try {
      const d = new Date(profile.joinedAt);
      return d.toLocaleString("en-US", { month: "long", year: "numeric" });
    } catch {
      return profile.joinedAt;
    }
  })();

  return (
    <header className="w-full">
      {/* Cover Strip — a media well, at the media radius. It was a three-stop
          Tailwind gradient off `primary`/`accent`, which is decoration this
          system does not have; `--porthole` is the token for a well with
          nothing in it, and it reads as a deliberate empty frame in both rooms
          rather than as a failed image. */}
      <div
        className="relative w-full h-44 sm:h-52 overflow-hidden"
        style={{
          background: t.porthole,
          border: `1px solid ${t.line}`,
          borderRadius: r.media,
        }}
      >
        {profile.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        {isOwnProfile && (
          <button
            type="button"
            onClick={onCoverEdit}
            aria-label="Change cover"
            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8"
            style={{
              background: t.glass,
              backdropFilter: GLASS_BLUR,
              WebkitBackdropFilter: GLASS_BLUR,
              color: t.text,
              border: `1px solid ${t.glassBorder}`,
              borderRadius: r.control,
              cursor: "pointer",
            }}
          >
            <Camera size={14} />
          </button>
        )}
      </div>

      {/* Identity Row */}
      <div className="relative px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 -mt-12 sm:-mt-14">
          {/* Avatar + Name */}
          {!hideIdentity && (
            <div className="flex items-end gap-4 min-w-0">
              <div className="relative shrink-0">
                {showRing ? (
                  <LevelRing level={level!} progressPct={progressPct ?? 0} size={104}>
                    <AvatarInner profile={profile} initials={initials} />
                  </LevelRing>
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 overflow-hidden"
                    style={{
                      /* `--r-full` is for circular things only, and an avatar
                         is the example the scale names. */
                      borderRadius: r.full,
                      background: t.recess,
                      /* The ring that lifts the avatar off the cover. It was
                         `border-4 border-background` plus a white ring; one
                         token-coloured ring does the same job in both rooms. */
                      boxShadow: `0 0 0 4px ${t.bg}, 0 0 0 5px ${t.line}`,
                    }}
                  >
                    <AvatarInner profile={profile} initials={initials} />
                  </div>
                )}
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={onAvatarEdit}
                    aria-label="Change avatar"
                    className="absolute bottom-1 right-1 inline-flex items-center justify-center w-7 h-7"
                    style={{
                      background: t.glass,
                      backdropFilter: GLASS_BLUR,
                      WebkitBackdropFilter: GLASS_BLUR,
                      color: t.text,
                      border: `1px solid ${t.glassBorder}`,
                      borderRadius: r.full,
                      cursor: "pointer",
                    }}
                  >
                    <Camera size={12} />
                  </button>
                )}
              </div>

              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1
                    className="truncate"
                    style={{ ...type.cardTitle, color: t.text, margin: 0 }}
                  >
                    {profile.displayName}
                  </h1>
                  {profile.isVerified && (
                    <BadgeCheck
                      size={18}
                      className="shrink-0"
                      /* Verification is somebody else vouching for an identity,
                         which is what `--evidence` names. It was `--primary`,
                         where it read as an action. */
                      style={{ color: t.evidence }}
                      aria-label="Verified"
                    />
                  )}
                  <LevelBadge level={profile.level} />
                  {isTrustedSolver && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider"
                      style={{
                        ...chipType,
                        borderRadius: r.chip,
                        /* The measured evidence pair: fill with `--text` on it.
                           "Trusted" is a claim other people made. */
                        backgroundColor: evidence.background,
                        color: t.text,
                      }}
                      title="Accepted ≥5 bounty solutions with ≥60% acceptance rate"
                    >
                      <BadgeCheck size={10} />
                      TRUSTED SOLVER
                    </span>
                  )}
                </div>
                <p style={{ ...dataText, color: t.text2, margin: 0 }}>
                  @{profile.handle}
                </p>

                {/* THE TWO EARNED NUMBERS. Directly under the name, above
                    everything else the header says, because they are the only
                    two facts here the creator could not have written about
                    themselves. */}
                <EarnedNumbers
                  reproductions={reproductionsReceived ?? 0}
                  rebuilds={rebuildsReceived ?? 0}
                  loading={earnedLoading}
                  style={{ marginTop: 8 }}
                />

                {hasMarksRow && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {creatorMarks?.map((mark) => (
                      <CreatorMarkChip key={mark.id} mark={mark} />
                    ))}
                    {founderAccessory}
                  </div>
                )}
              </div>

            </div>
          )}
          {hideIdentity && <div className="min-w-0" />}

          {/* Action Buttons. ONE PRIMARY PER VIEW: on somebody else's profile
              that is Follow, and on your own it is nothing — Edit and Share are
              both secondary, because the primary action on your own wall is to
              publish, and that button belongs to the frame. */}
          <div className="flex items-center gap-2 pb-1 shrink-0 flex-wrap">
            {isOwnProfile ? (
              <>
                <GhostButton onClick={onEditProfile} className="px-3 py-1.5">
                  Edit profile
                </GhostButton>
                <GhostButton
                  onClick={onShareProfile}
                  aria-label="Share profile"
                  className="w-8 h-8"
                >
                  <Share2 size={14} />
                </GhostButton>
              </>
            ) : (
              <>
                {isFollowing ? (
                  <button
                    type="button"
                    onClick={onUnfollow}
                    onMouseEnter={() => setFollowHover(true)}
                    onMouseLeave={() => setFollowHover(false)}
                    className="px-4 py-1.5"
                    style={{
                      ...body,
                      fontSize: 12,
                      fontWeight: 600,
                      /* Already following is a SECONDARY state — the work is
                         done, and a filled button would keep asking for a click
                         that has already happened. Hover reveals what pressing
                         it would do, in breakage red, and says so in words. */
                      ...buttonStyle("secondary", { hovered: followHover }),
                      ...(followHover
                        ? { color: t.catBreakage, borderColor: t.catBreakage }
                        : {}),
                    }}
                  >
                    {followHover ? "Unfollow" : "Following"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onFollow}
                    {...follow.handlers}
                    className="px-4 py-1.5"
                    style={{
                      ...body,
                      fontSize: 12,
                      fontWeight: 600,
                      /* BG-P07's primary, unmodified: `--action` fill with
                         `--on-action` on it, `--r-control`, the kit's hover
                         and the kit's focus ring. */
                      ...buttonStyle("default", follow.state),
                    }}
                  >
                    Follow
                  </button>
                )}
                <GhostButton onClick={onMessage} className="px-3 py-1.5">
                  <MessageCircle size={14} />
                  Message
                </GhostButton>
                <div className="relative">
                  <GhostButton
                    onClick={() => setMenuOpen(o => !o)}
                    aria-label="More options"
                    className="w-8 h-8"
                  >
                    <MoreHorizontal size={14} />
                  </GhostButton>
                  {menuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 z-20 min-w-[160px] overflow-hidden"
                      style={menuPanelStyle}
                    >
                      {[
                        { label: "Block user", run: () => onBlockUser?.() },
                        { label: "Report user", run: () => onReportUser?.() },
                        {
                          label: "Copy profile link",
                          run: () => navigator.clipboard.writeText(window.location.href),
                        },
                      ].map((option) => (
                        <MenuRow
                          key={option.label}
                          label={option.label}
                          onSelect={() => {
                            option.run();
                            setMenuOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Derived Bio Row. Capped at 68 characters of measure — the theme's
            reading limit, and the reason a bio on a 1400px profile does not run
            the full width of the column. */}
        {(profile.derivedBio || profile.customBio) && (
          <div className="mt-4 space-y-2" style={measure}>
            {profile.derivedBio && (
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: t.text2 }} />
                <span style={{ ...body, fontSize: 14, color: t.text2, textWrap: "pretty" }}>
                  {profile.derivedBio}
                </span>
              </div>
            )}
            {profile.customBio && (
              <p
                className="whitespace-pre-wrap"
                style={{ ...body, fontSize: 14, color: t.text, textWrap: "pretty", margin: 0 }}
              >
                {profile.customBio}
              </p>
            )}
          </div>
        )}

        {/* Meta Row */}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{ ...dataText, color: t.text2 }}
        >
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            Joined {joinedLabel}
          </span>
          {profile.location && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {profile.location}
              </span>
            </>
          )}
          {profile.website && (
            <>
              <span aria-hidden>·</span>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
                /* Underlined at rest, not only on hover: a link told apart from
                   its neighbours by colour alone fails WCAG 1.4.1, and a touch
                   reader never gets the hover. */
                style={{
                  color: t.action,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                <Link2 size={12} />
                {profile.website.split("https://").join("").split("http://").join("")}
              </a>
            </>
          )}
        </div>

        {/* Stats Strip. These are counts, not claims — they sit below the
            hairline in `--text2`, well under the two earned numbers above, and
            the figures take tabular digits so five buttons in a row do not
            jitter as they load. */}
        <div
          className="mt-4 pt-4 flex flex-wrap items-center gap-x-5 gap-y-2"
          style={{ borderTop: `1px solid ${t.line}` }}
        >
          {(
            [
              ["followers", profile.counts.followers, "followers", true],
              ["following", profile.counts.following, "following", true],
              ["blueprints", profile.counts.blueprints, "blueprints", false],
              ["blogs", profile.counts.blogs, "blogs", false],
              ["bounties", profile.counts.bounties, "bounties", false],
            ] as const
          ).map(([key, value, label, hasViewList]) => (
            <StatButton
              key={key}
              value={formatCount(value)}
              label={label}
              hasViewList={hasViewList}
              onSelect={() => onStatClick?.(key)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

/** One row of the overflow menu, on the kit's own menu-item treatment. */
function MenuRow({ label, onSelect }: { label: string; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onSelect}
      {...handlers}
      className="w-full text-left px-3 py-2"
      style={{ ...body, fontSize: 13, ...menuItemStyle(state) }}
    >
      {label}
    </button>
  );
}

/** One count in the stats strip. */
function StatButton({
  value,
  label,
  hasViewList,
  onSelect,
}: {
  value: string;
  label: string;
  hasViewList: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={hasViewList ? `View ${label} list` : undefined}
      className="inline-flex items-center gap-1.5"
      style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
    >
      <span style={{ ...dataText, ...tabular, color: t.text, fontWeight: 500 }}>{value}</span>
      <span style={{ ...dataText, color: t.text2 }}>{label}</span>
      {hasViewList && (
        <span
          aria-hidden
          style={{
            ...chipType,
            color: t.action,
            opacity: hovered ? 1 : 0,
            transition: "opacity 160ms cubic-bezier(.2,.6,.35,1)",
          }}
        >
          View list →
        </span>
      )}
    </button>
  );
}

function AvatarInner({
  profile,
  initials,
}: {
  profile: ProfileSummary;
  initials: string;
}) {
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt={profile.displayName}
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      /* An initial on a `--recess` ground, not a two-stop gradient. The display
         face is legal here because `sectionHead` is well above the 20px floor. */
      style={{ ...type.sectionHead, background: t.recess, color: t.text2 }}
    >
      {initials}
    </div>
  );
}
