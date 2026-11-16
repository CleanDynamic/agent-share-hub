/* The build editor's tutorial: a window of five steps, each a small challenge on a copy of the editor, over a few plain lines.

   IT OPENS BY ITSELF ONCE, the first time a maker opens the editor (ComposeRoute offers it, tutorialStore.ts holds the rule),
   and from "Tutorial" under Build options whenever it is wanted again. Each opening starts at step 1.

   IT IS PLAYED, NOT READ. Each step asks for one thing at a time ("Press Add step", "Choose Tool", "Drag it above step 2") on a
   stage that is the editor in miniature (tutorialTasks.tsx), and answers every press at once: the right one clears the goal and
   the stage moves on; a wrong one shakes the stage, says why in a line, and points at the target. Nothing is lost by a wrong
   press and nothing is timed out. A long pause brings the pointer by itself. "Show me" plays the step as an example
   (tutorialScenes.tsx) for anyone who would rather watch, and "Try it" comes back.

   PROGRESS IS ALWAYS IN SIGHT: five bars under the title, one a challenge, and "2 of 5 done" in the footer. The main button is
   "Skip step" until the step is cleared and "Next" after, so nobody is ever stuck behind a challenge. The last screen says what
   the run came to: how many of the five, how long, how many hints, and "Clean run" for all five with none.

   IT CAN BE LEFT AT ANY STEP, three ways that are always there: Close in the corner, Skip tutorial in the footer, and Escape.
   A click outside does not close it: a first visit should not lose the tutorial to a stray press, and the three ways out are
   never out of sight. Leaving counts as having seen it; nothing in the build is touched either way, because the stage is a
   copy and never the maker's draft.

   THE WINDOW is the window recipe at 640 on a computer (a Radix dialog: focus held inside, and given back to whatever opened
   it), and the site's bottom sheet on a phone. The steps keep one height, so the buttons never move under the pointer.
   Left and Right step through it as Back and Next do. Each goal, hint and step is said through the page's announcer.

   ITS CODE LOADS WITH THE FIRST OPENING (lazyWindow, composerWindows.tsx), so the editor's own download does not carry it. */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { useAuth } from "@/contexts/AuthContext";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { BASE } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { useAnnounce } from "./BuildAnnouncer";
import { BODY_TEXT, HEADER, HEADER_TEXT, IconSquare, LABEL, NOTE, RecipeButton, STRONG_LABEL, TITLE, footerStyle, frameStyle, MODAL_WIDTH } from "./modalRecipes";
import { tagStyle } from "./refinedStyles";
import { ScenePlayer, play } from "./tutorialScenes";
import { IDLE_HINT_MS, TUTORIAL_COPY, TUTORIAL_STEPS, clampStep, runTime } from "./tutorialSteps";
import { TaskStage, Tick } from "./tutorialTasks";
import { closeTutorial } from "./tutorialStore";

/** The words under the stage keep this height on a computer, whichever step is showing: the tallest step's. */
const WORDS_HEIGHT = 192;

const LIST: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const POINT: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8 };
const MARK: CSSProperties = { width: 4, height: 4, flexShrink: 0, borderRadius: 2, background: t.label, marginTop: 8 };
const STAT: CSSProperties = { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 4, padding: 12, boxSizing: "border-box", borderRadius: 6, background: t.inset, border: `1px solid ${t.tileBorder}` };

const TOTAL = TUTORIAL_STEPS.length;

/** How the five challenges stand: one bar a step. Cleared is the text colour, the one in hand a step lighter, the rest the line's. */
function Progress({ step, cleared }: { step: number | null; cleared: ReadonlySet<number> }) {
  return (
    <div aria-hidden="true" data-testid="tutorial-bars" style={{ display: "flex", gap: 4 }}>
      {TUTORIAL_STEPS.map((entry, index) => (
        <span key={entry.scene} data-cleared={cleared.has(index) ? "true" : undefined} style={{ flex: "1 1 0", height: 4, borderRadius: 2, background: cleared.has(index) ? t.text : index === step ? t.label : t.line }} />
      ))}
    </div>
  );
}

/** One goal a dot: how far through this step's challenge. */
function Pips({ done, of }: { done: number; of: number }) {
  return (
    <span aria-hidden="true" data-testid="tutorial-pips" style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, height: 20 }}>
      {Array.from({ length: of }, (_, index) => (
        <span key={index} style={{ width: 6, height: 6, borderRadius: 3, background: index < done ? t.text : t.line }} />
      ))}
    </span>
  );
}

/** What a run came to, for the last screen. */
interface Run {
  cleared: number;
  ms: number;
  hints: number;
}

function Steps({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  /** Goals cleared in the step showing. */
  const [done, setDone] = useState(0);
  const [cleared, setCleared] = useState<ReadonlySet<number>>(() => new Set());
  const [watching, setWatching] = useState(false);
  /** The hint in words, after a wrong press; `hinting` alone (a long pause) only points. */
  const [hint, setHint] = useState<string | null>(null);
  const [hinting, setHinting] = useState(false);
  const [misses, setMisses] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const tally = useRef({ startedAt: Date.now(), hints: 0 });

  const entry = TUTORIAL_STEPS[step];
  const goals = entry.task.goals;
  const goal = done < goals.length ? goals[done] : null;
  const last = step === TOTAL - 1;
  const announce = useAnnounce();

  const show = (to: number) => {
    const next = clampStep(to);
    if (next === step) return;
    setStep(next);
    setDone(cleared.has(next) ? TUTORIAL_STEPS[next].task.goals.length : 0);
    setWatching(false);
    setHint(null);
    setHinting(false);
    const shown = TUTORIAL_STEPS[next];
    announce(`${TUTORIAL_COPY.count(next + 1, TOTAL)}. ${shown.title}. ${shown.body} ${cleared.has(next) ? shown.task.done : shown.task.goals[0].ask}`);
  };

  /* A press on the stage: the goal in hand clears, or a hint shows. Nothing is lost by a wrong press. */
  const hit = (id: string) => {
    if (!goal) return;
    if (id !== goal.id) {
      const words = entry.task.wrong?.[id] ?? goal.hint;
      tally.current.hints += 1;
      setMisses((count) => count + 1);
      setHint(words);
      setHinting(true);
      announce(words);
      return;
    }
    const next = done + 1;
    setDone(next);
    setHint(null);
    setHinting(false);
    if (next < goals.length) {
      announce(goals[next].ask);
      return;
    }
    setCleared((before) => new Set(before).add(step));
    announce(`${entry.task.done} ${TUTORIAL_COPY.progress(new Set(cleared).add(step).size, TOTAL)}.`);
  };

  /* A long look at a goal with nothing pressed: point at its target. */
  const goalId = goal?.id;
  useEffect(() => {
    if (!goalId || watching || run) return;
    const timer = window.setTimeout(() => setHinting(true), IDLE_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [step, goalId, watching, run]);

  const watch = () => {
    if (!watching) tally.current.hints += 1;
    setWatching(!watching);
    setHint(null);
    setHinting(false);
  };

  const again = () => {
    setDone(0);
    setHint(null);
    setHinting(false);
  };

  const finish = () => {
    if (cleared.size === 0) return onClose();
    setRun({ cleared: cleared.size, ms: Date.now() - tally.current.startedAt, hints: tally.current.hints });
    announce(`${TUTORIAL_COPY.complete.title(cleared.size, TOTAL)}.`);
  };

  /* What comes in after a change comes in over the old one's place; the first step is simply there. */
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const shown = useRef(step);
  useLayoutEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    play(wordsRef.current, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: BASE });
  }, [step]);

  /* Focus follows the game: when the target that was pressed has gone, it moves to the next goal's, or to Next once the step is
     cleared, so Enter carries on. Focus that is somewhere else in the window is left alone. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLButtonElement | null>(null);
  const placed = useRef(`${step}:${done}`);
  useEffect(() => {
    const now = `${step}:${done}`;
    if (placed.current === now) return;
    placed.current = now;
    const root = rootRef.current;
    const active = document.activeElement;
    if (!root || (active instanceof HTMLElement && active !== document.body && root.contains(active))) return;
    const to = goalId ? root.querySelector<HTMLElement>(`[data-target="${goalId}"]`) : mainRef.current;
    to?.focus({ preventScroll: true });
  }, [step, done, goalId]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (run || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight") show(step + 1);
    else if (event.key === "ArrowLeft") show(step - 1);
    else return;
    event.preventDefault();
  };

  const side = phone ? 0 : 24;
  const Title = phone ? "h3" : Dialog.Title;
  const stepCleared = goal === null;
  const head = (count: string, title: string, bars: number | null) => (
    <>
      <div style={phone ? { ...HEADER, padding: "0 0 12px" } : HEADER}>
        <div style={HEADER_TEXT}>
          <span data-testid="tutorial-count" style={NOTE}>
            {`${TUTORIAL_COPY.name} · ${count}`}
          </span>
          <Title data-testid="tutorial-title" style={{ ...TITLE, marginTop: 4 }}>
            {title}
          </Title>
        </div>
        {phone ? null : <IconSquare glyph="x" label={TUTORIAL_COPY.close} data-testid="tutorial-close" onClick={onClose} />}
      </div>
      <div style={{ padding: `0 ${side}px 12px`, flexShrink: 0 }}>
        <Progress step={bars} cleared={cleared} />
      </div>
    </>
  );

  /* ── the last screen: what the run came to ── */
  if (run) {
    const clean = run.cleared === TOTAL && run.hints === 0;
    return (
      <div ref={rootRef} data-testid="tutorial-window" data-step="complete" style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        {head(TUTORIAL_COPY.complete.count, TUTORIAL_COPY.complete.title(run.cleared, TOTAL), null)}
        <div data-testid="tutorial-summary" style={{ display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box", padding: `4px ${side}px 20px`, overflowY: "auto" }}>
          <p style={{ ...LABEL, margin: 0 }}>{TUTORIAL_COPY.complete.body}</p>
          <dl style={{ display: "flex", gap: 8, margin: 0 }}>
            {(
              [
                [TUTORIAL_COPY.complete.challenges, TUTORIAL_COPY.complete.score(run.cleared, TOTAL)],
                [TUTORIAL_COPY.complete.time, runTime(run.ms)],
                [TUTORIAL_COPY.complete.hints, run.hints === 0 ? TUTORIAL_COPY.complete.none : String(run.hints)],
              ] as const
            ).map(([name, value]) => (
              <div key={name} style={STAT}>
                <dt style={NOTE}>{name}</dt>
                <dd data-testid={`tutorial-stat-${name.toLowerCase()}`} style={{ ...TITLE, fontVariantNumeric: "tabular-nums" }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {clean ? (
            <p data-testid="tutorial-clean" style={{ ...BODY_TEXT, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Tick />
              <span>
                <span style={STRONG_LABEL}>{TUTORIAL_COPY.complete.clean}</span>
                <span style={LABEL}>{` ${TUTORIAL_COPY.complete.cleanSays}`}</span>
              </span>
            </p>
          ) : null}
          <p style={{ ...NOTE, margin: 0 }}>{TUTORIAL_COPY.reopen}</p>
        </div>
        <div style={footerStyle(phone)}>
          <span style={{ flexGrow: 1 }} />
          <RecipeButton phone={phone} data-testid="tutorial-back" onClick={() => setRun(null)}>
            {TUTORIAL_COPY.back}
          </RecipeButton>
          <RecipeButton ref={mainRef} variant="primary" phone={phone} data-testid="tutorial-next" onClick={onClose}>
            {TUTORIAL_COPY.done}
          </RecipeButton>
        </div>
      </div>
    );
  }

  /* ── a step: its challenge, then its words ── */
  const strip = watching ? TUTORIAL_COPY.watching : stepCleared ? entry.task.done : (goal?.ask ?? "");
  return (
    <div ref={rootRef} data-testid="tutorial-window" data-step={step + 1} onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
      {head(TUTORIAL_COPY.count(step + 1, TOTAL), entry.title, step)}

      <div data-testid="tutorial-goal" data-state={watching ? "watching" : stepCleared ? "cleared" : "asked"} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: `0 ${side}px 12px`, flexShrink: 0, minHeight: 40, boxSizing: "content-box" }}>
        {stepCleared && !watching ? <Tick style={{ marginTop: 2 }} /> : <span style={{ ...tagStyle, flexShrink: 0 }}>{watching ? TUTORIAL_COPY.example : TUTORIAL_COPY.turn}</span>}
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid="tutorial-ask" style={STRONG_LABEL}>
            {strip}
          </span>
          {hint && !watching && !stepCleared ? (
            <span data-testid="tutorial-hint" style={NOTE}>
              {hint}
            </span>
          ) : null}
        </span>
        {watching || stepCleared ? null : <Pips done={done} of={goals.length} />}
        {stepCleared && !watching ? (
          <RecipeButton small phone={phone} data-testid="tutorial-again" onClick={again}>
            {TUTORIAL_COPY.again}
          </RecipeButton>
        ) : (
          <RecipeButton small phone={phone} data-testid="tutorial-watch" onClick={watch}>
            {watching ? TUTORIAL_COPY.tryIt : TUTORIAL_COPY.watch}
          </RecipeButton>
        )}
      </div>

      <div style={{ padding: `0 ${side}px`, flexShrink: 0 }}>
        {watching ? <ScenePlayer scene={entry.scene} /> : <TaskStage key={step} scene={entry.scene} done={done} goal={goal?.id ?? null} hinting={hinting} hit={hit} misses={misses} />}
      </div>

      <div ref={wordsRef} style={{ display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box", padding: `16px ${side}px 20px`, minHeight: phone ? undefined : WORDS_HEIGHT, overflowY: "auto" }}>
        <p data-testid="tutorial-body" style={{ ...LABEL, margin: 0 }}>
          {entry.body}
        </p>
        <ul data-testid="tutorial-points" style={LIST}>
          {entry.points.map((point) => (
            <li key={point.lead} style={POINT}>
              <span aria-hidden="true" style={MARK} />
              <span style={BODY_TEXT}>
                <span style={STRONG_LABEL}>{point.lead}</span>
                <span style={LABEL}>{` ${point.rest}`}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={footerStyle(phone)}>
        <span data-testid="tutorial-progress" style={{ ...NOTE, fontVariantNumeric: "tabular-nums" }}>
          {TUTORIAL_COPY.progress(cleared.size, TOTAL)}
        </span>
        <span style={{ flexGrow: 1 }} />
        <RecipeButton phone={phone} data-testid="tutorial-skip" onClick={onClose}>
          {TUTORIAL_COPY.skip}
        </RecipeButton>
        {step > 0 ? (
          <RecipeButton phone={phone} data-testid="tutorial-back" onClick={() => show(step - 1)}>
            {TUTORIAL_COPY.back}
          </RecipeButton>
        ) : null}
        <RecipeButton ref={mainRef} variant={stepCleared ? "primary" : "secondary"} phone={phone} data-testid="tutorial-next" data-cleared={stepCleared ? "true" : undefined} onClick={last ? finish : () => show(step + 1)}>
          {stepCleared ? (last ? TUTORIAL_COPY.finish : TUTORIAL_COPY.next) : TUTORIAL_COPY.skipStep}
        </RecipeButton>
      </div>
    </div>
  );
}

export interface TutorialWindowProps {
  open: boolean;
}

export function TutorialWindow({ open }: TutorialWindowProps) {
  const phone = useIsPhone();
  const { user } = useAuth();
  const makerId = user?.id;
  /* It opens with focus on the main button (Skip step, then Next), not on Close: Enter should never be the way out by accident. */
  const focus = useWindowFocus(open, undefined, (event) => {
    const main = (event.currentTarget instanceof HTMLElement ? event.currentTarget : null)?.querySelector<HTMLElement>('[data-testid="tutorial-next"]');
    if (!main) return;
    event.preventDefault();
    main.focus();
  });
  const close = () => closeTutorial(makerId);

  /* The page going away under an open tutorial closes it, so it is not standing open over the next draft. */
  const latest = useRef(makerId);
  latest.current = makerId;
  useEffect(() => () => closeTutorial(latest.current), []);

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && close()} title={TUTORIAL_COPY.name} hideTitle>
        <Steps phone onClose={close} />
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 70 }} />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onInteractOutside={(event) => event.preventDefault()}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 71, ...frameStyle(MODAL_WIDTH.wide) }}
        >
          <Steps phone={false} onClose={close} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default TutorialWindow;
