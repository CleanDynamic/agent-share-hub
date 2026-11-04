/* UX-05: the two windows the OpenBuilds pages open from their buttons: New post (Part 4) and Make a space / Settings (Part 3).
   One host, opened lazily so a page's first download does not carry them. */

export type PostingWindow = { kind: "post"; spaceSlug?: string } | { kind: "make-space" } | { kind: "settings"; slug: string };

export function PostingWindows(_props: { window: PostingWindow | null; onClose: () => void }) {
  return null;
}

export default PostingWindows;
