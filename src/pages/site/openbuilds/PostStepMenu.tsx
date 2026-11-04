/* UX-06 Part 1: a step of the post's build, as a menu. PURE: callbacks in, nothing read.

   The tile's own content, then `2 replies` (11.5 `--text2`) under its title when the step has replies. Pressing it opens a menu:
   Reply on this step, Show replies on this step, and (Part 4) Add to a draft, which the container hands in. */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { StripTileData } from "@/components/vision/StepStripTiles";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { MENU_Z } from "./PostReplies";

/** The tile as a menu's trigger: padded as a pressable tile is, with the app's focus ring. */
const TileTrigger = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TileTrigger({ children, ...rest }, ref) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({ onPointerDown: rest.onPointerDown as never, onFocus: rest.onFocus as never, onBlur: rest.onBlur as never });
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...handlers}
      style={{ display: "block", boxSizing: "border-box", width: "100%", padding: "10px 12px", background: "none", border: 0, borderRadius: r.control, textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
});

export interface StepMenuProps {
  tile: StripTileData;
  inner: ReactNode;
  replies: number;
  onReplyOn: () => void;
  onShowReplies: () => void;
  /** Part 4: the `Add to a draft` item, a sub-menu of drafts. */
  addToDraft?: ReactNode;
}

export function PostStepMenu({ tile, inner, replies, onReplyOn, onShowReplies, addToDraft }: StepMenuProps) {
  const head = [tile.number, tile.kind].filter(Boolean).join(" · ");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TileTrigger aria-label={`${head}, ${tile.title}${replies > 0 ? `, ${replies} ${replies === 1 ? "reply" : "replies"}` : ""}`}>
          {inner}
          {replies > 0 ? <div style={{ fontFamily: FIGTREE, fontSize: 11.5, color: t.text2, marginTop: 2 }}>{`${replies} ${replies === 1 ? "reply" : "replies"}`}</div> : null}
        </TileTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" style={{ zIndex: MENU_Z }}>
        <DropdownMenuItem onSelect={onReplyOn}>Reply on this step</DropdownMenuItem>
        <DropdownMenuItem onSelect={onShowReplies}>Show replies on this step</DropdownMenuItem>
        {addToDraft}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
