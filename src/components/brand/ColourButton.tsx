// The colour button (CA-06 P4): a 22 icon button holding a 12px circle, dashed in `--label` while the part has no
// colour and filled with it once it has one. Its name says what it colours and the colour, so colour is never the only
// signal: "Colour for Prompt 3: #7FA7D9", "Colour for Prompt 3: none".

import { Circle } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";

import { t } from "@/lib/theme/tokens";

import { IconButton } from "./IconButton";

export const colourButtonLabel = (what: string, colour: string | null | undefined): string => `Colour for ${what}: ${colour ?? "none"}`;

/** The 12px circle: the colour, or a dashed ring when there is none. */
export function ColourDot({ colour, size = 12, style }: { colour: string | null | undefined; size?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      data-colour-dot={colour ?? "none"}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: "50%",
        display: "inline-block",
        ...(colour ? { background: colour } : { border: `1px dashed ${t.label}` }),
        ...style,
      }}
    />
  );
}

export function ColourButton({ what, colour, onPick, size = 22 }: { what: string; colour: string | null | undefined; onPick: (anchor: HTMLElement) => void; size?: 22 | 30 }) {
  return (
    <IconButton
      icon={Circle}
      size={size}
      boxed={false}
      label={colourButtonLabel(what, colour)}
      title={colourButtonLabel(what, colour)}
      data-testid="colour-button"
      drawn={<ColourDot colour={colour} />}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onPick(event.currentTarget);
      }}
    />
  );
}

export default ColourButton;
