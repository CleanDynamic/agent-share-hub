/* The build editor's tutorial: a window of five steps, each a moving example over a few plain lines.

   IT OPENS BY ITSELF ONCE, the first time a maker opens the editor (ComposeRoute offers it, tutorialStore.ts holds the rule),
   and from "Tutorial" under Build options whenever it is wanted again. Each opening starts at step 1.

   IT CAN BE LEFT AT ANY STEP, three ways that are always there: Close in the corner, Skip tutorial in the footer, and Escape.
   A click outside does not close it: a first visit should not lose the tutorial to a stray press, and the three ways out are
   never out of sight. Leaving counts as having seen it; nothing in the build is touched either way.

   THE WINDOW is the window recipe at 640 on a computer (a Radix dialog: focus held inside, and given back to whatever opened
   it), and the site's bottom sheet on a phone. The steps keep one height, so Back and Next never move under the pointer.
   Left and Right step through it as Back and Next do. Each new step is said through the page's announcer (BuildAnnouncer).

   ITS CODE LOADS WITH THE FIRST OPENING (lazyWindow, composerWindows.tsx), so the editor's own download does not carry it. */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { useAuth } from "@/contexts/AuthContext";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { BASE, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { useAnnounce } from "./BuildAnnouncer";
import { BODY_TEXT, HEADER, HEADER_TEXT, IconSquare, LABEL, NOTE, RecipeButton, STRONG_LABEL, TITLE, footerStyle, frameStyle, MODAL_WIDTH } from "./modalRecipes";
import { ScenePlayer } from "./tutorialScenes";
import { TUTORIAL_COPY, TUTORIAL_STEPS, clampStep } from "./tutorialSteps";
import { closeTutorial } from "./tutorialStore";

/** The words under the example keep this height on a computer, whichever step is showing: the tallest step's. */
const WORDS_HEIGHT = 192;

const LIST: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const POINT: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8 };
const MARK: CSSProperties = { width: 4, height: 4, flexShrink: 0, borderRadius: 2, background: t.label, marginTop: 8 };

/** Where the reader is: one dot a step, the ones reached in the text colour. */
function Dots({ step }: { step: number }) {
  return (
    <span aria-hidden="true" data-testid="tutorial-dots" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {TUTORIAL_STEPS.map((entry, index) => (
        <span key={entry.scene} style={{ width: 6, height: 6, borderRadius: 3, background: index <= step ? t.text : t.line }} />
      ))}
    </span>
  );
}

function Steps({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const entry = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  const go = (to: number) => setStep(clampStep(to));

  /* The words of a new step come in over the old ones' place; the first step is simply there. */
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const shown = useRef(step);
  useLayoutEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    const el = wordsRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    el.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: BASE, easing: STANDARD });
  }, [step]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight") go(step + 1);
    else if (event.key === "ArrowLeft") go(step - 1);
    else return;
    event.preventDefault();
  };

  const count = `${TUTORIAL_COPY.name} · ${TUTORIAL_COPY.count(step + 1, TUTORIAL_STEPS.length)}`;

  /* A new step is said through the page's one live region: focus stays on Next, so nothing else would tell a screen reader. */
  const announce = useAnnounce();
  const said = useRef(step);
  useEffect(() => {
    if (said.current === step) return;
    said.current = step;
    announce(`${TUTORIAL_COPY.count(step + 1, TUTORIAL_STEPS.length)}. ${entry.title}. ${entry.body}`);
  }, [step, entry, announce]);
  const side = phone ? 0 : 24;
  const Title = phone ? "h3" : Dialog.Title;

  return (
    <div data-testid="tutorial-window" data-step={step + 1} onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
      <div style={phone ? { ...HEADER, padding: "0 0 12px" } : HEADER}>
        <div style={HEADER_TEXT}>
          <span data-testid="tutorial-count" style={NOTE}>
            {count}
          </span>
          <Title data-testid="tutorial-title" style={{ ...TITLE, marginTop: 4 }}>
            {entry.title}
          </Title>
        </div>
        {phone ? null : <IconSquare glyph="x" label={TUTORIAL_COPY.close} data-testid="tutorial-close" onClick={onClose} />}
      </div>

      <div style={{ padding: `0 ${side}px`, flexShrink: 0 }}>
        <ScenePlayer scene={entry.scene} />
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
        {last ? <p style={{ ...NOTE, margin: 0 }}>{TUTORIAL_COPY.again}</p> : null}
      </div>

      <div style={footerStyle(phone)}>
        <Dots step={step} />
        <span style={{ flexGrow: 1 }} />
        {last ? null : (
          <RecipeButton phone={phone} data-testid="tutorial-skip" onClick={onClose}>
            {TUTORIAL_COPY.skip}
          </RecipeButton>
        )}
        {step > 0 ? (
          <RecipeButton phone={phone} data-testid="tutorial-back" onClick={() => go(step - 1)}>
            {TUTORIAL_COPY.back}
          </RecipeButton>
        ) : null}
        <RecipeButton variant="primary" phone={phone} data-testid="tutorial-next" onClick={last ? onClose : () => go(step + 1)}>
          {last ? TUTORIAL_COPY.done : TUTORIAL_COPY.next}
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
  const focus = useWindowFocus(open);
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
