// SV-21's words for marking a piece, UX-08 P1: a session, a part or a step tile is marked still open. SV-28: kept apart from the
// window, so the composer carries the words and the window's code loads when it first opens (SV-26's lazyWindow).

export const OPEN_REQUEST_COPY = {
  /** The session head's menu item. */
  openSession: (number: number) => `Mark Session ${number} still open`,
  /** The ghost row at the end of a part. */
  askNext: (part: string) => `Ask for the next session in ${part}`,
  /** The window's titles. */
  titleSession: (number: number) => `Still open: Session ${number}`,
  titleNext: (part: string) => `Still open: next session in ${part}`,
  titleTile: (label: string) => `Still open: ${label}`,
  description: "Say what is missing. It becomes a topic on OpenBuilds when you publish, and you can take it back before then.",
  label: "What's missing",
  submit: "Mark still open",
  empty: "Say what's missing.",
} as const;

/** UX-08 P1: when the topics a publish should start did not all go. The build is live whatever happens here. */
export const STILL_OPEN_FAILED = "Your still-open topics didn't send. Try again from the build page.";
