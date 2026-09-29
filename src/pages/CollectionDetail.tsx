// RC-P18 — a collection opens in the Library now.
//
// This page drew a collection's legacy posts, blueprints, stages and blocks,
// and it cannot draw a build: a collection's items are builds from RC-P18 and
// the legacy posts go with the clear. Its two addresses stay reachable and land
// on the same collection, open in the Library, as the gallery's cards:
//   /library/collections/:id          → /library?tab=collections&collection=:id
//   /library/:handle/collections/:id  → /library/:handle?collection=:id
// Rename, public or private, and delete moved with it (LibraryBuilds.tsx).

import { Navigate, useParams } from "react-router-dom";

export default function CollectionDetailRoute() {
  const { collectionId = "", handle } = useParams<{ collectionId: string; handle?: string }>();
  const id = encodeURIComponent(collectionId);
  const target = handle
    ? `/library/${encodeURIComponent(handle)}?collection=${id}`
    : `/library?tab=collections&collection=${id}`;
  return <Navigate to={target} replace />;
}
