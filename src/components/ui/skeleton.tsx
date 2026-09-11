import { cn } from "@/lib/utils";
import { skeletonStyle } from "@/lib/theme/controls";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the skeleton.

   `--recess` with a highlight swept across it by the `bgShimmer` keyframe in
   `index.css`. A keyframe is the one thing an inline style cannot express, so
   the movement lives in the stylesheet and is referenced here by name — the
   sanctioned exception, and the same one the intake sweep already uses.

   WHY A SWEEP AND NOT A PULSE. `animate-pulse` fades the whole block in and out,
   which at a glance is indistinguishable from content that is failing to load.
   A sweep travels in one direction and reads as progress.

   REDUCED MOTION IS ANSWERED TWICE, ON PURPOSE. `skeletonStyle()` drops the
   animation from the style object, which covers every render; `data-bg-animated`
   lets the stylesheet cover the gap that leaves — a visitor who changes the
   setting while a skeleton is already on screen, where nothing would re-render
   to notice. What remains is a flat recess, which still reads as "not content
   yet" because that is carried by the colour and the shape, not by the movement.
   ──────────────────────────────────────────────────────────────────────────── */

function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-bg-animated=""
      aria-hidden="true"
      className={cn(className)}
      style={{ ...skeletonStyle(), ...style }}
      {...props}
    />
  );
}

export { Skeleton };
