/* CA-28 P4: the Optional section every tile window ends with, open only when asked.

   The window opens with its required fields. Under them one row, "Optional", with the count of its fields ("6 fields", or
   "6 fields · 2 filled" when some hold a value) and a chevron at the right. The whole row is one button (Enter and Space work):
   it opens the rest of the fields, and the window grows to hold them.

   Each field then shows directly, as a block of the window's own recipe: its label, under it its hint (left out when there is
   none), then the input. No field has a closed row of its own, a chevron or a summary line.

   It is closed when the window opens, and opens by itself when a field holds a value (a saved tile being edited, or an import that
   filled one) or when an error points into it (`forceOpen` on the field: the section opens, the field scrolls into view and takes
   focus). Opened from the keyboard, focus moves to the first field; closing leaves it on the row.

   Motion (`buildMotion.tsx`; transform and opacity, `clip-path` for the frame; never height):
     opening  the frame grows over `BASE` with its centre held still (`resizeFrame`); `OPTIONAL_DROP_AFTER` after the press each field
              falls 20 and fades in over 240, top first, 60 apart, the 12th and the rest together;
     closing  the fields lift out (rise 8, fade, `OPTIONAL_LIFT`, last first, `OPTIONAL_LIFT_STAGGER` apart), then the frame closes
              over `BASE`;
     pressing the row again mid-motion ends the running one at once, then starts the reverse;
     under reduced motion the new size arrives at once, and nothing drops or lifts.

   CA-15b: drawn from `modalRecipes` (the Optional header, heading, count, chevron and hover recipes, and the block recipe the fields
   use). The old per-field closed rows live on in `OptionalRows.tsx`, for the two places that still read as rows. */

import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { DROP, DROP_FALL, LIFT_RISE, OPTIONAL_DROP_AFTER, OPTIONAL_LIFT, OPTIONAL_LIFT_STAGGER, STAGGER, STAGGER_CAP } from "@/lib/build/buildMotion";
import { useInteractive } from "@/lib/theme/interactive";
import { BASE, move } from "@/lib/theme/motion";

import { dropIn, frameParts, liftOut, motionOn, resizeFrame, type MotionRun } from "./buildMotion";
import { Block, COUNT, HINT, ModalInset, OPTIONAL, STRONG_LABEL, useModalInset } from "./modalRecipes";

export const OPTIONAL_COPY = {
  heading: "Optional",
  fields: (n: number) => `${n} ${n === 1 ? "field" : "fields"}`,
  /** "6 fields · 2 filled". */
  filled: (n: number, filled: number) => `${n} ${n === 1 ? "field" : "fields"} · ${filled} filled`,
} as const;

/** What a field holds, as one line: the value cut to one line by CSS; a list reads as its items joined. Null when it holds nothing. */
export function summaryOf(...values: readonly (string | number | readonly string[] | null | undefined)[]): string | null {
  const parts = values.flatMap((value) => {
    if (value === null || value === undefined) return [];
    if (typeof value === "number") return [String(value)];
    if (typeof value === "string") return value.trim() ? [value.trim().replace(/\s*\n\s*/g, ", ")] : [];
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? [items.join(", ")] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** What a field tells its section: it is the one an error points into. */
const SectionContext = createContext<{ reveal: (field: HTMLElement | null) => void } | null>(null);

export interface OptionalFieldProps {
  /** The field's label: "Failure notes". */
  name: string;
  /** Its hint, one grey line under the label: a format, a unit, a limit or the allowed values. Absent or empty: no line. */
  description?: string;
  /** What the field holds, as one line; null or empty when it holds nothing. The section counts the fields that hold something. */
  summary?: string | null;
  /** An error points into this field: its section opens, and the field scrolls into view and takes focus. Each time it turns true. */
  forceOpen?: boolean;
  /** Read for the sake of the places that pass it; a field is the same block on a phone. */
  phone?: boolean;
  /** A count 6 after the label ("Multi-agent only"). */
  titleCount?: string;
  children: ReactNode;
}

/** One field of the section, drawn as a block of the window's recipe: label, hint, then the input. */
export function OptionalField({ name, description, forceOpen = false, titleCount, children }: OptionalFieldProps) {
  const section = useContext(SectionContext);
  const block = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (forceOpen) section?.reveal(block.current);
  }, [forceOpen, section]);
  return (
    <div ref={block} data-testid="optional-field">
      <Block>
        <div style={OPTIONAL.fieldHead}>
          <span style={OPTIONAL.fieldLabelLine}>
            <span data-testid="optional-title" style={STRONG_LABEL}>
              {name}
            </span>
            {titleCount ? (
              <span data-testid="optional-title-count" style={COUNT}>
                {titleCount}
              </span>
            ) : null}
          </span>
          {description ? (
            <span data-testid="optional-line" style={HINT}>
              {description}
            </span>
          ) : null}
        </div>
        <div style={OPTIONAL.fieldBody}>{children}</div>
      </Block>
    </div>
  );
}

export interface OptionalSectionProps {
  /** `OptionalField`s; a `null` or `false` child is not a field and is not counted. */
  children: ReactNode;
  /** The body's side padding to run the rules across: the section reaches the window's edges and pads its own rows back in. */
  bleed?: number;
}

/** What opening has to do once its fields are drawn: where the frame stood, and where focus goes. */
type Opening = { heightBefore: number; scrollTop: number; byKey: boolean; focusAt: number | null };

const FOCUSABLE = "input, textarea, select, button, [tabindex]:not([tabindex='-1'])";

/** The section: its toggle row, and under it, when open, its fields. Draws nothing when it has no field. */
export function OptionalSection({ children, bleed = 0 }: OptionalSectionProps) {
  const context = useModalInset();
  const phone = useIsPhone();
  const uid = useId();
  const rows = Children.toArray(children).filter((child): child is ReactElement<OptionalFieldProps> => isValidElement(child));
  const filled = rows.filter((row) => Boolean(row.props.summary && row.props.summary.trim())).length;
  const forced = rows.findIndex((row) => row.props.forceOpen);

  const [open, setOpen] = useState(() => filled > 0 || forced >= 0);
  /** The fields are drawn: while the section is open, and while they lift out. */
  const [shown, setShown] = useState(open);
  const section = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const opening = useRef<Opening | null>(null);
  /** Ends whatever is moving, at once, in its end state. Null when nothing is. */
  const settle = useRef<(() => void) | null>(null);
  /** Counts the closings, so one that was ended early does not carry on. */
  const closing = useRef(0);
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  const frameOf = (): HTMLElement | null => section.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
  const fieldsOf = (): HTMLElement[] => [...(region.current?.querySelectorAll<HTMLElement>('[data-testid="optional-field"]') ?? [])];
  /** The window's own motion, when it has a frame that centres: not on a phone, where the sheet grows from its bottom edge. */
  const framed = (): { frame: HTMLElement; parts: ReturnType<typeof frameParts> } | null => {
    const frame = frameOf();
    return frame && !phone ? { frame, parts: frameParts(frame) } : null;
  };

  const interrupt = useCallback(() => {
    const end = settle.current;
    settle.current = null;
    end?.();
  }, []);

  const openIt = (byKey: boolean, focusAt: number | null = null) => {
    interrupt();
    // A closing that was ended early must not carry on when its animation promises settle.
    closing.current += 1;
    opening.current = { heightBefore: frameOf()?.getBoundingClientRect().height ?? 0, scrollTop: framed()?.parts.body?.scrollTop ?? 0, byKey, focusAt };
    setOpen(true);
    setShown(true);
  };

  const closeIt = () => {
    interrupt();
    closing.current += 1;
    const mine = closing.current;
    setOpen(false);
    const fields = fieldsOf();
    const where = framed();
    // Focus inside a field would be lost with it: the row keeps it.
    if (region.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    const finish = () => {
      flushSync(() => setShown(false));
      for (const element of [where?.frame, where?.parts.header, where?.parts.body, where?.parts.footer]) {
        for (const animation of element?.getAnimations?.() ?? []) if (String(animation.id).startsWith("bm:")) animation.cancel();
      }
    };
    if (!motionOn() || fields.length === 0) {
      finish();
      return;
    }
    const lift = liftOut([...fields].reverse(), { stagger: OPTIONAL_LIFT_STAGGER, ms: OPTIONAL_LIFT, rise: LIFT_RISE });
    let shrink: MotionRun | null = null;
    settle.current = () => {
      lift.finish();
      shrink?.finish();
      finish();
    };
    void lift.finished.then(() => {
      if (closing.current !== mine || settle.current === null) return;
      const area = region.current;
      if (!where || !area) {
        settle.current = null;
        finish();
        return;
      }
      const before = where.frame.getBoundingClientRect().height;
      // How tall the window will be without the fields: take them out of the layout for one measure, then put them back.
      const was = area.style.display;
      area.style.display = "none";
      const after = where.frame.getBoundingClientRect().height;
      area.style.display = was;
      shrink = resizeFrame(where.frame, where.parts, before, after, BASE);
      void shrink.finished.then(() => {
        if (closing.current !== mine || settle.current === null) return;
        settle.current = null;
        finish();
      });
    });
  };

  /** Opening: the frame grows from where it stood, the fields fall in, focus and scroll are placed. */
  useLayoutEffect(() => {
    const todo = opening.current;
    if (!todo || !open || !shown) return;
    opening.current = null;
    const fields = fieldsOf();
    const body = framed()?.parts.body ?? null;
    if (motionOn()) {
      const where = framed();
      const runs: MotionRun[] = [];
      const after = where?.frame.getBoundingClientRect().height ?? 0;
      if (where && Math.abs(after - todo.heightBefore) >= 1) runs.push(resizeFrame(where.frame, where.parts, todo.heightBefore, after, BASE));
      runs.push(dropIn(fields, { delay: OPTIONAL_DROP_AFTER, stagger: STAGGER, cap: STAGGER_CAP, ms: DROP, from: DROP_FALL }));
      const end = () => {
        for (const run of runs) run.finish();
      };
      settle.current = end;
      void Promise.all(runs.map((run) => run.finished)).then(() => {
        if (settle.current === end) settle.current = null;
      });
    }
    // The toggle row stays where it was in the body: nothing the new fields bring in moves the scroll.
    if (body && body.scrollTop !== todo.scrollTop) body.scrollTop = todo.scrollTop;
    const target = todo.focusAt !== null ? fields[todo.focusAt] : todo.byKey ? fields[0] : null;
    if (target) {
      target.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
      if (todo.focusAt !== null) target.scrollIntoView?.({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown]);

  const toggle = (byKey: boolean) => {
    if (open) closeIt();
    else openIt(byKey);
  };

  /** An error points into a field: open, then go to it. */
  const reveal = (field: HTMLElement | null) => {
    if (open) {
      field?.scrollIntoView?.({ block: "nearest" });
      field?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
      return;
    }
    openIt(false, fieldsOf().indexOf(field as HTMLElement) >= 0 ? fieldsOf().indexOf(field as HTMLElement) : null);
  };
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const context_ = useMemo(() => ({ reveal: (field: HTMLElement | null) => revealRef.current(field) }), []);

  // An error points into a field while the section is shut (its fields are not drawn, so they cannot say so themselves): open, then go to it.
  useEffect(() => {
    if (forced >= 0 && !open) openIt(false, forced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forced >= 0]);

  // A field that held nothing now holds a value while the section is shut (an import filled it): open.
  const held = useRef(filled);
  useEffect(() => {
    if (held.current === 0 && filled > 0 && !open) openIt(false);
    held.current = filled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  // Nothing is left running when the window goes.
  useEffect(
    () => () => {
      settle.current = null;
    },
    [],
  );

  if (rows.length === 0) return null;
  const inset = bleed || context;
  const regionId = `${uid}-region`;
  const headId = `${uid}-head`;
  const hovered = state.hovered && inset > 0;
  return (
    <ModalInset.Provider value={inset}>
      <SectionContext.Provider value={context_}>
        <section ref={section} aria-label={OPTIONAL_COPY.heading} data-testid="optional-section" data-open={open || undefined} style={OPTIONAL.sectionAt(bleed)}>
          <button
            ref={button}
            type="button"
            id={headId}
            data-testid="optional-toggle"
            aria-expanded={open}
            aria-controls={regionId}
            // A keyboard press arrives as a click with no pointer: detail is 0.
            onClick={(event) => toggle(event.detail === 0)}
            {...handlers}
            data-ring-inset=""
            style={OPTIONAL.toggle(inset, hovered, phone, state.focusVisible)}
          >
            <span style={OPTIONAL.heading}>{OPTIONAL_COPY.heading}</span>
            <span style={OPTIONAL.tail}>
              <span data-testid="optional-count" style={OPTIONAL.count}>
                {filled > 0 ? OPTIONAL_COPY.filled(rows.length, filled) : OPTIONAL_COPY.fields(rows.length)}
              </span>
              <span aria-hidden="true" style={{ ...OPTIONAL.chevron(open), transition: move(BASE) }}>
                <Glyph name="chevd" size={14} />
              </span>
            </span>
          </button>
          <div ref={region} id={regionId} role="region" aria-labelledby={headId} hidden={!shown} data-testid="optional-region" style={OPTIONAL.region}>
            {shown ? rows : null}
          </div>
        </section>
      </SectionContext.Provider>
    </ModalInset.Provider>
  );
}

export default OptionalSection;
