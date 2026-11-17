// The one copy module (prompt 9, G11). Every sentence more than one place says lives here and is imported, never retyped:
// errors, sign-in prompts, empty states, waiting labels and confirmations, and the page states prompt 10 wrote (failed,
// retrying, empty, not found, signed out), which moved here unchanged from src/components/pagestate/stateCopy.ts.
//
// The patterns (copyRules.test.ts checks them in screen text):
//   error         "Couldn't <verb> <object>. <Next step>."      unknown: "Couldn't do that. Try again."
//   sign-in       "Sign in to <action>." (sentence) / "Sign in to <action>" (button), from SIGN_IN only
//   empty         "No <things> yet." / "No <things> match.", then the next step where there is one
//   waiting       a present participle and the one ellipsis character: "Saving…"
//   done          past tense, a full stop, no "!", tick or emoji: "Draft saved."

// ── page states (moved from prompt 10's stateCopy.ts) ──

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
  // Added in Part B for regions the reference list does not name (accepted).
  | "this collection"
  | "this list"
  | "your week"
  | "the maps"
  // Added with Home (accepted): its feed holds builds and topics together.
  | "the feed"
  // The member's own builds' runs (Activity's chart), and everyone's (Home's room).
  | "your runs"
  | "runs"
  /* G30: a session's prompts (the editor's session list and window), and the work a post can attach. */
  | "these prompts"
  | "your work";

export const failedLine = (thing: Thing): string => `Couldn't load ${thing}. Try again.`;

/** The same sentence where there is no button to try again with (a disabled menu item). */
export const couldntLoad = (thing: Thing): string => `Couldn't load ${thing}.`;

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
  // Added in Part B (accepted): a collection that is private reads the same to a visitor as one that is gone.
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
