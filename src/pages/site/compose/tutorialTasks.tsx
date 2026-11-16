/* The tutorial's challenges: each step's example as something to do, on the same small copy of the editor.

   A CHALLENGE IS ITS GOALS, ONE AT A TIME (tutorialSteps.ts). The window keeps the count of goals cleared (`done`) and hands it
   here; a task draws the stage as it stands after that many, and reports every press on a target with `hit(id)`. Whether the
   press was the right one is the window's to say. So a task holds nothing of the game but what is under the finger: a drag.

   TARGETS ARE REAL BUTTONS, each with a name, laid over the picture: the stage can be worked with Tab and Enter as well as a
   pointer. A target's hit area is wider than what it sits on (the stage shrinks on a phone, and a 24px button would not be
   pressable), and the ring that points at it when a hint is due is drawn round the thing itself.

   THE ONE DRAG (step 4) has a button beside it that does the same, for a keyboard and for anyone who would rather press.

   What arrives (a picture, a session's prompts, a moved step) comes in with one short move through `play`, which does nothing
   under reduced motion: the stage is then simply as it should be. */

import { Fragment, createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { BASE, FAST } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { tagStyle } from "./refinedStyles";
import {
  COLUMNS,
  FIRST_ROWS,
  KINDS,
  LayoutBase,
  MODULE,
  MiniButton,
  REQUIRED,
  ROW,
  STAGE,
  SWAP,
  SessionHead,
  StepNumber,
  StepTile,
  ToolGlyph,
  WINDOW,
  at,
  play,
  stageStyle,
  useFit,
  words,
} from "./tutorialScenes";
import type { TutorialScene } from "./tutorialSteps";

/** `[left, top, width, height]` on the stage. */
type Box = readonly [number, number, number, number];

export interface TaskProps {
  /** Goals cleared so far in this step. */
  done: number;
  /** The goal asked for now; null once the step is cleared. */
  goal: string | null;
  /** A hint is due: the current goal's target is pointed at. */
  hinting: boolean;
  /** A target was pressed. */
  hit: (id: string) => void;
}

/** How far the stage is scaled where it stands: a drag is measured on the screen and applied on the stage. */
const StageScale = createContext(1);

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
      {task.hinting && task.goal === id ? <HintRing box={around ?? zone} /> : null}
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

/* ── step 1: find the three columns ── */

function LayoutTask(task: TaskProps) {
  const last = task.done > 0 ? COLUMNS[task.done - 1] : null;
  return (
    <>
      <LayoutBase />
      {COLUMNS.map((column, index) => {
        const box: Box = [column.left - 8, 54, column.width + 16, 142];
        /* The line round a found column stands a little inside its zone, so two found side by side do not share an edge. */
        const frame: Box = [column.left - 6, 56, column.width + 12, 138];
        return (
          <Fragment key={column.name}>
            {index < task.done ? (
              <Pop from="none" style={{ ...at(...frame), borderRadius: 8, border: `1px solid ${t.selectedEdge}` }}>
                <Tick style={{ position: "absolute", right: 6, top: 6 }} />
              </Pop>
            ) : null}
            {task.goal ? <Target id={column.name.toLowerCase()} label={`${column.name} column`} zone={box} around={frame} task={task} /> : null}
          </Fragment>
        );
      })}
      {last ? (
        <Pop key={last.name} style={{ ...at(0, 212, STAGE.width), textAlign: "center", ...words(12, 400, t.text) }}>
          <span style={{ fontWeight: 500 }}>{last.name}</span>
          <span style={{ color: t.text2 }}>{`  ${last.says}`}</span>
        </Pop>
      ) : null}
    </>
  );
}

/* ── step 2: a picture, then a reference ── */

function PostTask(task: TaskProps) {
  return (
    <>
      <span style={{ ...at(24, 20, 36, 36), borderRadius: 18, background: t.avatarFill, border: `1px solid ${t.tileBorder}` }} />
      <div style={{ ...at(74, 28), ...words(14, 400, t.text) }}>
        {"An ordering site for a bakery, built in "}
        <span style={{ position: "relative" }}>
          {task.done >= 2 ? <Pop from="none" style={{ position: "absolute", left: -2, right: -2, top: -1, bottom: -1, borderRadius: 4, background: t.findFill }} /> : null}
          <span style={{ position: "relative" }}>one session</span>
        </span>
        .
      </div>
      {task.done >= 1 ? (
        <Pop style={{ ...at(74, 62, 148, 96), borderRadius: 6, background: t.inset, border: `1px solid ${t.tileBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name="image" size={16} color={t.label} />
          <span style={{ ...tagStyle, position: "absolute", left: 6, top: 6, maxWidth: "none" }}>Cover</span>
        </Pop>
      ) : null}
      {task.done >= 2 ? <Pop style={{ ...at(318, 52), ...tagStyle, ...WINDOW, borderRadius: 4, maxWidth: "none", color: t.text }}>Session 1</Pop> : null}

      <ToolGlyph left={74} name="image" />
      <ToolGlyph left={130} name="listBullet" />
      <ToolGlyph left={162} name="listNumber" />
      <div style={{ ...at(214, 180), ...ROW, gap: 6 }}>
        <Glyph name="reference" size={16} color={t.text2} />
        <span style={words(12, 500, t.text2)}>Reference</span>
      </div>
      <span style={{ ...at(536, 172, 32, 32), borderRadius: 16, background: t.control, border: `1px solid ${t.controlBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph name="plus" size={16} color={t.text2} />
      </span>
      <span style={{ ...at(24, 220, 544, 1), background: t.hairline }} />

      {task.goal ? (
        <>
          <Target id="picture" label="Picture or video" zone={[44, 148, 76, 72]} around={[62, 168, 40, 40]} task={task} />
          <Target id="reference" label="Reference" zone={[198, 148, 116, 72]} around={[202, 168, 108, 40]} task={task} />
        </>
      ) : null}
    </>
  );
}

/* ── step 3: import a chat ── */

const FIRST_IDS = ["import", "empty"] as const;
/** A first-session row here is taller than the example's, so it can be pressed on a phone. */
const FIRST_ROW = 72;

function SessionsTask(task: TaskProps) {
  if (task.done >= 2) {
    return (
      <>
        <SessionHead left={88} top={18} />
        {[0, 1, 2].map((index) => (
          <Pop key={index} from="translateY(-8px)" delay={index * 110} style={at(88, 50 + index * 46, 416, 38)}>
            <StepTile number={<StepNumber now={index + 1} />} kind="Prompt" bar={[230, 170, 204][index]} />
          </Pop>
        ))}
        <Pop delay={440} style={{ ...at(0, 204, STAGE.width), textAlign: "center", ...words(12, 400, t.text2) }}>
          Only your prompts are copied. The answers stay private.
        </Pop>
      </>
    );
  }
  if (task.done === 1) {
    return (
      <>
        <span style={{ ...at(148, 14), ...words(13, 500, t.text) }}>Your connected chats</span>
        <Pop style={{ ...at(148, 40, 296, FIRST_ROW), ...MODULE, ...ROW, padding: "0 12px" }}>
          <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
            <span style={words(12, 500, t.text)}>Bakery ordering site</span>
            <span style={words(11, 400, t.label)}>Claude, 3 prompts, today</span>
          </span>
          <MiniButton>Add</MiniButton>
        </Pop>
        <Target id="add" label="Add Bakery ordering site" zone={[148, 40, 296, FIRST_ROW]} task={task} />
      </>
    );
  }
  return (
    <>
      <span style={{ ...at(148, 14), ...words(13, 500, t.text) }}>Add your first session</span>
      <div style={{ ...at(148, 40, 296, FIRST_ROW * 2), ...MODULE }}>
        {FIRST_ROWS.map((row, index) => (
          <div key={row.name} style={{ ...ROW, height: FIRST_ROW - 1, padding: "0 12px", boxSizing: "border-box", ...(index > 0 ? { borderTop: `1px solid ${t.hairlineModule}` } : null) }}>
            <span style={{ width: 16, height: 16, flexShrink: 0, boxSizing: "border-box", borderRadius: 4, background: t.inset, border: `1px solid ${t.tileBorder}` }} />
            <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 2 }}>
              <span style={words(12, 500, t.text)}>{row.name}</span>
              {row.detail ? <span style={words(11, 400, t.label)}>{row.detail}</span> : null}
            </span>
            <Glyph name="chev" size={16} color={t.label} />
          </div>
        ))}
      </div>
      {FIRST_ROWS.map((row, index) => (
        <Target key={row.name} id={FIRST_IDS[index]} label={row.name} zone={[148, 40 + index * FIRST_ROW, 296, FIRST_ROW]} task={task} />
      ))}
    </>
  );
}

/* ── step 4: add a tool, and move it up ── */

/** The Add menu here: four kinds, each a cell big enough to press on a phone. */
const MENU: Box = [72, 36, 448, 176];
/** A tile has changed places once it has been pulled this far. */
const SWAPPED = SWAP / 2;

function StepsTask(task: TaskProps) {
  const scale = useContext(StageScale);
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  /** How far the tile had been pulled when it was let go, so it settles from there. */
  const letGo = useRef(0);
  const toolRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const added = task.done >= 2;
  const moved = task.done >= 3;
  const holding = task.done === 2;

  /* The two tiles settle into their new places from where they were. */
  const settled = useRef(moved);
  useLayoutEffect(() => {
    if (!moved || settled.current) return;
    settled.current = true;
    const lifted = letGo.current;
    play(toolRef.current, [{ transform: `translateY(${SWAP + lifted}px)` }, { transform: "none" }], { duration: BASE });
    if (lifted > -SWAPPED) play(promptRef.current, [{ transform: `translateY(-${SWAP}px)` }, { transform: "none" }], { duration: BASE });
  }, [moved]);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!holding) return;
    start.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setPull(Math.min(8, Math.max(-SWAP - 8, (event.clientY - start.current) / scale)));
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    const far = pull <= -SWAPPED;
    letGo.current = far ? pull : 0;
    setPull(0);
    if (far) task.hit("move");
  };

  const ahead = holding && pull <= -SWAPPED;
  return (
    <>
      <SessionHead left={88} top={14} />
      <div style={at(88, 44, 416, 36)}>
        <StepTile number={<StepNumber now={1} />} kind="Prompt" bar={220} />
      </div>
      <div ref={promptRef} style={{ ...at(88, moved ? 132 : 88, 416, 36), transform: ahead ? `translateY(${SWAP}px)` : undefined }}>
        <StepTile number={<StepNumber now={moved || ahead ? 3 : 2} />} kind="Prompt" bar={176} />
      </div>
      {added ? (
        <div
          ref={toolRef}
          data-testid="tutorial-drag"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ ...at(88, moved ? 88 : 132, 416, 36), zIndex: 2, transform: pull ? `translateY(${pull}px)` : undefined, touchAction: holding ? "none" : undefined, cursor: holding ? "grab" : undefined }}
        >
          <Pop from="translateY(-8px)" style={{ width: "100%", height: "100%" }}>
            <StepTile number={<StepNumber now={moved || ahead ? 2 : 3} />} kind="Tool" name="Stripe" />
          </Pop>
          {holding ? (
            <span style={{ position: "absolute", right: 8, top: 6, width: 24, height: 24, boxSizing: "border-box", borderRadius: 6, background: t.control, border: `1px solid ${t.controlBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Glyph name="up" size={16} color={t.text2} />
            </span>
          ) : null}
        </div>
      ) : null}
      <div style={{ ...at(88, added ? 182 : 138), ...ROW }}>
        <Glyph name="plus" size={16} color={t.text2} />
        <span style={words(12, 500, t.text2)}>Add step</span>
      </div>

      {task.done === 0 ? <Target id="add" label="Add step" zone={[88, 110, 416, 72]} around={[80, 130, 120, 32]} task={task} /> : null}
      {task.done === 1 ? (
        <>
          <Pop style={{ ...at(...MENU), ...WINDOW, zIndex: 3, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
            {KINDS.map((kind) => (
              <span key={kind.name} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "0 20px" }}>
                <span style={words(13, 500, t.text)}>{kind.name}</span>
                <span style={words(12, 400, t.label)}>{kind.says}</span>
              </span>
            ))}
          </Pop>
          {KINDS.map((kind, index) => (
            <Target key={kind.name} id={kind.name.toLowerCase()} label={kind.name} zone={[MENU[0] + (index % 2) * (MENU[2] / 2), MENU[1] + Math.floor(index / 2) * (MENU[3] / 2), MENU[2] / 2, MENU[3] / 2]} task={task} />
          ))}
        </>
      ) : null}
      {holding ? <Target id="move" label="Move the Tool step up" zone={[440, 112, 72, 72]} around={[84, 128, 424, 44]} task={task} /> : null}
      {moved ? (
        <Pop delay={FAST} style={{ ...at(210, 204, 172, 36), ...WINDOW, ...ROW, zIndex: 3, justifyContent: "space-between", padding: "0 6px 0 12px" }}>
          <span style={words(12, 500, t.text)}>Step moved</span>
          <MiniButton>Undo</MiniButton>
        </Pop>
      ) : null}
    </>
  );
}

/* ── step 5: the last required item, then Publish ── */

/** Which required items are there when the challenge opens: everything but the title. */
const MISSING = "Title";

function PublishTask(task: TaskProps) {
  const titled = task.done >= 1;
  const published = task.done >= 2;
  return (
    <>
      <div style={{ ...at(156, 12, 280, 224), ...WINDOW, overflow: "hidden" }}>
        <span style={{ ...at(16, 14), ...words(13, 500, t.text) }}>Publish checklist</span>
        <span style={{ ...at(16, 38), ...words(11, 400, t.label) }}>Required</span>
        {REQUIRED.map((name, index) => {
          const there = name !== MISSING || titled;
          return (
            <div key={name} style={{ ...at(16, 60 + index * 28, 248), ...ROW }}>
              <span style={{ position: "relative", width: 16, height: 16, flexShrink: 0, boxSizing: "border-box", borderRadius: 8, border: `1px solid ${t.controlBorder}` }}>
                {there ? name === MISSING ? <Pop from="scale(0.5)" style={{ position: "absolute", inset: -1 }}><Tick /></Pop> : <Tick style={{ position: "absolute", left: -1, top: -1 }} /> : null}
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
          <Pop from="none" style={{ ...at(0, 0, 280, 224), background: t.window, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Tick size={32} />
            <span style={words(14, 500, t.text)}>Published</span>
            <span style={words(12, 400, t.text2)}>Your build is public.</span>
          </Pop>
        ) : null}
      </div>
      {task.goal ? (
        <>
          {titled ? null : <Target id="title" label="Add title" zone={[156, 72, 280, 84]} around={[164, 94, 264, 28]} task={task} />}
          <Target id="publish" label="Publish" zone={[340, 160, 96, 76]} around={[354, 194, 72, 36]} task={task} />
        </>
      ) : null}
    </>
  );
}

const TASKS: Record<TutorialScene, (task: TaskProps) => ReactNode> = {
  layout: LayoutTask,
  post: PostTask,
  sessions: SessionsTask,
  steps: StepsTask,
  publish: PublishTask,
};

/** A wrong press: the stage shakes its head, once. */
const SHAKE: Keyframe[] = [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }];

export interface TaskStageProps extends TaskProps {
  scene: TutorialScene;
  /** Wrong presses so far: each new one shakes the stage. */
  misses: number;
}

export function TaskStage({ scene, misses, ...task }: TaskStageProps) {
  const [fitRef, scale] = useFit();
  const picture = useRef<HTMLDivElement | null>(null);
  const shaken = useRef(misses);
  useLayoutEffect(() => {
    if (shaken.current === misses) return;
    shaken.current = misses;
    play(picture.current, SHAKE, { duration: BASE });
  }, [misses]);

  const Task = TASKS[scene];
  return (
    <div ref={fitRef} style={{ width: "100%", minWidth: 0 }}>
      <div data-testid="tutorial-task" data-scene={scene} data-done={task.done} data-cleared={task.goal === null ? "true" : undefined} style={stageStyle(scale)}>
        <div style={{ position: "absolute", left: 0, top: 0, width: STAGE.width, height: STAGE.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <div ref={picture} style={{ position: "absolute", inset: 0 }}>
            <StageScale.Provider value={scale}>
              <Task {...task} />
            </StageScale.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
