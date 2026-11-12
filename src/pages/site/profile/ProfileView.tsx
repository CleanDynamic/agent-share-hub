/* UX-10: /profile/:handle, the profile as a feed. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The head across the page column, then the feed (about 620 wide) and the side column (280) beside it, separated by
   whitespace. On a phone the side column folds under the head as one collapsed About row, and the feed is full width. A private
   profile the reader does not follow is the head alone, with its sentence.

   This replaces UI-P34's banner, level ring, stat boxes, works tabs and activity grid (UX-10 Part 10). */

import type { ReactNode } from "react";

import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ProfileFeed, type ProfileFeedProps } from "./ProfileFeed";
import { ProfileHead, type ProfileHeadProps } from "./ProfileHead";
import { ProfileSide, SIDE_WIDTH, type ProfileSideProps } from "./ProfileSide";
import { PAGE_TITLE } from "@/components/shell/PageHeader";

/** The feed column's width. */
export const FEED_COLUMN = 620;
/** Between the feed and the side column (Visual grammar 7). */
export const COLUMN_GAP = 56;

export interface ProfileViewProps {
  head: ProfileHeadProps;
  /** Null for a private profile the reader does not follow. */
  feed: ProfileFeedProps | null;
  side: ProfileSideProps | null;
}

export function ProfileView({ head, feed, side }: ProfileViewProps) {
  const phone = useIsPhone();
  return (
    <div data-testid="profile-view" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0, paddingBottom: 48, fontFamily: FIGTREE }}>
      <ProfileHead {...head} />
      {feed || side ? (
        phone ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {side ? <ProfileSide {...side} /> : null}
            {feed ? <ProfileFeed {...feed} /> : null}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: COLUMN_GAP, minWidth: 0 }}>
            <div style={{ flex: `1 1 ${FEED_COLUMN}px`, maxWidth: FEED_COLUMN, minWidth: 0 }}>{feed ? <ProfileFeed {...feed} /> : null}</div>
            {side ? <ProfileSide {...side} /> : <div style={{ width: SIDE_WIDTH, flex: "none" }} />}
          </div>
        )
      ) : null}
    </div>
  );
}

/** The profile before it has arrived: the head's box and a few feed rows, at their sizes. */
export function ProfileViewSkeleton() {
  return (
    <LoadingRegion what="Profile" announce style={{ display: "flex", flexDirection: "column", gap: 24, minHeight: "60vh" }}>
      <Skeleton height={300} radius={10} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: FEED_COLUMN }}>
        <Skeleton width={320} height={32} radius={6} />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height={160} radius={8} />
        ))}
      </div>
    </LoadingRegion>
  );
}

/** The profile itself could not be read: one sentence and Retry. Not "Profile not found": that is for a handle nobody has. */
export function ProfileLoadFailed({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={VISUALLY_HIDDEN}>Profile</h1>
      <ErrorState panel="Profile" onRetry={onRetry} error={error} data-testid="profile-load-error" />
    </div>
  );
}

/** A sentence and a way on, for a profile that is not there. */
export function ProfileNotice({ line, detail, action }: { line: string; detail?: string; action?: ReactNode }) {
  return (
    <div data-testid="profile-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "32px 0", textAlign: "center" }}>
      <h1 style={PAGE_TITLE}>{line}</h1>
      {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{detail}</p> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export default ProfileView;
