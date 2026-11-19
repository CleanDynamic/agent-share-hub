/* The tutorial's chapters: one build made in eight challenges, on a small copy of the editor.

   ONE BUILD, CARRIED FROM CHAPTER TO CHAPTER. The left of every stage is "Your build": the build so far, as the List would
   draw it (parts, sessions, numbered steps), read from `builtAt(chapter, done)`. It starts empty and grows a row or two each
   chapter; what the chapter in hand has added is drawn in the text colour with a mark, the rest is quiet. The right of the
   stage is where the chapter's work is done.

   A CHALLENGE IS ITS GOALS, ONE AT A TIME (tutorialSteps.ts). The window keeps the count of goals cleared (`done`) and hands it
   here; a chapter draws its stage as it stands after that many, and reports every press on a target with `hit(id)`. Whether
   the press was the right one is the window's to say. So a chapter holds nothing of the game but what is under the finger: a
   drag.

   TARGETS ARE REAL BUTTONS, each with a name, laid over the picture: the stage can be worked with Tab and Enter as well as a
   pointer. A target's hit area is at least 68 by 68 on the stage, so it is still 44 by 44 once a phone's sheet has scaled the
   stage down; the ring that points at it when a hint is due is drawn round the thing itself.

   THE TWO DRAGS (the tool in chapter 2, the session in chapter 4) each have a button that does the same, for a keyboard and for
   anyone who would rather press.

   SHOW ME (`TaskDemo`) plays the same chapter by itself: it points at each goal's target, then clears it, and starts over once
   the chapter is done. Its targets are not buttons: the whole stage is one, which pauses it. */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { BASE, FAST } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { tagStyle, tnum } from "./refinedStyles";
import { MODULE, MiniButton, ROW, STAGE, SessionHead, StepNumber, StepTile, WINDOW, at, play, stageStyle, useFit, words } from "./tutorialScenes";
import { TUTORIAL_COPY, TUTORIAL_STEPS, buildCount, builtAt, outlineOf, type Built, type TutorialScene } from "./tutorialSteps";

/** `[left, top, width, height]` on the stage. */
type Box = readonly [number, number, number, number];

export interface TaskProps {
  /** Goals cleared so far in this chapter. */
  done: number;
  /** The goal asked for now; null once the chapter is cleared. */
  goal: string | null;
  /** A hint is due: the current goal's target is pointed at. */
  hinting: boolean;
  /** A target was pressed. */
  hit: (id: string) => void;
  /** Show me: the chapter plays itself, and nothing on it can be pressed. */
  demo?: boolean;
}

/** How far the stage is scaled where it stands: a drag is measured on the screen and applied on the stage. */
const StageScale = createContext(1);

/* ── where things stand ── */

/** "Your build" takes the left of the stage; the chapter's work is done to its right. */
const OUTLINE_WIDTH = 164;
/** The work area's left edge and width. */
const WX = 176;
const WW = 404;

/** A place in the work area, on the stage. */
const w = (left: number, top: number, width?: number, height?: number): CSSProperties => at(WX + left, top, width, height);
/** A box in the work area, on the stage. */
const wb = (left: number, top: number, width: number, height: number): Box => [WX + left, top, width, height];

/* ── pieces ── */

/** Arrives with one short move. */
function Pop({ from = "translateY(6px)", delay = 0, style, children }: { from?: string; delay?: number; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    play(ref.current, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: BASE, delay, fill: "backwards" });
    // Once, as it arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

/** Points at a target: a line round it that beats three times and stays. */
function HintRing({ box }: { box: Box }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    play(ref.current, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], { duration: BASE * 3, iterations: 3 });
  }, []);
  return <span ref={ref} data-testid="tutorial-hint-ring" aria-hidden="true" style={{ ...at(...box), borderRadius: 8, border: `1px solid ${t.text}`, pointerEvents: "none", zIndex: 6 }} />;
}

/** Something to press. `zone` is where a press lands; `around` is what the hint's ring is drawn round (the zone, unless given). */
function Target({ id, label, zone, around, task }: { id: string; label: string; zone: Box; around?: Box; task: TaskProps }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const pointed = task.hinting && task.goal === id ? <HintRing box={around ?? zone} /> : null;
  if (task.demo) return pointed;
  return (
    <>
      <button
        type="button"
        data-target={id}
        aria-label={label}
        onClick={() => task.hit(id)}
        {...handlers}
        style={{ ...at(...zone), zIndex: 5, padding: 0, border: 0, borderRadius: 8, background: "transparent", cursor: "pointer", ...ring(state.focusVisible) }}
      />
      {pointed}
    </>
  );
}

/** Cleared: a filled circle with a check. */
export function Tick({ size = 16, style }: { size?: 16 | 32; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, background: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", ...style }}>
      <Glyph name="check" size={size === 32 ? 16 : 12} color={t.window} />
    </span>
  );
}

/** A row that adds something: a plus and its words, as the List draws Add step, Add session and Add part. */
function AddRow({ words: label, style }: { words: string; style?: CSSProperties }) {
  return (
    <div style={{ ...ROW, ...style }}>
      <Glyph name="plus" size={16} color={t.text2} />
      <span style={words(12, 500, t.text2)}>{label}</span>
    </div>
  );
}

/** A session folded to one line, as the List draws it closed. */
function SessionLine({ number, app, steps, end }: { number: number; app: string; steps: string; end?: ReactNode }) {
  return (
    <div style={{ ...MODULE, ...ROW, width: "100%", height: "100%", padding: "0 12px" }}>
      <Glyph name="chev" size={16} color={t.label} />
      <span style={words(12, 500, t.text)}>{`Session ${number}`}</span>
      <span style={tagStyle}>{app}</span>
      <span style={{ ...words(11, 400, t.label), marginLeft: "auto" }}>{steps}</span>
      {end}
    </div>
  );
}

/** The small square