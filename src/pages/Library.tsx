// The Library (RC-P18): what the reader keeps.
//
// EXACTLY TWO TABS ⟦hicks-law › Budgets⟧, in the order a reader reaches for
// them: "Saved", the builds they saved, newest first; and "Collections", the
// groups they made, the one used last first. Opening a collection lists its
// builds, as the gallery's own cards ⟦law-of-similarity⟧. The tab and the open
// collection live in the address (?tab=collections&collection=<id>), so Back
// and a shared link land where the reader was.
//
// NOTHING LEGACY IS READ. Saved is build_saves and a collection's items are
// builds; user_saves, curator picks and learning paths are not asked for. The
// legacy default collection ("Saved items") is left out: Saved is its
// replacement.
//
// Another reader's library (/library/:handle) is their public collections
// only: their saves are theirs alone (build_saves has no reader but its
// owner), so a visitor sees no tabs.

import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SeoHead } from "@/components/SeoHead";
import { ShellHeader } from "@/components/shell/ShellHeader";
import {
  CollectionView,
  CollectionsTab,
  LibraryEyebrow,
  SavedTab,
} from "@/components/library/LibraryBuilds";
import { useAuth } from "@/contexts/AuthContext";
import { getLibraryOwner } from "@/lib/library";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

export const LIBRARY_TABS = [
  { id: "saved", label: "Saved" },
  { id: "collections", label: "Collections" },
] as const;

type LibraryTab = (typeof LIBRARY_TABS)[number]["id"];

export default function LibraryPage() {
  const navigate = useNavigate();
  const { handle } = useParams<{ handle?: string }>();
  const [params, setParams] = useSearchParams();
  const { user, profile } = useAuth();

  const ownHandle = (profile as { username?: string | null } | null)?.username ?? null;
  const visiting = Boolean(handle) && handle !== ownHandle;

  const owner = useQuery({
    queryKey: ["library-owner", handle],
    queryFn: () => getLibraryOwner(handle as string),
    enabled: visiting,
    refetchOnWindowFocus: false,
  });

  const tab: LibraryTab = visiting || params.get("tab") === "collections" ? "collections" : "saved";
  const openId = params.get("collection");

  const go = (next: { tab?: LibraryTab; collection?: string | null }) => {
    const search = new URLSearchParams(params);
    if (next.tab !== undefined) {
      if (next.tab === "collections") search.set("tab", "collections");
      else search.delete("tab");
      search.delete("collection");
    }
    if (next.collection !== undefined) {
      if (next.collection) search.set("collection", next.collection);
      else search.delete("collection");
    }
    setParams(search);
  };

  const ownerName = owner.data?.displayName?.trim() || (owner.data?.username ? `@${owner.data.username}` : handle ?? "");

  return (
    <>
      <SeoHead
        title={visiting ? `${ownerName}'s collections — buildgallery` : "Library — buildgallery"}
        description="Builds kept for later, and the collections they are kept in."
        path={visiting ? `/library/${handle}` : "/library"}
        noIndex
      />
      <ShellHeader
        onBack={() => navigate(-1)}
        tabs={visiting ? undefined : LIBRARY_TABS.map((item) => ({ id: item.id, label: item.label }))}
        activeTab={tab}
        onTabChange={(id) => go({ tab: id as LibraryTab })}
      />
      <div
        data-testid="library-page"
        data-tab={tab}
        style={{ padding: `0 20px ${SPACE.lg}px`, display: "flex", flexDirection: "column", gap: SPACE.sm }}
      >
        {visiting ? (
          owner.isLoading ? null : owner.data ? (
            openId ? (
              <CollectionView collectionId={openId} viewerId={user?.id ?? null} onBack={() => go({ collection: null })} />
            ) : (
              <>
                <LibraryEyebrow>{ownerName}'s collections</LibraryEyebrow>
                <CollectionsTab ownerId={owner.data.id} canEdit={false} onOpen={(id) => go({ collection: id })} />
              </>
            )
          ) : (
            <p style={{ ...body, color: t.text2, margin: 0 }}>Nobody here goes by that name.</p>
          )
        ) : tab === "saved" ? (
          <SavedTab />
        ) : openId ? (
          <CollectionView collectionId={openId} viewerId={user?.id ?? null} onBack={() => go({ collection: null })} />
        ) : (
          <CollectionsTab canEdit onOpen={(id) => go({ collection: id })} />
        )}
      </div>
    </>
  );
}
