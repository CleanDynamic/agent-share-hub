/* UX-10: /profile/:handle, the profile as a feed. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The head across the page column, then the feed (about 620 wide) and the side column (280) beside it, separated by
   whitespace. On a phone the side column folds under the head as one collapsed About row, and the feed is full width. A private
   profile the reader does not follow is the head alone, with its sentence.

   This replaces UI-P34's banner, level ring, stat boxes, works tabs and activity grid (UX-10 Part 10). */

import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT } from "@/lib/copy/copy";
import type { ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { pageColumns } from "@/components/shell/pageGrid";
import { BETWEEN, useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ProfileFeed, type ProfileFeedProps } from "./ProfileFeed";
import { ProfileHead, type ProfileHeadProps } from "./ProfileHead";
import { ProfileSide, SIDE_WIDTH, type ProfileSideProps } from "./ProfileSide";
import { PAGE_TITLE } from "@/components/shell/PageHeader";
import { PlaceholderTitle } from "@/components/pagestate/PlaceholderTitle";

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
  const grid = useMinWidth(BETWEEN.stack);
  return (
    <div data-testid="profile-view" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0, paddingBottom: 48, fontFamily: FIGTREE }}>
      <ProfileHead {...head} />
      {feed || side ? (
        phone ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {side ? <ProfileSide {...side} /> : null}
            {feed ? <ProfileFeed {...feed} /> : null}
          </div>
        ) : grid ? (
          /* The page grid's main and side template (9 / 3), under the full-width head. */
          <div style={{ ...pageColumns("mainSide"), alignItems: "start", minWidth: 0 }}>
            <div style={{ maxWidth: FEED_COLUMN, minWidth: 0 }}>{feed ? <ProfileFeed {...feed} /> : null}</div>
            {side ? <ProfileSide {...side} /> : null}
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
    <>
    <PlaceholderTitle>Profile</PlaceholderTitle>
    <LoadingRegion what="Profile" announce style={{ display: "flex", flexDirection: "column", gap: 24, minHeight: "60vh" }}>
      <Skeleton height={300} radius={10} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: FEED_COLUMN }}>
        <Skeleton width={320} height={32} radius={6} />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height={160} radius={8} />
        ))}
      </div>
    </LoadingRegion>
    </>
  );
}

/**
 * G4, G7, G8, G27: the profile did not load, or nobody has this handle. Under the page's kind as its title ("Profile": the
 * person's name is what did not load), PageState says which. Someone else's missing row is not found, with Browse builds;
 * the reader's own missing row is a failed read (`read` is then a failed one), never "not found".
 */
export function ProfileViewState({ read, missing }: { read: ReadLike; missing: boolean }) {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ ...PAGE_TITLE, marginBottom: 16 }}>Profile</h1>
      <PageState read={read} thing="this profile" region="Profile" skeleton={null} notFound={missing ? { when: ([row]) => row === null, kind: "profile", way: WAY_OUT.browseBuilds } : undefined}>
        {() => null}
      </PageState>
    </div>
  );
}

export default ProfileView;
