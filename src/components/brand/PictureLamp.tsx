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

import type { PlaqueState } from "./Plaque";

export interface PictureLampProps {
  state: PlaqueState;
}

export function PictureLamp({ state }: PictureLampProps) {
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
