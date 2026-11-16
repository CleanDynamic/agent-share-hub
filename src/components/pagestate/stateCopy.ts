// The words every page uses for its states: failed, retrying, empty, not found, signed out.
//
// One module, so no page writes its own "didn't load" or "Retry" (G30's guard checks). Prompt 9's copy module, when it
// lands, absorbs this file.

/** What a failed region was showing, in the sentence "Couldn't load <thing>. Try again." */
export type Thing =
  | "your drafts"
  | "your sessions"
  | "your library"
  | "your collections"
  | "builds"
  | "this build"
  | "this family"
  | "this comparison"
  | "this profile"
  | "your activity"
  | "posts"
  | "your spaces"
  | "this space"
  | "this post"
  | "your settings"
  | "your devices"
  | "your messages"
  // Proposed in Part B for regions the reference list does not name.
  | "this collection"
  | "these people"
  | "your week"
  | "the maps";

export const failedLine = (thing: Thing): string => `Couldn't load ${thing}. Try again.`;

/** G9: every region of the page failed. */
export const FAILED_PAGE = "Couldn't load this page. Try again.";

export const RETRY_LABEL = "Try again";
export const RETRYING_LABEL = "Trying again…";

/** G7: the server said the row does not exist. */
export const NOT_FOUND = "Nothing at this address.";

export type MissingKind = "build" | "profile" | "space" | "post" | "editor" | "collection";

export const NOT_FOUND_DETAIL: Record<MissingKind, string> = {
  build: "This build may have been unpublished, or the link may be wrong.",
  profile: "This profile may have moved, or the link may be wrong.",
  space: "This space may have been removed, or the link may be wrong.",
  post: "This post may have been removed, or the link may be wrong.",
  editor: "This build may have been deleted, or it may belong to someone else.",
  // Proposed in Part B: a collection that is private reads the same to a visitor as one that is gone.
  collection: "This collection may be private, or the link may be wrong.",
};

/** D5: the one way out of a missing page. */
export const WAY_OUT = {
  browseBuilds: { label: "Browse builds", to: "/builds" },
  openBuilds: { label: "OpenBuilds", to: "/openbuilds" },
  newBuild: { label: "Start a new build", to: "/compose/new" },
} as const;

export type WayOut = (typeof WAY_OUT)[keyof typeof WAY_OUT];

/** G14, G21: the session ended. */
export const SIGNED_OUT_DIALOG = "You've been signed out. Sign in to carry on.";
export const SIGNED_OUT_EDITOR = "You've been signed out. Your work is kept on this device.";
export const SAVING_PAUSED = "Not saved. Sign in to save.";
