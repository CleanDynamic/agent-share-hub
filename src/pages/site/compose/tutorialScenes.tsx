/* The tutorial's examples: one small moving picture of the editor per step.

   EACH IS DRAWN, NOT RECORDED. A scene is the editor in miniature on a 592 by 248 stage, built from the site's own tokens,
   so it is right in both themes, weighs almost nothing and never shows a screen that has since changed shape. The stage
   scales down as one piece where the window is narrower (a phone's sheet).

   HOW IT MOVES. Every moving piece carries its whole timeline in `data-tl`: a list of keyframes, each with its place in the
   loop (`offset`, 0 to 1), an opacity and a transform, and nothing else. `ScenePlayer` plays all of a scene's pieces
   together on the Web Animations API, one loop of `SCENE_LOOP_MS`, round and round. Only opacity and transform ever change.

   HOW IT STANDS STILL. A piece's own style is how the scene looks finished (its poster): the steps in, the list ticked. Under
   reduced motion, or where the browser cannot animate, nothing plays and the poster is the example. A piece that is only
   there in passing (the pointer, a menu, a notice) is `poster={false}` and is not drawn at rest.

   IT CAN BE STOPPED. The stage is one button: pressing it pauses the loop where it is, pressing again carries on. The example is
   beside the words, never in place of them, so it is hidden from a screen reader, which is told only that it can be paused. */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { tagStyle, text, tnum } from "./refinedStyles";
import { TUTORIAL_COPY, type TutorialScene } from "./tutorialSteps";

/** One loop of an example. An ambient loop, not feedback: nobody waits on it. */
export const SCENE_LOOP_MS = 9000;

export const STAGE = { width: 592, height: 248 } as const;

/* ── timelines ── */

export interface Frame {
  offset: number;
  opacity?: number;
  transform?: string;
  easing?: string;
}

/** How long a piece takes to come or go, as a share of the loop (about a quarter of a second). */
const IN = 0.03;
const RISE = "translateY(6px)";
const FALL = "translateY(-8px)";
const STILL = "none";

/** Not there until `at`, then in, then there to the end. */
export const enter = (at: number, from: string = RISE): Frame[] => [
  { offset: 0, opacity: 0, transform: from },
  { offset: at, opacity: 0, transform: from, easing: STANDARD },
  { offset: at + IN, opacity: 1, transform: STILL },
  { offset: 1, opacity: 1, transform: STILL },
];

/** There until `at`, then gone. */
export const leave = (at: number): Frame[] => [
  { offset: 0, opacity: 1 },
  { offset: at, opacity: 1, easing: STANDARD },
  { offset: at + IN, opacity: 0 },
  { offset: 1, opacity: 0 },
];

/** There only from `from` to `to`. */
export const between = (from: number, to: number, shift: string = RISE): Frame[] => [
  { offset: 0, opacity: 0, transform: shift },
  { offset: from, opacity: 0, transform: shift, easing: STANDARD },
  { offset: from + IN, opacity: 1, transform: STILL },
  { offset: to, opacity: 1, transform: STILL, easing: STANDARD },
  { offset: to + IN, opacity: 0, transform: STILL },
  { offset: 1, opacity: 0, transform: STILL },
];

/** Moves by `by` between `from` and `to`, and stays moved. */
export const shift = (from: number, to: number, by: string): Frame[] => [
  { offset: 0, transform: "translateY(0px)" },
  { offset: from, transform: "translateY(0px)", easing: STANDARD },
  { offset: to, transform: by },
  { offset: 1, transform: by },
];

/** The pointer's way across the stage: `[offset, x, y]`, in order, the first at 0 and the last at 1. */
export const path = (points: readonly (readonly [number, number, number])[]): Frame[] =>
  points.map(([offset, x, y]) => ({ offset, opacity: 1, transform: `translate(${x}px, ${y}px)`, easing: STANDARD }));

/** A press: a ring that opens and fades where the pointer is. */
export const press = (at: number): Frame[] => [
  { offset: 0, opacity: 0, transform: "scale(0.4)" },
  { offset: at, opacity: 0, transform: "scale(0.4)" },
  { offset: at + 0.008, opacity: 0.9, transform: "scale(0.6)", easing: STANDARD },
  { offset: at + 0.05, opacity: 0, transform: "scale(1.5)" },
  { offset: 1, opacity: 0, transform: "scale(1.5)" },
];

/** The whole scene, fading out and back in where the loop turns over, so nothing is seen jumping to its start. */
const TURN: Frame[] = [
  { offset: 0, opacity: 0 },
  { offset: 0.03, opacity: 1 },
  { offset: 0.955, opacity: 1 },
  { offset: 1, opacity: 0 },
];

/* ── pieces ── */

function Anim({ tl, poster = true, inline = false, style, children }: { tl: Frame[]; poster?: boolean; inline?: boolean; style?: CSSProperties; children?: ReactNode }) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag data-tl={JSON.stringify(tl)} style={{ ...style, ...(poster ? null : { opacity: 0 }) }}>
      {children}
    </Tag>
  );
}

/** Where a piece stands on the stage. */
const at = (left: number, top: number, width?: number, height?: number): CSSProperties => ({ position: "absolute", left, top, width, height, boxSizing: "border-box" });

const words = (px: 11 | 12 | 13 | 14 | 16, weight: 400 | 500, color: string): CSSProperties => ({ ...text(px, weight, color), whiteSpace: "nowrap" });

/** A line of text that is not there to be read: a bar the length of the words. */
function Bar({ left, top, width, strong = false }: { left: number; top: number; width: number; strong?: boolean }) {
  return <span style={{ ...at(left, top, width, 6), borderRadius: 2, background: strong ? t.label : t.line }} />;
}

const MODULE: CSSProperties = { background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: 8, boxShadow: t.moduleShadow };
const WINDOW: CSSProperties = { background: t.window, border: `1px solid ${t.windowBorder}`, borderRadius: 8, boxShadow: t.windowShadow };
const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

/** A step's number, in its box. `was` is the number it had before the example moved it. */
function StepNumber({ now, was, at: when }: { now: number; was?: number; at?: number }) {
  const box: CSSProperties = { position: "relative", width: 20, height: 20, flexShrink: 0, boxSizing: "border-box", borderRadius: 4, background: t.inset, border: `1px solid ${t.tileBorder}` };
  const digit: CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...words(11, 500, t.text2), ...tnum };
  if (was === undefined || when === undefined) {
    return (
      <span style={box}>
        <span style={digit}>{now}</span>
      </span>
    );
  }
  return (
    <span style={box}>
      <Anim inline poster={false} tl={leave(when)} style={digit}>
        {was}
      </Anim>
      <Anim inline tl={enter(when, STILL)} style={digit}>
        {now}
      </Anim>
    </span>
  );
}

/** One step tile: its number, its kind, and a bar for its words. */
function StepTile({ number, kind, name, bar = 180 }: { number: ReactNode; kind: string; name?: string; bar?: number }) {
  return (
    <div style={{ ...MODULE, ...ROW, width: "100%", height: "100%", boxSizing: "border-box", padding: "0 12px" }}>
      {number}
      <span style={words(11, 400, t.label)}>{kind}</span>
      {name ? <span style={words(12, 500, t.text)}>{name}</span> : <span style={{ width: bar, height: 6, borderRadius: 2, background: t.line }} />}
    </div>
  );
}

function SessionHead({ left, top }: { left: number; top: number }) {
  return (
    <div style={{ ...at(left, top), ...ROW }}>
      <Glyph name="layers" size={16} color={t.text2} />
      <span style={words(13, 500, t.text)}>Session 1</span>
      <span style={tagStyle}>Claude</span>
    </div>
  );
}

/** A small button, as the title row and a window's footer draw them. */
function MiniButton({ children, primary = false, quiet = false, style }: { children: ReactNode; primary?: boolean; quiet?: boolean; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 24,
        padding: "0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        ...(primary ? { background: t.action, border: `1px solid ${t.action}`, boxShadow: t.actionShadow } : { background: t.control, border: `1px solid ${t.controlBorder}` }),
        ...words(11, 500, primary ? t.onAction : quiet ? t.textDisabled : t.text),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** The pointer, and the ring of each press it makes on its way. */
function Pointer({ way, presses }: { way: Frame[]; presses: readonly number[] }) {
  return (
    <Anim poster={false} tl={way} style={{ ...at(0, 0, 16, 16), zIndex: 5 }}>
      {presses.map((when) => (
        <Anim key={when} poster={false} tl={press(when)} style={{ ...at(-10, -10, 24, 24), borderRadius: 12, border: `1px solid ${t.text}` }} />
      ))}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M2 1.5v11l3-2.7 2 4.4 1.9-.9-2-4.3h4.2z" fill={t.text} stroke={t.window} strokeWidth="1" strokeLinejoin="round" />
      </svg>
    </Anim>
  );
}

/* ── step 1: the three columns ── */

const COLUMNS = [
  { name: "Sources", says: "The sessions and files in this build", left: 20, width: 128, from: 0.06, to: 0.32 },
  { name: "Build", says: "Your post, then every step in order", left: 164, width: 280, from: 0.36, to: 0.62 },
  { name: "Details", says: "The fields of the step you select", left: 460, width: 112, from: 0.66, to: 0.92 },
] as const;

function LayoutScene() {
  return (
    <>
      <Bar left={20} top={18} width={112} strong />
      <Bar left={20} top={32} width={40} />
      <div style={{ ...at(350, 12), ...ROW, gap: 6 }}>
        <MiniButton>Classification</MiniButton>
        <MiniButton>Preview</MiniButton>
        <MiniButton primary>Publish</MiniButton>
      </div>
      <span style={{ ...at(0, 48, STAGE.width, 1), background: t.hairline }} />

      {COLUMNS.map((column) => (
        <span key={column.name} style={{ ...at(column.left, 62), ...words(12, 500, t.text) }}>
          {column.name}
        </span>
      ))}
      {/* Sources: two sessions and a file. */}
      <Bar left={20} top={88} width={96} />
      <Bar left={20} top={104} width={72} />
      <Bar left={20} top={132} width={84} />
      {/* Build: the post, then the steps. */}
      <span style={{ ...at(164, 84, 20, 20), borderRadius: 10, background: t.avatarFill, border: `1px solid ${t.tileBorder}` }} />
      <Bar left={192} top={86} width={168} strong />
      <Bar left={192} top={98} width={104} />
      {[118, 152].map((top, index) => (
        <div key={top} style={at(164, top, 280, 28)}>
          <StepTile number={<StepNumber now={index + 1} />} kind="Prompt" bar={index === 0 ? 150 : 108} />
        </div>
      ))}
      {/* Details: the chosen step's fields. */}
      <Bar left={460} top={88} width={92} strong />
      <Bar left={460} top={104} width={64} />
      <Bar left={460} top={128} width={100} />
      <Bar left={460} top={140} width={80} />

      {COLUMNS.map((column) => (
        <Anim key={column.name} poster={false} tl={between(column.from, column.to, STILL)} style={{ ...at(column.left - 8, 54, column.width + 16, 142), borderRadius: 8, border: `1px solid ${t.selectedEdge}` }} />
      ))}
      {COLUMNS.map((column) => (
        <Anim key={column.name} poster={false} tl={between(column.from, column.to)} style={{ ...at(0, 212, STAGE.width), textAlign: "center", ...words(12, 400, t.text) }}>
          <span style={{ fontWeight: 500 }}>{column.name}</span>
          <span style={{ color: t.text2 }}>{`  ${column.says}`}</span>
        </Anim>
      ))}
    </>
  );
}

/* ── step 2: the post ── */

function ToolGlyph({ left, name }: { left: number; name: GlyphName }) {
  return (
    <span style={{ ...at(left, 180), display: "flex" }}>
      <Glyph name={name} size={16} color={t.text2} />
    </span>
  );
}

function PostScene() {
  return (
    <>
      <span style={{ ...at(24, 20, 36, 36), borderRadius: 18, background: t.avatarFill, border: `1px solid ${t.tileBorder}` }} />
      <Anim poster={false} tl={leave(0.08)} style={{ ...at(74, 28), ...words(16, 400, t.label) }}>
        What did you build?
      </Anim>
      <div style={{ ...at(74, 28), ...words(14, 400, t.text) }}>
        <Anim inline tl={enter(0.11, STILL)}>
          An ordering site for a bakery,
        </Anim>
        <Anim inline tl={enter(0.17, STILL)}>
          {" built in "}
        </Anim>
        <Anim inline tl={enter(0.23, STILL)} style={{ position: "relative" }}>
          <Anim inline tl={enter(0.7, STILL)} style={{ position: "absolute", left: -2, right: -2, top: -1, bottom: -1, borderRadius: 4, background: t.findFill }} />
          <span style={{ position: "relative" }}>one session</span>
        </Anim>
        <Anim inline tl={enter(0.23, STILL)}>
          .
        </Anim>
      </div>

      <Anim tl={enter(0.38)} style={{ ...at(74, 62, 148, 96), borderRadius: 6, background: t.inset, border: `1px solid ${t.tileBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph name="image" size={16} color={t.label} />
        <Anim tl={enter(0.45, STILL)} style={{ ...tagStyle, position: "absolute", left: 6, top: 6, maxWidth: "none" }}>
          Cover
        </Anim>
      </Anim>
      <Anim tl={enter(0.7)} style={{ ...at(318, 52), ...tagStyle, ...WINDOW, borderRadius: 4, maxWidth: "none", color: t.text }}>
        Session 1
      </Anim>

      <ToolGlyph left={74} name="image" />
      <ToolGlyph left={106} name="listBullet" />
      <ToolGlyph left={138} name="listNumber" />
      <div style={{ ...at(178, 180), ...ROW, gap: 6 }}>
        <Glyph name="reference" size={16} color={t.text2} />
        <span style={words(12, 500, t.text2)}>Reference</span>
      </div>
      <span style={{ ...at(536, 172, 32, 32), borderRadius: 16, background: t.control, border: `1px solid ${t.controlBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph name="plus" size={16} color={t.text2} />
      </span>
      <span style={{ ...at(24, 220, 544, 1), background: t.hairline }} />

      <Pointer
        presses={[0.33, 0.65]}
        way={path([
          [0, 420, 226],
          [0.24, 420, 226],
          [0.31, 82, 190],
          [0.55, 82, 190],
          [0.63, 214, 190],
          [0.86, 214, 190],
          [1, 420, 226],
        ])}
      />
    </>
  );
}

/* ── step 3: the sessions ── */

const FIRST_ROWS = [
  { name: "Import from connected chats", detail: "3 available" },
  { name: "New empty session", detail: "" },
] as const;

function SessionsScene() {
  return (
    <>
      <Anim poster={false} tl={leave(0.42)} style={at(0, 0, STAGE.width, STAGE.height)}>
        <span style={{ ...at(148, 22), ...words(13, 500, t.text) }}>Add your first session</span>
        <div style={{ ...at(148, 48, 296, 96), ...MODULE }}>
          {FIRST_ROWS.map((row, index) => (
            <div key={row.name} style={{ ...ROW, height: 47, padding: "0 12px", boxSizing: "border-box", ...(index > 0 ? { borderTop: `1px solid ${t.hairlineModule}` } : null) }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, boxSizing: "border-box", borderRadius: 4, background: t.inset, border: `1px solid ${t.tileBorder}` }} />
              <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
                <span style={words(12, 500, t.text)}>{row.name}</span>
                {row.detail ? <span style={words(11, 400, t.label)}>{row.detail}</span> : null}
              </span>
              <Glyph name="chev" size={16} color={t.label} />
            </div>
          ))}
        </div>
        <Anim poster={false} tl={between(0.17, 0.39)} style={{ ...at(164, 92, 264, 48), ...WINDOW, ...ROW, padding: "0 12px" }}>
          <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
            <span style={words(12, 500, t.text)}>Bakery ordering site</span>
            <span style={words(11, 400, t.label)}>Claude, 3 prompts, today</span>
          </span>
          <MiniButton>Add</MiniButton>
        </Anim>
      </Anim>

      <Anim tl={enter(0.45, STILL)} style={at(0, 0, STAGE.width, STAGE.height)}>
        <SessionHead left={88} top={18} />
        {[0, 1, 2].map((index) => (
          <Anim key={index} tl={enter(0.51 + index * 0.07, FALL)} style={at(88, 50 + index * 46, 416, 38)}>
            <StepTile number={<StepNumber now={index + 1} />} kind="Prompt" bar={[230, 170, 204][index]} />
          </Anim>
        ))}
        <Anim tl={enter(0.76)} style={{ ...at(0, 204, STAGE.width), textAlign: "center", ...words(12, 400, t.text2) }}>
          Only your prompts are copied. The answers stay private.
        </Anim>
      </Anim>

      <Pointer
        presses={[0.135, 0.335]}
        way={path([
          [0, 500, 214],
          [0.04, 500, 214],
          [0.12, 300, 76],
          [0.22, 300, 76],
          [0.31, 398, 120],
          [0.4, 398, 120],
          [0.5, 530, 214],
          [1, 530, 214],
        ])}
      />
    </>
  );
}

/* ── step 4: the steps ── */

const KINDS = [
  { name: "Prompt", says: "Message sent to a model" },
  { name: "Agent", says: "Single agent or a team" },
  { name: "Tool", says: "External app the model used" },
  { name: "File", says: "File the model read" },
] as const;

/** How far a tile travels to change places with its neighbour: its height and the gap. */
const SWAP = 44;

function StepsScene() {
  return (
    <>
      <SessionHead left={88} top={14} />
      <div style={at(88, 44, 416, 36)}>
        <StepTile number={<StepNumber now={1} />} kind="Prompt" bar={220} />
      </div>
      <Anim tl={shift(0.5, 0.57, `translateY(${SWAP}px)`)} style={{ ...at(88, 88, 416, 36), transform: `translateY(${SWAP}px)` }}>
        <StepTile number={<StepNumber now={3} was={2} at={0.57} />} kind="Prompt" bar={176} />
      </Anim>
      <Anim tl={shift(0.46, 0.57, `translateY(-${SWAP}px)`)} style={{ ...at(88, 132, 416, 36), transform: `translateY(-${SWAP}px)`, zIndex: 2 }}>
        <Anim tl={enter(0.31, FALL)} style={{ width: "100%", height: "100%" }}>
          <StepTile number={<StepNumber now={2} was={3} at={0.57} />} kind="Tool" name="Stripe" />
        </Anim>
      </Anim>
      <div style={{ ...at(88, 182), ...ROW }}>
        <Glyph name="plus" size={16} color={t.text2} />
        <span style={words(12, 500, t.text2)}>Add step</span>
      </div>

      <Anim poster={false} tl={between(0.12, 0.27)} style={{ ...at(88, 74, 328, 100), ...WINDOW, zIndex: 3, display: "grid", gridTemplateColumns: "1fr 1fr", alignContent: "center", padding: "0 4px" }}>
        {KINDS.map((kind) => (
          <span key={kind.name} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 8px" }}>
            <span style={words(12, 500, t.text)}>{kind.name}</span>
            <span style={words(11, 400, t.label)}>{kind.says}</span>
          </span>
        ))}
      </Anim>
      <Anim poster={false} tl={between(0.63, 0.9)} style={{ ...at(210, 204, 172, 36), ...WINDOW, ...ROW, zIndex: 3, justifyContent: "space-between", padding: "0 6px 0 12px" }}>
        <span style={words(12, 500, t.text)}>Step moved</span>
        <MiniButton>Undo</MiniButton>
      </Anim>

      <Pointer
        presses={[0.1, 0.245]}
        way={path([
          [0, 520, 222],
          [0.02, 520, 222],
          [0.09, 120, 192],
          [0.15, 120, 192],
          [0.23, 130, 144],
          [0.34, 130, 144],
          [0.43, 300, 150],
          [0.46, 300, 150],
          [0.57, 300, 106],
          [0.66, 300, 106],
          [0.76, 520, 222],
          [1, 520, 222],
        ])}
      />
    </>
  );
}

/* ── step 5: the checklist ── */

const REQUIRED = ["Cover picture or video", "Title", "Description", "Prompt"] as const;

function PublishScene() {
  return (
    <>
      <div style={{ ...at(156, 12, 280, 224), ...WINDOW, overflow: "hidden" }}>
        <span style={{ ...at(16, 14), ...words(13, 500, t.text) }}>Publish checklist</span>
        <span style={{ ...at(16, 38), ...words(11, 400, t.label) }}>Required</span>
        {REQUIRED.map((name, index) => (
          <div key={name} style={{ ...at(16, 60 + index * 28), ...ROW }}>
            <span style={{ position: "relative", width: 16, height: 16, flexShrink: 0, boxSizing: "border-box", borderRadius: 8, border: `1px solid ${t.controlBorder}` }}>
              <Anim inline tl={enter(0.14 + index * 0.11, "scale(0.5)")} style={{ position: "absolute", inset: -1, borderRadius: 8, background: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Glyph name="check" size={12} color={t.window} />
              </Anim>
            </span>
            <span style={words(12, 400, t.text)}>{name}</span>
          </div>
        ))}
        <div style={{ ...at(0, 176, 280, 48), background: t.windowFoot, borderTop: `1px solid ${t.hairlineModule}` }}>
          <Anim poster={false} tl={leave(0.55)} style={{ ...at(16, 16), ...words(11, 400, t.label) }}>
            Complete the required items
          </Anim>
          <Anim tl={enter(0.58, STILL)} style={{ ...at(16, 16), ...words(11, 400, t.text2) }}>
            Ready to publish
          </Anim>
          <MiniButton quiet style={at(204, 12, 60, 24)}>
            Publish
          </MiniButton>
          <Anim tl={enter(0.58, STILL)} style={at(204, 12, 60, 24)}>
            <MiniButton primary style={{ width: "100%" }}>
              Publish
            </MiniButton>
          </Anim>
        </div>
        <Anim poster={false} tl={enter(0.78, STILL)} style={{ ...at(0, 0, 280, 224), background: t.window, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 16, background: t.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Glyph name="check" size={16} color={t.window} />
          </span>
          <span style={words(14, 500, t.text)}>Published</span>
          <span style={words(12, 400, t.text2)}>Your build is public.</span>
        </Anim>
      </div>

      <Pointer
        presses={[0.725]}
        way={path([
          [0, 500, 70],
          [0.58, 500, 70],
          [0.7, 392, 216],
          [0.84, 392, 216],
          [1, 500, 70],
        ])}
      />
    </>
  );
}

const SCENES: Record<TutorialScene, () => ReactNode> = {
  layout: LayoutScene,
  post: PostScene,
  sessions: SessionsScene,
  steps: StepsScene,
  publish: PublishScene,
};

/* ── the player ── */

const readFrames = (el: HTMLElement): Keyframe[] | null => {
  try {
    return JSON.parse(el.dataset.tl ?? "") as Keyframe[];
  } catch {
    return null;
  }
};

/** Play every timeline under `root`, together, round and round. Returns the animations; none under reduced motion. */
export function playScene(root: HTMLElement): Animation[] {
  if (prefersReducedMotion()) return [];
  const runs: Animation[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("[data-tl]")) {
    const frames = readFrames(el);
    if (!frames || typeof el.animate !== "function") continue;
    runs.push(el.animate(frames, { duration: SCENE_LOOP_MS, iterations: Infinity }));
  }
  return runs;
}

/** The stage's width where it stands, so the scene can be scaled to it as one piece. */
function useFit(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(Math.min(1, width / STAGE.width));
    };
    fit();
    if (typeof ResizeObserver !== "function") return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, scale];
}

/** Whether an example will move at all here: not under reduced motion, and not where the browser cannot animate. */
export const sceneMoves = (): boolean => !prefersReducedMotion() && typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

const stageStyle = (scale: number): CSSProperties => ({
  position: "relative",
  display: "block",
  width: "100%",
  height: Math.round(STAGE.height * scale),
  padding: 0,
  overflow: "hidden",
  boxSizing: "border-box",
  borderRadius: 8,
  background: t.well,
  border: `1px solid ${t.wellBorder}`,
  boxShadow: t.wellShadow,
  textAlign: "left",
});

export function ScenePlayer({ scene }: { scene: TutorialScene }) {
  const [fitRef, scale] = useFit();
  const stage = useRef<HTMLDivElement | null>(null);
  const runs = useRef<Animation[]>([]);
  const [moves] = useState(sceneMoves);
  const [paused, setPaused] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  useEffect(() => {
    if (!stage.current) return;
    const made = playScene(stage.current);
    runs.current = made;
    setPaused(false);
    return () => {
      for (const run of made) run.cancel();
      runs.current = [];
    };
  }, [scene]);

  const toggle = () => {
    for (const run of runs.current) {
      if (paused) run.play();
      else run.pause();
    }
    setPaused(!paused);
  };

  const Scene = SCENES[scene];
  const picture = (
    <div ref={stage} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      <Anim key={scene} tl={TURN} style={{ position: "absolute", inset: 0 }}>
        <Scene />
      </Anim>
    </div>
  );
  return (
    <div ref={fitRef} style={{ width: "100%", minWidth: 0 }}>
      {moves ? (
        <button
          type="button"
          data-testid="tutorial-example"
          data-scene={scene}
          data-paused={paused ? "true" : undefined}
          aria-label={paused ? TUTORIAL_COPY.play : TUTORIAL_COPY.pause}
          aria-pressed={paused}
          onClick={toggle}
          {...handlers}
          style={{ ...stageStyle(scale), cursor: "pointer", ...ring(state.focusVisible) }}
        >
          {picture}
          {paused ? <span style={{ ...tagStyle, position: "absolute", right: 8, top: 8 }}>{TUTORIAL_COPY.paused}</span> : null}
        </button>
      ) : (
        <div data-testid="tutorial-example" data-scene={scene} style={stageStyle(scale)}>
          {picture}
        </div>
      )}
    </div>
  );
}
