/* UX-05: the windows the OpenBuilds pages open from their buttons: Make a space and Settings (Part 3), and New post (Part 4).
   One host, opened lazily so a page's first download does not carry them. */

import { Suspense, lazy } from "react";

const SpaceWindow = lazy(() => import("./SpaceWindow"));

export type PostingWindow = { kind: "post"; spaceSlug?: string } | { kind: "make-space" } | { kind: "settings"; slug: string };

export function PostingWindows({ window: win, onClose }: { window: PostingWindow | null; onClose: () => void }) {
  if (!win) return null;
  return (
    <Suspense fallback={null}>
      {win.kind === "make-space" ? <SpaceWindow mode="make" onClose={onClose} /> : null}
      {win.kind === "settings" ? <SpaceWindow mode="settings" slug={win.slug} onClose={onClose} /> : null}
    </Suspense>
  );
}

export default PostingWindows;
