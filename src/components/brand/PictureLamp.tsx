// The picture lamp (UI-P08): the lamp above a card, and the light it throws.
//
// A gallery hangs its pictures under lamps. A build with a reproduction that is
// still current has its lamp lit; one gone stale has it dimmed to 45%; one nobody
// has reproduced has none — and gets an empty 18px spacer instead, so cards in a
// row stay aligned whether or not they are lit. The state is `plaqueState()`'s,
// from data and nowhere else (RULES §5).
//
// LIGHT, NOT DECORATION. The wash is a radial gradient from `--picture-lamp-wash`
// (white on Noon, amber on Dusk) running down from the lamp, behind the card's
// own surface, and it is dimmed with the lamp. It paints nothing a reader needs:
// the state is also said in words by the plaque under the picture.

import { useLook } from "@/lib/theme/look";
import { t } from "@/lib/theme/tokens";

import { LampBar } from "./LampDot";
import type { PlaqueState } from "./Plaque";

export interface PictureLampProps {
  state: PlaqueState;
}

/* UI-P85, refined: a 32×3 lamp bar, and below it the picture light, the one gradient the look allows — a cone from
   `--picture-lamp-wash` to nothing, clipped as the reference clips it. Dimmed is the dim filter on both. A lit frame
   never takes an amber edge. */
function RefinedPictureLamp({ state }: PictureLampProps) {
  const stale = state === "stale";
  return (
    <div
      data-ui="picture-lamp"
      data-variant={stale ? "dim" : "on"}
      aria-hidden="true"
      style={{ position: "relative", height: 18, display: "flex", justifyContent: "center", filter: stale ? t.dimFilter : undefined }}
    >
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: 6,
          width: 134,
          height: 110,
          marginLeft: -67,
          clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
          background: `linear-gradient(${t.pictureLampWash}, transparent)`,
          pointerEvents: "none",
        }}
      />
      <LampBar width={32} />
    </div>
  );
}

export function PictureLamp({ state }: PictureLampProps) {
  const refined = useLook() === "refined";
  if (refined && state !== "unreproduced") return <RefinedPictureLamp state={state} />;
  if (state === "unreproduced") {
    return <div data-ui="picture-lamp" data-variant="off" aria-hidden="true" style={{ height: 18 }} />;
  }

  const stale = state === "stale";
  return (
    <div
      data-ui="picture-lamp"
      data-variant={stale ? "dim" : "on"}
      aria-hidden="true"
      style={{ position: "relative", height: 18, display: "flex", justifyContent: "center" }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 10,
          width: 220,
          height: 110,
          marginLeft: -110,
          background:
            "radial-gradient(ellipse 50% 60% at 50% 0%, var(--picture-lamp-wash) 0%, transparent 100%)",
          opacity: stale ? 0.45 : undefined,
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 30,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "var(--lit)",
          opacity: stale ? 0.45 : 1,
          boxShadow: stale ? undefined : "var(--picture-lamp-glow)",
          marginTop: 3,
        }}
      />
    </div>
  );
}

export default PictureLamp;
