// SV-21's words for "Open as a request". SV-28: kept apart from the window, so the composer carries the words and the window's code
// loads when it first opens (SV-26's lazyWindow).

export const OPEN_REQUEST_COPY = {
  openSession: (number: number) => `Open Session ${number} as a request`,
  askNext: (part: string) => `Ask for the next session in ${part}`,
  description: "Say what you want. Nothing is asked of anyone until you publish, and you can take it back before then.",
  label: "What do you want?",
  submit: "Open request",
  empty: "Say what the request is for.",
} as const;

