/* UX-10: /profile/:handle, the profile as a feed. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   Synth 12 Part A: the head is a panel across the whole 1280 container; under it two panels, the feed (`minmax(0, 1fr)`)
   and the side (340 from 1101, 300 from 761 to 1100). At 760 and below the side's sections follow the feed in one column.
   A private profile the reader does not follow is the head alone, with its sentence. */

import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT } from "@/lib/copy/copy";
import type { ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { PANEL_GAP, panelColumns } from "@/components/shell/pageGrid";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ProfileFeed, type ProfileFeedProps } from "./ProfileFeed";
import { ProfileHead, type ProfileHeadProps } from "./ProfileHead";
import { ProfileSide, type ProfileSideProps } from "./ProfileSide";
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

/** The two panels show from 761; the side is 340 from 1101. */
const TWO_PANELS_MIN = 761;
const WIDE_SIDE_MIN = 1101;

export function ProfileView({ head, feed, side }: ProfileViewProps) {
  useColumnPanels(true);
  const two = useMinWidth(TWO_PANELS_MIN);
  const wide = useMinWidth(WIDE_SIDE_MIN);
  const feedPanel = feed ? (
    <div style={{ background: t.surface, borderRadius: 12, padding: 16, minWidth: 0, boxSizing: "border-box" }}>
      <ProfileFeed {...feed} />
    </div>
  ) : null;
  return (
    <div data-testid="profile-view" style={{ display: "flex", flexDirection: "column", gap: PANEL_GAP, minWidth: 0, paddingBottom: 48, fontFamily: FIGTREE }}>
      <ProfileHead {...head} />
      {feed || side ? (
        two ? (
          <div style={{ ...panelColumns("two", { between: !wide }), minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>{feedPanel}</div>
            {side ? <ProfileSide {...side} /> : <div />}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: PANEL_GAP, minWidth: 0 }}>
            {feedPanel}
            {side ? <ProfileSide {...side} /> : null}
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
      <Skeleton height={300} radius={12} />
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
