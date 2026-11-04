/* UX-05: the windows the OpenBuilds pages open from their buttons: Make a space and Settings (Part 3), and New post (Part 4).
   One host, opened lazily so a page's first download does not carry them. */

import { Suspense, lazy } from "react";

import type { NewPostDraft } from "./sendPost";

const SpaceWindow = lazy(() => import("./SpaceWindow"));
const NewPostWindow = lazy(() => import("./NewPostWindow"));

/** `draft` is the content of a New post window whose post was refused: opened again, it comes back as it was. */
export type PostingWindow = { kind: "post"; spaceSlug?: string; draft?: NewPostDraft } | { kind: "make-space" } | { kind: "settings"; slug: string };

export function PostingWindows({ window: win, onClose, onReopen }: { window: PostingWindow | null; onClose: () => void; onReopen: (win: PostingWindow) => void }) {
  if (!win) return null;
  return (
    <Suspense fallback={null}>
      {win.kind === "post" ? <NewPostWindow spaceSlug={win.spaceSlug} draft={win.draft} onClose={onClose} onReopen={(draft) => onReopen({ kind: "post", spaceSlug: win.spaceSlug, draft })} /> : null}
      {win.kind === "make-space" ? <SpaceWindow mode="make" onClose={onClose} /> : null}
      {win.kind === "settings" ? <SpaceWindow mode="settings" slug={win.slug} onClose={onClose} /> : null}
    </Suspense>
  );
}

export default PostingWindows;
