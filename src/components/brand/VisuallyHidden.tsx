// Text for assistive technology alone (UI-P37).
//
// The standard clip pattern: out of the layout (`position: absolute`, 1px, no
// overflow) but still in the accessibility tree, so a screen reader reads it and
// nothing shifts. One definition: before this the same eleven lines were pasted
// into a dozen components, and each paste is a place the pattern can be gotten
// subtly wrong (`display: none` and `visibility: hidden` both remove the text
// from the tree, which is the opposite of the job).

import type { CSSProperties, ReactNode } from "react";

export const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span style={VISUALLY_HIDDEN}>{children}</span>;
}

export default VisuallyHidden;
