import { cn } from "@/lib/utils";
import { FluidShape } from "@/components/brand/FluidField";
import { r } from "@/lib/theme/radius";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the skeleton; Part E (Reference E): routed to the fluid field.

   The legacy control kit's skeleton keeps its element, its classes and its box,
   so the pages that still use it lay out exactly as before, but it paints
   nothing: its box is a shape in the living dot field (FluidField), in the
   nearest loading region's canvas or its own. No shimmer.
   ──────────────────────────────────────────────────────────────────────────── */

function Skeleton({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <FluidShape aria-hidden="true" className={cn(className)} style={{ borderRadius: r.media, ...style, background: "transparent" }} {...props} />;
}

export { Skeleton };
