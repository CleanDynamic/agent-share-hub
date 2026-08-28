// A branch: one line leaving another and going its own way.
//
// Drawn here rather than imported from lucide for two reasons. The set's own
// git-branch glyph carries a version-control connotation this platform
// deliberately does not use — nothing here is a commit — and this mark is
// rendered beside a number on the gallery card, where an icon import that
// pulls a component per card is weight the grid does not need.
//
// It is aria-hidden everywhere it appears: the count beside it says the same
// thing in words, and the control around it carries the accessible name.

export interface BranchIconProps {
  size?: number;
  colour?: string;
}

export function BranchIcon({ size = 13, colour = "currentColor" }: BranchIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={colour}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M4.5 3.5v9" />
      <path d="M4.5 7.5h4a3 3 0 0 1 3 3v2" />
      <circle cx="4.5" cy="2.5" r="1.4" />
      <circle cx="4.5" cy="13.5" r="1.4" />
      <circle cx="11.5" cy="13.5" r="1.4" />
    </svg>
  );
}

export default BranchIcon;
