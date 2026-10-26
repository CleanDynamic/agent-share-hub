// SV-03 P6: what a page shows in its slot while its code and its first reads are on the way.
//
// The existing skeleton blocks, at the size of the page's rows: nothing new to look at, and the slot is never empty. A page
// whose own loading shape is a component of its own (the composer, the profile) uses that one. SV-08 to SV-14 swap an entry's
// Placeholder in the route table when they redraw a page.

import type { CSSProperties } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BountiesLoadingView } from "@/pages/site/bounties/BountiesFrame";
import { LibraryLoadingView } from "@/components/library/libraryLoading";
import { BuildViewSkeleton } from "@/pages/site/build/BuildViewSkeleton";
import { ComposeSkeleton } from "@/pages/site/compose/ComposeSkeleton";
import { DraftsLoadingView } from "@/pages/site/drafts/DraftsFrame";
import { GalleryLoadingView } from "@/pages/site/gallery/galleryFrame";

const column: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, minHeight: "60vh", paddingTop: 24 };

function ListPlaceholder({ what, rows = 6, rowHeight = 52, title = true }: { what: string; rows?: number; rowHeight?: number; title?: boolean }) {
  return (
    <LoadingRegion what={what} announce style={column}>
      {title ? <Skeleton width={180} height={32} radius={6} /> : null}
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={rowHeight} radius={8} />
      ))}
    </LoadingRegion>
  );
}

export const HomePlaceholder = () => <ListPlaceholder what="Home" rowHeight={96} rows={4} />;
export const BuildsPlaceholder = GalleryLoadingView;
export const OpenBuildsPlaceholder = BountiesLoadingView;
export const LibraryPlaceholder = LibraryLoadingView;
// SV-04 P5: the page's own loading state, from its small frame module (no page code in the first download).
export const DraftsPlaceholder = DraftsLoadingView;
export const BuildPlaceholder = () => <BuildViewSkeleton />;
// The profile's own skeleton lives in the profile page's chunk; importing it here would put that page into the first download.
export const ProfilePlaceholder = () => <ListPlaceholder what="Profile" rowHeight={80} rows={4} />;
export const ComposerPlaceholder = () => <ComposeSkeleton />;
