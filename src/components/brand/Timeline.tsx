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
// UNDER THE REFINED LOOK (UI-P85) the rail is quieter and every event lives in tokens: a 7px dot in a 3px ring of
// `--surface` (so the 1px `--line` spine passes behind it), the time in `--label`, tabular, the kind as an eyebrow in
// its tone, and the title 12.5/500. There is no glow, and deploy is `--evidence`: amber is light, never text, and a
// dot that is not a lamp does not take it.
//
// ON A PHONE (`size="phone"`, UI-P29) the time column is 48px and the type a
// step up: the time 11px, the kind 10px, the text 14px.

import type { EventKind } from "@/lib/build";
import { useLook } from "@/lib/theme/look";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Eyebrow } from "./Eyebrow";

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

/** The same two maps for anything else that names an event's kind (the replay, UI-P30), so the colours cannot drift. */
export { DOT as EVENT_DOT, INK as EVENT_INK };

/** Refined: the tone of the dot and of the kind's name. */
const REFINED_TONE: Record<EventKind, string> = {
  prompt: t.catInstruction,
  milestone: t.evidence,
  breakage: t.breakage,
  note: t.label,
  deploy: t.evidence,
};

/** The kind's name is text, so it is never the category colour where that sits under 4.5 on the surface. */
const REFINED_INK: Record<EventKind, string> = { ...REFINED_TONE, prompt: t.text2 };

function RefinedTimeline({ events, label }: Pick<TimelineProps, "events" | "label">) {
  return (
    <div data-ui="timeline" style={{ position: "relative" }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 3, top: 8, bottom: 8, width: 1, background: t.line }} />
      <ol aria-label={label} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {events.map((event, i) => (
          <li
            key={i}
            data-event-kind={event.kind}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "8px 48px minmax(0, 1fr)",
              gap: 12,
              alignItems: "baseline",
              paddingBottom: i === events.length - 1 ? 0 : 16,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "relative",
                top: 1,
                width: 7,
                height: 7,
                boxSizing: "border-box",
                borderRadius: "50%",
                background: REFINED_TONE[event.kind],
                boxShadow: `0 0 0 3px ${t.surface}`,
              }}
            />
            <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.label, fontVariantNumeric: "tabular-nums" }}>
              {event.at}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <Eyebrow as="span" style={{ color: REFINED_INK[event.kind] }}>
                {event.kind}
              </Eyebrow>
              <span style={{ fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 500, lineHeight: "normal", color: t.text }}>
                {event.text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Timeline({ events, label = "Events", size = "desktop" }: TimelineProps) {
  const refined = useLook() === "refined";
  const dusk = useRoom() === "dusk";
  const phone = size === "phone";
  if (refined) return <RefinedTimeline events={events} label={label} />;

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
              /* UI-P54, the density pass: 10 and 14 before; the tracks, the
                 dots and the rail's position are not in the table. */
              gap: 7,
              alignItems: "start",
              position: "relative",
              paddingBottom: 10,
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
              <div style={{ fontFamily: FIGTREE, fontSize: phone ? 13 : 12, color: t.text, marginTop: 2 }}>{event.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default Timeline;
