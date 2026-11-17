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

import { SITE_NAME } from "@/lib/site";

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
export const SIGNED_OUT_DIALOG = "You've been signed out. Sign in to continue.";
export const SIGNED_OUT_EDITOR = "You've been signed out. Your work is kept on this device.";
export const SAVING_PAUSED = "Not saved. Sign in to save.";

// ── errors (G3, G4) ──

/** The one sentence for a failure we have no words for (G4). */
export const UNKNOWN_ERROR = "Couldn't do that. Try again.";
export const OFFLINE_ERROR = `Couldn't reach ${SITE_NAME}. Check your connection and try again.`;

/** What the auth service's refusals read as (src/lib/auth/authMessages.ts maps the codes). */
export const AUTH_ERRORS = {
  captcha: "Couldn't verify this request. Try again.",
  credentials: "That email or password isn't right.",
  "rate-limit": "Too many tries. Wait a minute, then try again.",
  "weak-password": "Choose a stronger password.",
  "same-password": "Choose a password you haven't used before.",
  "invalid-email": "Enter a valid email address.",
  unknown: UNKNOWN_ERROR,
} as const;

// ── sign-in prompts (G5): at most ten, keyed by the action they guard ──

export const SIGN_IN = {
  save: "save",
  comment: "comment",
  like: "like",
  rebuild: "rebuild",
  post: "post",
  joinSpaces: "join spaces",
  drafts: "see your drafts",
  profile: "change your profile",
  confirm: "confirm",
  continue: "continue",
} as const;

export type SignInAction = keyof typeof SIGN_IN;

/** The button form: no full stop. */
export const signInButton = (action: SignInAction): string => `Sign in to ${SIGN_IN[action]}`;
/** The sentence form. */
export const signInSentence = (action: SignInAction): string => `Sign in to ${SIGN_IN[action]}.`;

/** G3: the shared error sentences. A caller with its own object writes "Couldn't <verb> <object>. <Next step>." in place. */
export const SAVE_FAILED = "Couldn't save that. Try again.";
export const COPY_LINK_FAILED = "Couldn't copy the link. Try again.";
/** Following a person. */
export const FOLLOW_PERSON_FAILED = "Couldn't follow them. Try again.";
export const UNFOLLOW_PERSON_FAILED = "Couldn't unfollow them. Try again.";
/** Following a public filter set. */
export const FOLLOW_FAILED = "Couldn't follow that. Try again.";
export const UNFOLLOW_FAILED = "Couldn't unfollow that. Try again.";
export const JOIN_SPACE_FAILED = "Couldn't join that space. Try again.";

// ── empty states (G6): "No <things> yet." / "No <things> match.", then the next step where there is one ──

export const EMPTY = {
  sessions: "No sessions yet.",
  steps: "No steps yet.",
  breakages: "No breakages recorded.",
  nothingAdded: "Nothing added yet.",
  nothingNamed: "Nothing has that name.",
} as const;

// ── waiting labels (G7): a present participle and the one ellipsis character ──
// The sign-in dialog's "Signing in" and "Opening Google" have no ellipsis: a ring of dots sits beside them (an earlier prompt).

export const WAITING = {
  saving: "Saving…",
  sending: "Sending…",
  updating: "Updating…",
  joining: "Joining…",
} as const;

// ── confirmations (G8): past tense, a full stop, no "!", tick or emoji ──

export const DONE = {
  copied: "Copied.",
  linkCopied: "Link copied.",
  saved: "Saved.",
  setupCopied: "Setup prompt copied.",
} as const;
