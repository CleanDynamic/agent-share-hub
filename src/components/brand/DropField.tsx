/* Synth 10: the dashed area a file is dropped on. A 1px dashed `--field-edge` edge (the light pack's `#879189`) at the
   control radius, a faint field of water dots behind its words, and the same signal turned up while a file is over it:
   the dots come to full strength and the edge takes the action colour. The dots draw nothing the words need and take no
   pointer events. A caller passes the element's own props (a button, a div with drop handlers) through `as`. */

import type { CSSProperties, ElementType, ReactNode } from "react";

import { WaterField } from "@/components/brand/FluidField";
import { fade } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export interface DropFieldProps {
  as?: ElementType;
  /** A file is over the area (or the page): the edge and the dots come up. */
  armed?: boolean;
  /** Heavier edge while a file is actually over it. */
  over?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
  [attribute: string]: unknown;
}

export function DropField({ as: Tag = "div", armed = false, over = false, style, children, ...rest }: DropFieldProps) {
  return (
    <Tag
      data-ui="drop-field"
      {...rest}
      style={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        boxSizing: "border-box",
        borderRadius: r.control,
        /* Longhands: a `border` shorthand carrying a `var()` is dropped whole by jsdom, taking the dashes with it. */
        borderWidth: over ? 1.5 : 1,
        borderStyle: "dashed",
        borderColor: armed ? t.action : t.fieldEdge,
        background: "transparent",
        ...style,
      }}
    >
      <WaterField style={{ opacity: armed ? 1 : 0.2, transition: fade(), zIndex: -1 }} />
      {children}
    </Tag>
  );
}

export default DropField;
