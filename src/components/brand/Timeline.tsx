// The timeline (UI-P12): "Watch it get built" — a rail with a dot per event.
//
// A 1px `--line` rail runs down the left, 5px in, from 6px below the top to 16px
// above the bottom; each event is a grid of dot (16px), time (44px) and the rest,
// 14px apart. The dot is 11px and takes its colour from the event's kind; the
// kind is written out beside it in the same colour, small caps in mono, so the
// colour is never the only thing saying what happened.
//
//   prompt     --cat-instruction     milestone  --evidence
//   breakage   --cat-breakage        note       --label
//   deploy     --lit (the dot)       --lit-ink (the word: amber has to be READ)
//
// ON DUSK EACH DOT GLOWS, 0 0 10px in its own colour — a lamp needs darkness.
// A glow is an element's shadow rather than a colour, and it is a different
// colour for each kind, so it is not a token: the room is read with `useRoom`,
// as the mark's halo is.
//
// `at` is the caller's: "04:12" is a clock inside the build, not a date.
//
// ON A PHONE (`size="phone"`, UI-P29) the time column is 48px and the type a
// step up: the time 11px, the kind 10px, the text 14px.

import type { EventKind } from "@/lib/build";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { useRoom } from "./useRoom";

export interface TimelineEvent {
  kind: EventKind;
  /** Already formatted: "04:12". */
  at: string;
  text: string;
}

export interface TimelineProps {
  events: readonly TimelineEvent[];
  /** The list's accessible name. */
  label?: string;
  /** `phone`: the 390 board's rows — a 48px time column, 11px time, 14px text. */
  size?: "desktop" | "phone";
}

/** The dot's colour, and the colour of the kind's name. */
const DOT: Record<EventKind, string> = {
  prompt: t.catInstruction,
  milestone: t.evidence,
  breakage: t.catBreakage,
  note: t.label,
  deploy: t.lit,
};
/** The kind's name, which is read: deploy swaps the lamp for its legible ink. */
const INK: Record<EventKind, string> = { ...DOT, deploy: t.litInk };

export function Timeline({ events, label = "Events", size = "desktop" }: TimelineProps) {
  const dusk = useRoom() === "dusk";
  const phone = size === "phone";

  return (
    <div data-ui="timeline" style={{ position: "relative" }}>
      <span
        aria-hidden="true"
        style={{ position: "absolute", left: 5, top: 6, bottom: 16, width: 1, background: t.line }}
      />
      <ol aria-label={label} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {events.map((event, i) => (
          <li
            key={i}
            data-event-kind={event.kind}
            style={{
              display: "grid",
              gridTemplateColumns: phone ? "16px 48px minmax(0, 1fr)" : "16px 44px minmax(0, 1fr)",
              gap: 10,
              alignItems: "start",
              position: "relative",
              paddingBottom: 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                backgroundColor: DOT[event.kind],
                marginTop: 3,
                boxShadow: dusk ? `0 0 10px ${DOT[event.kind]}` : undefined,
              }}
            />
            <span style={{ fontFamily: DM_MONO, fontSize: phone ? 11 : 10, color: t.label, marginTop: phone ? 0 : 2 }}>
              {event.at}
            </span>
            <div>
              <div
                style={{
                  fontFamily: DM_MONO,
                  fontSize: 10,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: INK[event.kind],
                }}
              >
                {event.kind}
              </div>
              <div style={{ fontFamily: FIGTREE, fontSize: phone ? 14 : 12, color: t.text, marginTop: 2 }}>{event.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default Timeline;
