/* SV-04 P5: Library while its first list loads, in a small module of its own: the header with its two tabs, and the
   loading shape of each tab. LibraryBuilds and Library draw their loading states from these, and `LibraryLoadingView`
   is the whole page as it stands then, so the route table's Placeholder is the page's own loading state without the
   page's code (its cards, dialogs and collections) in the first download. */

import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { GalleryCardSkeleton } from "@/components/gallery/GalleryCardSkeleton";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";

export const LIBRARY_TABS = [
  { id: "saved", label: "Saved" },
  { id: "collections", label: "Collections" },
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number]["id"];

export const LIBRARY_COLUMNS = {
  xl: "repeat(2, minmax(0, 1fr))",
  lg: "repeat(2, minmax(0, 1fr))",
  md: "repeat(2, minmax(0, 1fr))",
  mobile: "minmax(0, 1fr)",
} as const;

/** Saved, loading: four card placeholders in the wall's columns. */
export function CardGridSkeleton() {
  const columns = LIBRARY_COLUMNS[useBreakpoint()];
  return (
    <div
      data-testid="library-loading"
      aria-hidden
      style={{ display: "grid", gridTemplateColumns: columns, gap: SPACE.sm }}
    >
      {[0, 1, 2, 3].map((index) => (
        <GalleryCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Collections, loading: three rows. */
export function CollectionsLoading() {
  return (
    <div data-testid="library-loading" aria-hidden style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ ...skeletonStyle(), height: 56 }} />
      ))}
    </div>
  );
}

/** The page's header and body column, around what the tab shows. */
export function LibraryShell({ tab, tabs, onBack, onTabChange, children }: { tab: LibraryTab; tabs: boolean; onBack: () => void; onTabChange: (tab: LibraryTab) => void; children: ReactNode }) {
  return (
    <>
      <ShellHeader
        onBack={onBack}
        tabs={tabs ? LIBRARY_TABS.map((item) => ({ id: item.id, label: item.label })) : undefined}
        activeTab={tab}
        onTabChange={(id) => onTabChange(id as LibraryTab)}
      />
      <div
        data-testid="library-page"
        data-tab={tab}
        style={{ padding: `0 20px ${SPACE.lg}px`, display: "flex", flexDirection: "column", gap: SPACE.sm }}
      >
        {children}
      </div>
    </>
  );
}

/** The reader's own Library before its list has arrived: the route table's Placeholder for /library. */
export function LibraryLoadingView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: LibraryTab = params.get("tab") === "collections" ? "collections" : "saved";
  return (
    <div data-testid="library-root">
      <LibraryShell
        tab={tab}
        tabs
        onBack={() => navigate(-1)}
        onTabChange={(next) => {
          const search = new URLSearchParams(params);
          if (next === "collections") search.set("tab", "collections");
          else search.delete("tab");
          search.delete("collection");
          setParams(search);
        }}
      >
        {tab === "saved" ? <CardGridSkeleton /> : <CollectionsLoading />}
      </LibraryShell>
    </div>
  );
}
