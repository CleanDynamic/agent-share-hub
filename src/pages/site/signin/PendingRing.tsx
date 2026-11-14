/* G12: what a pending button in the sign-in dialog shows (Reference A): a ring of 8 dots, 18px across, 4px dots, their
   opacity stepping from 1 down to 0.12 around the ring, turning once every 900ms, linear.

   The turn is played through the Web Animations API: index.css stops every CSS animation outside a loading placeholder,
   and the ring is not one. Under reduced motion it does not turn. */

import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/theme/motion";

import { RING_TURN_MS } from "./signinMotion";

const SIZE = 18;
const DOT = 4;
const COUNT = 8;

export function PendingRing() {
  const ring = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ring.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const turn = el.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: RING_TURN_MS, easing: "linear", iterations: Infinity });
    return () => turn.cancel();
  }, []);
  const radius = (SIZE - DOT) / 2;
  return (
    <span ref={ring} aria-hidden="true" data-testid="pending-ring" style={{ position: "relative", display: "inline-block", flexShrink: 0, width: SIZE, height: SIZE }}>
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              width: DOT,
              height: DOT,
              borderRadius: "50%",
              background: "currentColor",
              left: radius + radius * Math.sin(angle),
              top: radius - radius * Math.cos(angle),
              /* The ring turns clockwise: the leading dot is solid and each one behind it (counter-clockwise) fainter, down
                 to 0.12 for the last. */
              opacity: 1 - (((COUNT - i) % COUNT) * (1 - 0.12)) / (COUNT - 1),
            }}
          />
        );
      })}
    </span>
  );
}

export default PendingRing;
