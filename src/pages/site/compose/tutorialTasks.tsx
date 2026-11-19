/* The tutorial's chapters: one build made in eight challenges, on a small copy of the editor.

   ONE BUILD, CARRIED FROM CHAPTER TO CHAPTER. The left of every stage is "Your build": the build so far, as the List would
   draw it (parts, sessions, numbered steps), read from `builtAt(chapter, done)`. It starts empty and grows a row or two each
   chapter; what the chapter in hand has added is drawn in the text colour with a mark, the rest is quiet. The right of the
   stage is where the chapter's work is done.

   A CHALLENGE IS ITS GOALS, ONE AT A TIME (tutorialSteps.ts). The window keeps the count of goals cleared (`done`) and hands it
   here; a chapter draws its stage as it stands after that many, and reports every press on a target with `hit(id)`. Whether
   the press was the right one is the window's to say. So a chapter holds nothing of the game but what is under the finger: a
   drag.

   THE NUMBERS follow the editor's own rules (src/lib/build/graph.ts): steps count straight down the whole build, across
   sessions and parts; a tool or a file added from Add step is numbered like a prompt; an agent's instructions are n.1 and its
   prompts n.2 onward; a team's agents are n.1 onward.

   TARGETS ARE REAL BUTTONS, each with a name, laid over the picture: the stage can be worked with Tab and Enter as well as a
   pointer. A target's hit area is at least 68 by 68 on the stage, so it is still 44 by 44 once a phone's sheet has scaled the
   stage down; the ring that points at it when a hint is due is drawn round the thing itself.

   THE TWO DRAGS (the Stripe tool in chapter 2, Session 2 in chapter 4) each have a button that does the same, for a keyboard
   and for anyone who would rather press.

   SHOW ME (`TaskDemo`) plays the same chapter by itself: it points at each goal's target, then clears it, and starts over once
   the chapter is done. Its targets are not buttons: the whole stage is one, which pauses it. */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { BASE } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { tagStyle, tnum } from "./refinedStyles";
import { MODULE, MiniButton, ROW, STAGE, SessionHead, StepTile, WINDOW, at, play, stageStyle, useFit, words } from "./tutorialScenes";
import { TUTORIAL_COPY, TUTORIAL_STEPS, buildCount, builtAt, outlineOf, type TutorialScene } from "./tutorialSteps";

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
/** The work area's left edge. */
const WX = 176;
/** The work area's width. */
const WW = 404;
/** One row of "Your build". */
const OUTLINE_ROW = 17;

/** A place in the work area, on the stage. */
const w = (left: number, top: number, width?: number, height?: number): CSSProperties => at(WX + left, top, width, height);
/** A box in the work area, on the stage. */
const wb = (left: number, top: number, width: number, height: number): Box => [WX + left, top, width, height];

/** The chapter a scene belongs to. */
export const chapterOf = (scene: TutorialScene): number => Math.max(0, TUTORIAL_STEPS.findIndex((step) => step.scene === scene));

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
    <div style={{ ...MODULE, ...ROW, width: "100%", height: "100%", boxSizing: "border-box", padding: "0 12px" }}>
      <Glyph name="chev" size={16} color={t.label} />
      <span style={words(12, 500, t.text)}>{`Session ${number}`}</span>
      <span style={tagStyle}>{app}</span>
      <span style={{ ...words(11, 400, t.label), marginLeft: "auto" }}>{steps}</span>
      {end}
    </div>
  );
}

/** The small square button the List puts at a step's right: a move arrow. */
function Arrow({ glyph }: { glyph: "up" | "chevd" }) {
  return (
    <span style={{ width: 24, height: 24, boxSizing: "border-box", borderRadius: 6, background: t.control, border: `1px solid ${t.controlBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={16} color={t.text2} />
    </span>
  );
}

/** A choice in a menu: its name and one line. */
function Choice({ name, says, style }: { name: string; says: string; style?: CSSProperties }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "0 20px", boxSizing: "border-box", ...style }}>
      <span style={words(13, 500, t.text)}>{name}</span>
      <span style={words(12, 400, t.label)}>{says}</span>
    </span>
  );
}

/* ── "Your build" ── */

/** The build so far, on the left of every stage. Rows this chapter added are in the text colour with a mark. */
function Outline({ chapter, done }: { chapter: number; done: number }) {
  const built = builtAt(chapter, done);
  const before = new Set(outlineOf(builtAt(chapter, 0)).map((row) => row.key));
  const rows = outlineOf(built);
  const count = buildCount(built);
  return (
    <>
      <div data-testid="tutorial-build" style={{ ...at(12, 12, OUTLINE_WIDTH - 24), display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={words(12, 500, t.text)}>{TUTORIAL_COPY.build.title}</span>
        <span data-testid="tutorial-build-count" style={words(11, 400, t.label)}>
          {count ?? TUTORIAL_COPY.build.empty}
        </span>
      </div>
      <div data-testid="tutorial-outline" style={{ ...at(20, 52, OUTLINE_WIDTH - 32), display: "flex", flexDirection: "column" }}>
        {rows.map((row) => {
          const fresh = !before.has(row.key);
          const line = (
            <div
              key={row.key}
              data-row={row.key}
              data-new={fresh ? "true" : undefined}
              style={{ position: "relative", height: OUTLINE_ROW, display: "flex", alignItems: "center", gap: 4, paddingLeft: row.kind === "part" ? 0 : row.kind === "session" ? 8 : 16, boxSizing: "border-box" }}
            >
              {fresh ? <span aria-hidden="true" style={{ position: "absolute", left: -8, top: 7, width: 4, height: 4, borderRadius: 2, background: t.text }} /> : null}
              {row.number ? <span style={{ ...words(11, 400, fresh ? t.text2 : t.label), ...tnum, minWidth: 16 }}>{row.number}</span> : null}
              <span style={words(11, row.kind === "step" ? 400 : 500, fresh ? t.text : t.label)}>{row.empty ? `${row.text} · empty` : row.text}</span>
            </div>
          );
          return fresh ? (
            <Pop key={row.key} from="translateY(4px)">
              {line}
            </Pop>
          ) : (
            line
          );
        })}
      </div>
      <span aria-hidden="true" style={{ ...at(OUTLINE_WIDTH, 12, 1, STAGE.height - 24), background: t.hairline }} />
    </>
  );
}

/* ── a drag ── */

/** How far a tile has been pulled, in the direction it goes (1 down, -1 up), measured on the screen and applied on the stage. */
function useDrag(enabled: boolean, direction: 1 | -1, travel: number, onFar: () => void) {
  const scale = useContext(StageScale);
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  /** How far it had been pulled when it was let go, so it settles from there. */
  const letGo = useRef(0);
  const far = pull >= travel / 2;
  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      start.current = event.clientY;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      setPull(Math.min(travel + 8, Math.max(-8, ((event.clientY - start.current) / scale) * direction)));
    },
    onPointerUp: () => {
      if (start.current === null) return;
      start.current = null;
      letGo.current = far ? pull : 0;
      setPull(0);
      if (far) onFar();
    },
  };
  return { pull, far, letGo, handlers: { ...handlers, onPointerCancel: handlers.onPointerUp } };
}

/** Once, when a move has been made: the tile settles into its new place from where it was let go. */
function useSettle(moved: boolean, tiles: { el: () => HTMLElement | null; from: (lifted: number, far: boolean) => number | null }[], letGo: { current: number }) {
  const settled = useRef(moved);
  useLayoutEffect(() => {
    if (!moved || settled.current) return;
    settled.current = true;
    const lifted = letGo.current;
    for (const tile of tiles) {
      const from = tile.from(lifted, lifted > 0);
      if (from !== null) play(tile.el(), [{ transform: `translateY(${from}px)` }, { transform: "none" }], { duration: BASE });
    }
    // Once, as the move is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moved]);
}

/* ── chapter 1: the first chat ── */

const FIRST_ROW = 72;

function ConversationTask(task: TaskProps) {
  if (task.done >= 2) {
    return (
      <>
        <SessionHead number={1} style={w(0, 12)} />
        {[0, 1].map((index) => (
          <Pop key={index} from="translateY(-8px)" delay={index * 110} style={w(0, 44 + index * 44, WW, 36)}>
            <StepTile number={index + 1} kind="Prompt" bar={[260, 200][index]} />
          </Pop>
        ))}
        <Pop delay={330} style={{ ...w(0, 148, WW), ...words(12, 400, t.text2), whiteSpace: "normal" }}>
          Only your prompts are copied. The answers stay private in your import.
        </Pop>
      </>
    );
  }
  if (task.done === 1) {
    return (
      <>
        <span style={{ ...w(0, 12), ...words(13, 500, t.text) }}>Your connected chats</span>
        <Pop style={{ ...w(0, 44, WW, FIRST_ROW), ...MODULE, ...ROW, boxSizing: "border-box", padding: "0 12px" }}>
          <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
            <span style={words(12, 500, t.text)}>Bakery ordering site</span>
            <span style={words(11, 400, t.label)}>Claude, 2 prompts, today</span>
          </span>
          <MiniButton>Add</MiniButton>
        </Pop>
        <Target id="add" label="Add Bakery ordering site" zone={wb(0, 44, WW, FIRST_ROW)} task={task} />
      </>
    );
  }
  const rows = [
    { id: "import", name: "Import from connected chats", detail: "Claude, Claude Code, ChatGPT, Cursor" },
    { id: "empty", name: "New empty session", detail: "Type the prompts yourself" },
  ];
  return (
    <>
      <span style={{ ...w(0, 12), ...words(13, 500, t.text) }}>Add your first session</span>
      <div style={{ ...w(0, 44, WW, FIRST_ROW * 2), ...MODULE, boxSizing: "border-box" }}>
        {rows.map((row, index) => (
          <div key={row.id} style={{ ...ROW, height: FIRST_ROW - 1, padding: "0 12px", boxSizing: "border-box", ...(index > 0 ? { borderTop: `1px solid ${t.hairlineModule}` } : null) }}>
            <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
              <span style={words(12, 500, t.text)}>{row.name}</span>
              <span style={words(11, 400, t.label)}>{row.detail}</span>
            </span>
            <Glyph name="chev" size={16} color={t.label} />
          </div>
        ))}
      </div>
      {rows.map((row, index) => (
        <Target key={row.id} id={row.id} label={row.name} zone={wb(0, 44 + index * FIRST_ROW, WW, FIRST_ROW)} task={task} />
      ))}
    </>
  );
}

/* ── the Add step menus (chapters 2, 5 and 6) ── */

const KINDS = [
  { id: "prompt", name: "Prompt", says: "A message to the model" },
  { id: "agent", name: "Agent", says: "A model with its own instructions" },
  { id: "tool", name: "Tool", says: "An app the model used" },
  { id: "file", name: "File", says: "A document the model read" },
] as const;

/** The four kinds, in a grid of cells big enough to press on a phone. */
function KindMenu({ task, top = 28 }: { task: TaskProps; top?: number }) {
  return (
    <>
      <Pop style={{ ...w(0, top, WW, 176), ...WINDOW, boxSizing: "border-box", zIndex: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        {KINDS.map((kind) => (
          <Choice key={kind.id} name={kind.name} says={kind.says} />
        ))}
      </Pop>
      {KINDS.map((kind, index) => (
        <Target key={kind.id} id={kind.id} label={kind.name} zone={wb((index % 2) * (WW / 2), top + Math.floor(index / 2) * 88, WW / 2, 88)} task={task} />
      ))}
    </>
  );
}

/** What kind of agent: one, or a team. */
function AgentMenu({ task, top = 44 }: { task: TaskProps; top?: number }) {
  const types = [
    { id: "single", name: "Single agent", says: "One model working alone" },
    { id: "team", name: "Multi-agent team", says: "Several agents on one job" },
  ] as const;
  return (
    <>
      <Pop style={{ ...w(0, top, WW, 136), ...WINDOW, boxSizing: "border-box", zIndex: 3, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {types.map((type) => (
          <Choice key={type.id} name={type.name} says={type.says} />
        ))}
      </Pop>
      {types.map((type, index) => (
        <Target key={type.id} id={type.id} label={type.name} zone={wb(index * (WW / 2), top, WW / 2, 136)} task={task} />
      ))}
    </>
  );
}

/* ── chapter 2: a tool, moved up ── */

/** The distance between two steps, top to top. */
const PITCH = 44;

function ToolsTask(task: TaskProps) {
  const added = task.done >= 2;
  const moved = task.done >= 3;
  const holding = task.done === 2;
  const toolRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const drag = useDrag(holding, -1, PITCH, () => task.hit("move"));
  useSettle(
    moved,
    [
      { el: () => toolRef.current, from: (lifted) => PITCH - lifted },
      { el: () => promptRef.current, from: (_lifted, far) => (far ? null : -PITCH) },
    ],
    drag.letGo,
  );

  const ahead = holding && drag.far;
  const swapped = moved || ahead;
  return (
    <>
      <SessionHead number={1} style={w(0, 8)} />
      <div style={w(0, 36, WW, 36)}>
        <StepTile number={1} kind="Prompt" bar={260} />
      </div>
      <div ref={promptRef} style={{ ...w(0, moved ? 124 : 80, WW, 36), transform: ahead ? `translateY(${PITCH}px)` : undefined }}>
        <StepTile number={swapped ? 3 : 2} kind="Prompt" bar={200} />
      </div>
      {added ? (
        <div
          ref={toolRef}
          data-testid="tutorial-drag"
          {...drag.handlers}
          style={{ ...w(0, moved ? 80 : 124, WW, 36), zIndex: 2, transform: drag.pull ? `translateY(${-drag.pull}px)` : undefined, touchAction: holding ? "none" : undefined, cursor: holding ? "grab" : undefined }}
        >
          <Pop from="translateY(-8px)" style={{ width: "100%", height: "100%" }}>
            <StepTile number={swapped ? 2 : 3} kind="Tool" name="Stripe" end={holding ? <Arrow glyph="up" /> : undefined} />
          </Pop>
        </div>
      ) : null}
      <AddRow words="Add step" style={w(0, added ? 176 : 128)} />

      {task.done === 0 ? <Target id="add" label="Add step" zone={wb(0, 100, WW, 72)} around={wb(0, 122, 108, 28)} task={task} /> : null}
      {task.done === 1 ? <KindMenu task={task} /> : null}
      {holding ? <Target id="move" label="Move the Tool step up" zone={wb(332, 104, 72, 72)} around={wb(0, 120, WW, 44)} task={task} /> : null}
    </>
  );
}

/* ── chapter 3: a second session ── */

function SessionsTask(task: TaskProps) {
  if (task.done >= 3) {
    return (
      <>
        <Pop style={{ ...w(24, 52, 150, 48), ...MODULE, ...ROW, justifyContent: "center", boxSizing: "border-box" }}>
          <Glyph name="layers" size={16} color={t.text2} />
          <span style={words(13, 500, t.text)}>Session 1</span>
        </Pop>
        <Pop delay={110} style={{ ...w(230, 52, 150, 48), ...MODULE, ...ROW, justifyContent: "center", boxSizing: "border-box" }}>
          <Glyph name="layers" size={16} color={t.text2} />
          <span style={words(13, 500, t.text)}>Session 2</span>
        </Pop>
        <Pop from="none" delay={220} style={{ ...w(174, 76, 56, 1), background: t.text }} />
        <Pop delay={330} style={{ ...w(0, 116, WW), textAlign: "center", ...words(12, 400, t.text2) }}>
          Session 2 reads the menu Session 1 made.
        </Pop>
      </>
    );
  }
  if (task.done === 2) {
    return (
      <>
        <span style={{ ...w(0, 24), ...words(12, 400, t.text2) }}>Two sessions in the build.</span>
        <div style={w(0, 80, WW, 36)}>
          <SessionLine number={1} app="Claude" steps="3 steps" />
        </div>
        <Pop style={w(0, 124, WW, 36)}>
          <SessionLine number={2} app="Claude Code" steps="2 steps" />
        </Pop>
        <Pop style={{ ...w(348, 30) }}>
          <MiniButton>Map</MiniButton>
        </Pop>
        <Target id="map" label="Map" zone={wb(316, 4, 88, 72)} around={wb(340, 24, 64, 36)} task={task} />
      </>
    );
  }
  if (task.done === 1) {
    return (
      <>
        <span style={{ ...w(0, 12), ...words(13, 500, t.text) }}>Add a session from a chat</span>
        <div style={{ ...w(0, 36, WW, 144), ...MODULE, boxSizing: "border-box" }}>
          {[
            { name: "Bakery ordering site", detail: "Already in the build" },
            { name: "Admin dashboard", detail: "Claude Code, 2 prompts, today" },
          ].map((row, index) => (
            <div key={row.name} style={{ ...ROW, height: 71, padding: "0 12px", boxSizing: "border-box", ...(index > 0 ? { borderTop: `1px solid ${t.hairlineModule}` } : null) }}>
              <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
                <span style={words(12, 500, index === 0 ? t.label : t.text)}>{row.name}</span>
                <span style={words(11, 400, t.label)}>{row.detail}</span>
              </span>
              <Glyph name="chev" size={16} color={t.label} />
            </div>
          ))}
        </div>
        <Target id="bakery" label="Bakery ordering site" zone={wb(0, 36, WW, 72)} task={task} />
        <Target id="admin" label="Admin dashboard" zone={wb(0, 108, WW, 72)} task={task} />
      </>
    );
  }
  return (
    <>
      <div style={w(0, 12, WW, 36)}>
        <SessionLine number={1} app="Claude" steps="3 steps" />
      </div>
      <AddRow words="Add session" style={w(0, 68)} />
      <Target id="session" label="Add session" zone={wb(0, 56, WW, 72)} around={wb(0, 62, 124, 28)} task={task} />
    </>
  );
}

/* ── chapter 4: parts, and a session moved into one ── */

/** Where Part B's slot stands, and how far Session 2 has to go to reach it. */
const SLOT_TOP = 168;
const SESSION2_TOP = 86;
const SLOT_TRAVEL = SLOT_TOP - SESSION2_TOP;

function PartsTask(task: TaskProps) {
  const partsMade = task.done >= 1;
  const moved = task.done >= 2;
  const holding = task.done === 1;
  const sessionRef = useRef<HTMLDivElement | null>(null);
  const drag = useDrag(holding, 1, SLOT_TRAVEL, () => task.hit("move"));
  useSettle(moved, [{ el: () => sessionRef.current, from: (lifted) => -(SLOT_TRAVEL - lifted) }], drag.letGo);

  if (!partsMade) {
    return (
      <>
        <div style={w(0, 12, WW, 36)}>
          <SessionLine number={1} app="Claude" steps="3 steps" />
        </div>
        <div style={w(0, 56, WW, 36)}>
          <SessionLine number={2} app="Claude Code" steps="2 steps" />
        </div>
        <AddRow words="Add part" style={w(0, 112)} />
        <Target id="part" label="Add part" zone={wb(0, 100, WW, 72)} around={wb(0, 106, 100, 28)} task={task} />
      </>
    );
  }
  return (
    <>
      <Pop style={{ ...w(0, 8), ...words(12, 500, t.text) }}>Part A</Pop>
      <div style={w(0, 34, WW, 36)}>
        <SessionLine number={1} app="Claude" steps="3 steps" />
      </div>
      {moved ? null : (
        <div
          ref={sessionRef}
          data-testid="tutorial-drag"
          {...drag.handlers}
          style={{ ...w(0, SESSION2_TOP - 8, WW, 36), zIndex: 2, transform: drag.pull ? `translateY(${drag.pull}px)` : undefined, touchAction: "none", cursor: "grab" }}
        >
          <SessionLine number={2} app="Claude Code" steps="2 steps" end={<Arrow glyph="chevd" />} />
        </div>
      )}
      <Pop delay={110} style={{ ...w(0, SLOT_TOP - 36), ...words(12, 500, t.text) }}>
        Part B
      </Pop>
      {moved ? (
        <div ref={sessionRef} style={w(0, SLOT_TOP - 8, WW, 36)}>
          <SessionLine number={2} app="Claude Code" steps="2 steps" />
        </div>
      ) : (
        <div style={{ ...w(0, SLOT_TOP - 8, WW, 36), borderRadius: 8, border: `1px dashed ${t.hairline}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", ...words(11, 400, t.label) }}>
          Drop a session here
        </div>
      )}
      {holding ? <Target id="move" label="Move Session 2 into Part B" zone={wb(332, 62, 72, 72)} around={wb(0, SESSION2_TOP - 8, WW, 36)} task={task} /> : null}
    </>
  );
}

/* ── chapter 5: one agent ── */

function AgentTask(task: TaskProps) {
  const made = task.done >= 3;
  const prompted = task.done >= 4;
  return (
    <>
      <SessionHead number={2} app="Claude Code" style={w(0, 4)} />
      <div style={w(0, 28, WW, 28)}>
        <StepTile number={4} kind="Prompt" bar={220} />
      </div>
      <div style={w(0, 62, WW, 28)}>
        <StepTile number={5} kind="Prompt" bar={170} />
      </div>
      {made ? (
        <>
          <Pop from="translateY(-8px)" style={w(0, 98, WW, 28)}>
            <StepTile number={6} kind="Agent" name="Order helper" />
          </Pop>
          <Pop from="translateY(-8px)" delay={110} style={w(24, 130, WW - 24, 28)}>
            <StepTile number="6.1" kind="Instructions" bar={140} />
          </Pop>
          {prompted ? (
            <Pop from="translateY(-8px)" style={w(24, 162, WW - 24, 28)}>
              <StepTile number="6.2" kind="Prompt" bar={160} />
            </Pop>
          ) : (
            <AddRow words="Add prompt" style={w(32, 168)} />
          )}
        </>
      ) : (
        <AddRow words="Add step" style={w(0, 102)} />
      )}

      {task.done === 0 ? <Target id="add" label="Add step" zone={wb(0, 92, WW, 72)} around={wb(0, 96, 108, 28)} task={task} /> : null}
      {task.done === 1 ? <KindMenu task={task} /> : null}
      {task.done === 2 ? <AgentMenu task={task} /> : null}
      {made && !prompted ? <Target id="prompt" label="Add prompt" zone={wb(0, 150, WW, 72)} around={wb(24, 162, 128, 28)} task={task} /> : null}
    </>
  );
}

/* ── chapter 6: a team of agents ── */

const TEAM = [
  { number: "7.1", name: "Writer", lead: true },
  { number: "7.2", name: "Reviewer", lead: false },
  { number: "7.3", name: "Photographer", lead: false },
] as const;

function TeamTask(task: TaskProps) {
  const made = task.done >= 3;
  const third = task.done >= 4;
  const members = third ? 3 : 2;
  return (
    <>
      <SessionHead number={2} app="Claude Code" style={w(0, 4)} />
      <div style={w(0, 28, WW, 28)}>
        <StepTile number="4-6" kind="Prompts and an agent" bar={90} />
      </div>
      {made ? (
        <>
          <Pop from="translateY(-8px)" style={w(0, 62, WW, 28)}>
            <StepTile number={7} kind="Team" name="Launch team" />
          </Pop>
          {TEAM.slice(0, members).map((member, index) => (
            <Pop key={member.number} from="translateY(-8px)" delay={index === 2 ? 0 : 110 + index * 110} style={w(24, 94 + index * 32, WW - 24, 28)}>
              <StepTile number={member.number} kind="Agent" name={member.name} end={member.lead ? <span style={tagStyle}>Leads</span> : undefined} />
            </Pop>
          ))}
          {third ? null : <AddRow words="Add agent" style={w(32, 94 + 2 * 32 + 6)} />}
        </>
      ) : (
        <AddRow words="Add step" style={w(0, 68)} />
      )}

      {task.done === 0 ? <Target id="add" label="Add step" zone={wb(0, 58, WW, 72)} around={wb(0, 62, 108, 28)} task={task} /> : null}
      {task.done === 1 ? <KindMenu task={task} top={52} /> : null}
      {task.done === 2 ? <AgentMenu task={task} top={52} /> : null}
      {made && !third ? <Target id="member" label="Add agent" zone={wb(0, 144, WW, 72)} around={wb(24, 154, 120, 28)} task={task} /> : null}
    </>
  );
}

/* ── chapter 7: the post ── */

function ToolGlyph({ left, name }: { left: number; name: "image" | "listBullet" | "listNumber" }) {
  return (
    <span style={{ ...w(left, 184, 16, 16) }}>
      <Glyph name={name} size={16} color={t.text2} />
    </span>
  );
}

function PostTask(task: TaskProps) {
  const covered = task.done >= 1;
  const referenced = task.done >= 2;
  return (
    <>
      <span style={{ ...w(0, 12, 28, 28), borderRadius: 14, background: t.avatarFill, border: `1px solid ${t.tileBorder}`, boxSizing: "border-box" }} />
      <div style={{ ...w(40, 12), ...words(13, 400, t.text) }}>A bakery ordering site, built in two sessions</div>
      <div style={{ ...w(40, 34), ...words(13, 400, t.text) }}>
        {"and finished by a "}
        <span style={{ position: "relative" }}>
          {referenced ? <Pop from="none" style={{ position: "absolute", left: -2, right: -2, top: -1, bottom: -1, borderRadius: 4, background: t.findFill }} /> : null}
          <span style={{ position: "relative" }}>launch team</span>
        </span>
        .
      </div>
      {referenced ? (
        <Pop style={{ ...w(252, 30), ...tagStyle, ...WINDOW, borderRadius: 4, maxWidth: "none", color: t.text }}>Step 7</Pop>
      ) : null}
      {covered ? (
        <Pop style={{ ...w(40, 66, 148, 80), borderRadius: 6, background: t.inset, border: `1px solid ${t.tileBorder}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name="image" size={16} color={t.label} />
          <span style={{ ...tagStyle, position: "absolute", left: 8, top: 8, maxWidth: "none" }}>Cover</span>
        </Pop>
      ) : null}

      <ToolGlyph left={20} name="image" />
      <ToolGlyph left={52} name="listBullet" />
      <ToolGlyph left={84} name="listNumber" />
      <div style={{ ...w(140, 184), ...ROW, gap: 6 }}>
        <Glyph name="reference" size={16} color={t.text2} />
        <span style={words(12, 500, t.text2)}>Reference</span>
      </div>
      <span style={{ ...w(364, 176, 32, 32), borderRadius: 16, background: t.control, border: `1px solid ${t.controlBorder}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph name="plus" size={16} color={t.text2} />
      </span>
      <span style={{ ...w(0, 168, WW, 1), background: t.hairline }} />

      {task.goal ? (
        <>
          <Target id="picture" label="Picture or video" zone={wb(0, 164, 72, 72)} around={wb(8, 176, 40, 32)} task={task} />
          <Target id="reference" label="Reference" zone={wb(128, 164, 112, 72)} around={wb(132, 176, 100, 32)} task={task} />
        </>
      ) : null}
    </>
  );
}

/* ── chapter 8: check it, then publish ── */

const REQUIRED = ["Title", "Description", "Cover picture or video", "At least one prompt"] as const;
const MISSING = "Title";

function PublishTask(task: TaskProps) {
  const titled = task.done >= 1;
  const published = task.done >= 2;
  return (
    <>
      <div style={{ ...w(62, 8, 280, 224), ...WINDOW, boxSizing: "border-box", overflow: "hidden" }}>
        <span style={{ ...at(16, 14), ...words(13, 500, t.text) }}>Publish checklist</span>
        <span style={{ ...at(16, 38), ...words(11, 400, t.label) }}>Required</span>
        {REQUIRED.map((name, index) => {
          const there = name !== MISSING || titled;
          return (
            <div key={name} style={{ ...at(16, 60 + index * 28, 248), ...ROW }}>
              <span style={{ position: "relative", width: 16, height: 16, flexShrink: 0, boxSizing: "border-box", borderRadius: 8, border: `1px solid ${t.controlBorder}` }}>
                {there ? (
                  name === MISSING ? (
                    <Pop from="scale(0.5)" style={{ position: "absolute", inset: -1 }}>
                      <Tick />
                    </Pop>
                  ) : (
                    <Tick style={{ position: "absolute", left: -1, top: -1 }} />
                  )
                ) : null}
              </span>
              <span style={{ ...words(12, 400, t.text), flexGrow: 1 }}>{name}</span>
              {there ? null : <span style={{ ...words(12, 400, t.text), textDecoration: "underline" }}>Add title</span>}
            </div>
          );
        })}
        <div style={{ ...at(0, 176, 280, 48), background: t.windowFoot, borderTop: `1px solid ${t.hairlineModule}` }}>
          <span style={{ ...at(16, 16), ...words(11, 400, titled ? t.text2 : t.label) }}>{titled ? "Ready to publish" : "Complete 1 required item"}</span>
          <MiniButton primary={titled} quiet={!titled} style={at(204, 12, 60, 24)}>
            Publish
          </MiniButton>
        </div>
        {published ? (
          <Pop from="none" style={{ ...at(0, 0, 278, 222), background: t.window, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Tick size={32} />
            <span style={words(14, 500, t.text)}>Published</span>
            <span style={words(12, 400, t.text2)}>Your build is public.</span>
          </Pop>
        ) : null}
      </div>
      {task.goal ? (
        <>
          {titled ? null : <Target id="title" label="Add title" zone={wb(62, 64, 280, 84)} around={wb(70, 86, 264, 28)} task={task} />}
          <Target id="publish" label="Publish" zone={wb(246, 164, 96, 72)} around={wb(260, 190, 72, 36)} task={task} />
        </>
      ) : null}
    </>
  );
}

const TASKS: Record<TutorialScene, (task: TaskProps) => ReactNode> = {
  conversation: ConversationTask,
  tools: ToolsTask,
  sessions: SessionsTask,
  parts: PartsTask,
  agent: AgentTask,
  team: TeamTask,
  post: PostTask,
  publish: PublishTask,
};

/** A wrong press: the stage shakes its head, once. */
const SHAKE: Keyframe[] = [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }];

/** The stage as one piece, scaled to the width it has. */
function Picture({ scene, task, scale, children }: { scene: TutorialScene; task: TaskProps; scale: number; children?: ReactNode }) {
  const Task = TASKS[scene];
  const chapter = chapterOf(scene);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      {children}
      <StageScale.Provider value={scale}>
        <Outline chapter={chapter} done={task.done} />
        <Task {...task} />
      </StageScale.Provider>
    </div>
  );
}

export interface TaskStageProps extends TaskProps {
  scene: TutorialScene;
  /** Wrong presses so far: each new one shakes the stage. */
  misses: number;
}

export function TaskStage({ scene, misses, ...task }: TaskStageProps) {
  const [fitRef, scale] = useFit();
  const frame = useRef<HTMLDivElement | null>(null);
  const shaken = useRef(misses);
  useLayoutEffect(() => {
    if (shaken.current === misses) return;
    shaken.current = misses;
    play(frame.current, SHAKE, { duration: BASE });
  }, [misses]);

  return (
    <div ref={fitRef} style={{ width: "100%", minWidth: 0 }}>
      <div ref={frame} data-testid="tutorial-task" data-scene={scene} data-done={task.done} data-cleared={task.goal === null ? "true" : undefined} style={stageStyle(scale)}>
        <Picture scene={scene} task={task} scale={scale} />
      </div>
    </div>
  );
}

/* ── Show me ── */

/** How long the pointer rests on a target, how long a cleared goal shows, and how long the finished chapter does. */
const POINT_MS = 1600;
const CLEAR_MS = 1000;
const END_MS = 2600;

/** The chapter, played by itself: the ring on each target, then the goal cleared, and round again. Pressing the stage pauses it. */
export function TaskDemo({ scene }: { scene: TutorialScene }) {
  const [fitRef, scale] = useFit();
  const goals = TUTORIAL_STEPS[chapterOf(scene)].task.goals;
  const beats = goals.length * 2;
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const last = beat === beats - 1;
    const timer = window.setTimeout(() => setBeat((now) => (now + 1) % beats), beat % 2 === 0 ? POINT_MS : last ? END_MS : CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [beat, beats, paused]);

  const done = Math.floor((beat + 1) / 2);
  const pointing = beat % 2 === 0;
  const task: TaskProps = { done, goal: pointing ? goals[done].id : null, hinting: pointing, hit: () => undefined, demo: true };
  return (
    <div ref={fitRef} style={{ width: "100%", minWidth: 0 }}>
      <button
        type="button"
        data-testid="tutorial-example"
        data-scene={scene}
        aria-label={paused ? TUTORIAL_COPY.play : TUTORIAL_COPY.pause}
        aria-pressed={paused}
        onClick={() => setPaused((was) => !was)}
        style={{ ...stageStyle(scale), cursor: "pointer", font: "inherit", color: "inherit" }}
      >
        <Picture scene={scene} task={task} scale={scale}>
          {paused ? <span style={{ ...at(STAGE.width - 76, 8), ...tagStyle, zIndex: 7 }}>{TUTORIAL_COPY.paused}</span> : null}
        </Picture>
      </button>
    </div>
  );
}
