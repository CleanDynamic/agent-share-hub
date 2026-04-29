import { useState } from "react";
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

interface ProfileHeaderProps {
  profile: ProfileSummary;
  isFollowing?: boolean;
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

function LevelBadge({ level }: { level: ProfileLevel }) {
  if (level === "reader") return null;
  const config: Record<Exclude<ProfileLevel, "reader">, { label: string; className: string }> = {
    builder: {
      label: "BUILDER",
      className: "bg-primary/10 text-primary/90",
    },
    creator: {
      label: "CREATOR",
      className: "bg-primary/15 text-primary",
    },
    curator: {
      label: "SAGE",
      className: "bg-accent/15 text-accent-foreground",
    },
  };
  const { label, className } = config[level];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider ${className}`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {label}
    </span>
  );
}

export function ProfileHeader({
  profile,
  isFollowing = false,
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

  const isOwnProfile = profile.isOwnProfile;
  const initials = (profile.displayName || "?").charAt(0).toUpperCase();

  const ghostBtn =
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-transparent text-foreground/85 hover:bg-white/5 transition-colors";

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
      {/* Cover Strip */}
      <div className="relative w-full h-44 sm:h-52 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-background to-accent/15 border border-white/5">
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
            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-md bg-black/40 text-white/85 hover:bg-black/60 backdrop-blur-sm border border-white/10"
          >
            <Camera size={14} />
          </button>
        )}
      </div>

      {/* Identity Row */}
      <div className="relative px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 -mt-12 sm:-mt-14">
          {/* Avatar + Name */}
          <div className="flex items-end gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-background bg-muted ring-1 ring-white/10">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-3xl font-semibold text-foreground/70 bg-gradient-to-br from-primary/30 to-accent/30"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={onAvatarEdit}
                  aria-label="Change avatar"
                  className="absolute bottom-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/55 text-white/90 hover:bg-black/75 border border-white/10 backdrop-blur-sm"
                >
                  <Camera size={12} />
                </button>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-xl sm:text-2xl font-semibold text-foreground truncate"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {profile.displayName}
                </h1>
                {profile.isVerified && (
                  <BadgeCheck size={18} className="text-primary shrink-0" aria-label="Verified" />
                )}
                <LevelBadge level={profile.level} />
              </div>
              <p
                className="text-sm text-muted-foreground"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                @{profile.handle}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-1 shrink-0">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={onEditProfile}
                  className={`${ghostBtn} px-3 py-1.5 text-xs font-medium`}
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={onShareProfile}
                  aria-label="Share profile"
                  className={`${ghostBtn} w-8 h-8`}
                >
                  <Share2 size={14} />
                </button>
              </>
            ) : (
              <>
                {isFollowing ? (
                  <button
                    type="button"
                    onClick={onUnfollow}
                    onMouseEnter={() => setFollowHover(true)}
                    onMouseLeave={() => setFollowHover(false)}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold transition-colors"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      background: followHover
                        ? "hsl(var(--destructive) / 0.15)"
                        : "hsl(var(--accent) / 0.10)",
                      color: followHover
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--accent-foreground))",
                    }}
                  >
                    {followHover ? "Unfollow" : "Following"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onFollow}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Follow
                  </button>
                )}
                <button
                  type="button"
                  onClick={onMessage}
                  className={`${ghostBtn} px-3 py-1.5 text-xs font-medium`}
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  <MessageCircle size={14} />
                  Message
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen(o => !o)}
                    aria-label="More options"
                    className={`${ghostBtn} w-8 h-8`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-md border border-white/10 bg-popover/95 backdrop-blur-md shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          onBlockUser?.();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground/75 hover:bg-white/5"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Block user
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onReportUser?.();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground/75 hover:bg-white/5"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Report user
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground/75 hover:bg-white/5"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        Copy profile link
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Derived Bio Row */}
        {(profile.derivedBio || profile.customBio) && (
          <div className="mt-4 space-y-2">
            {profile.derivedBio && (
              <div className="flex items-start gap-2 text-sm text-foreground/80">
                <Sparkles size={14} className="mt-0.5 text-primary shrink-0" />
                <span style={{ fontFamily: "Inter, sans-serif" }}>{profile.derivedBio}</span>
              </div>
            )}
            {profile.customBio && (
              <p
                className="text-sm text-foreground/85 whitespace-pre-wrap"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {profile.customBio}
              </p>
            )}
          </div>
        )}

        {/* Meta Row */}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
          style={{ fontFamily: "Inter, sans-serif" }}
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
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Link2 size={12} />
                {profile.website.split("https://").join("").split("http://").join("")}
              </a>
            </>
          )}
        </div>

        {/* Stats Strip */}
        <div
          className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-x-5 gap-y-2"
          style={{ fontFamily: "Inter, sans-serif" }}
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
            <button
              key={key}
              type="button"
              onClick={() => onStatClick?.(key)}
              title={hasViewList ? `View ${label} list` : undefined}
              className="group inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <span className="text-sm font-semibold text-foreground">
                {formatCount(value)}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {hasViewList && (
                <span
                  aria-hidden
                  className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  View list →
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
