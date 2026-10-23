// ColourPicker: the colour of a part, a session or a tile (CA-06 P5), drawn again for CA-19 P4 (board "References: the
// colour picker").
//
// A window 320 wide (a BottomSheet on a phone). The head: "Colour", the component ("Result 2 · Data model") and the close
// square. Then three sections, each under a rule:
//
//   1. The wheel at 124, and beside it Lightness and the colour code: a 30 square of the colour and the code field (the
//      data face 12.5, 30 tall, on the field fill). It takes #RGB or #RRGGBB, with or without the #, any case, and shows
//      #RRGGBB once applied, on Enter or when the field is left; a wrong code changes nothing and says "Use a code like
//      #7FA7D9". Where the browser can, a 26 eyedropper ("Pick from the screen") ends the row.
//   2. Saved (the maker's favourites, up to 24, then a dashed circle that saves the colour; right-click or press and hold a
//      saved one for "Use this colour" and "Remove from saved"), Recent (the last 8 applied, newest first) and Suggested
//      (the six presets). Under them, when another component has this colour: "Also used by Session 3 · Make a group". A
//      session's or a part's picker keeps "Also colour its tiles (sessions) that have no colour" here.
//   3. Two inner panels: the component's linked text ("Linked text · 1 of 1"), and its reference group ("not in one",
//      with Make a group and Add to a group).
//
// The footer: Undo and Redo, then No colour and Done. A component in a group opens in its group state instead: the
// group's panel, "Its colour and its linked text belong to the group.", Open group and Remove from group.
//
// THE WHEEL IS A CANVAS, drawn pixel by pixel (the one gradient the look allows): angle is hue, distance from the centre is
// saturation from 0 to 70%, at the lightness the slider sets. Drag or click picks; with the canvas focused the arrow keys
// move hue (left, right) and saturation (up, down) by 2; the code is said through a live region as it changes.
//
// EVERY CHANGE PREVIEWS LIVE (`onPreview`). Escape, the close square and a press outside put back the colour the
// component had when the picker opened (`onCancel`); Done keeps it. No colour is ever chosen for the maker.

import * as ContextMenu from "@radix-ui/react-context-menu";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import type { FoundWords } from "@/lib/build/linkRules";
import type { ColourSwatches } from "@/lib/profile/colourSwatches";
import {
  FAVOURITES_MAX,
  hexToHsl,
  hslToHex,
  LIGHTNESS_MAX,
  LIGHTNESS_MIN,
  LIGHTNESS_START,
  lightnessOf,
  SATURATION_MAX,
  wheelAt,
  wheelKey,
  wheelPixels,
  wheelPoint,
  withRecent,
} from "@/lib/theme/colourWheel";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { HEX_HINT, normaliseHex, SUGGESTED_COLOURS, swatchFor } from "@/lib/theme/partColour";
import { CONTROL, WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { refPaint, refWordsStyle } from "@/components/post/RefLinks";
import { FIELD_FOCUS, FieldInput, HEADER_ICONS, IconSquare, RecipeButton, TextLink, fieldStyle, footerStyle, frameStyle } from "@/pages/site/compose/modalRecipes";
import { TextButton } from "@/pages/site/compose/composeControls";
import { menuItem, menuSurface } from "@/pages/site/compose/refinedStyles";
import { CODE_FIELD, DANGER, ELLIPSIS, GAP, GhostIcon, InnerPanel, PAD, SquareSwatch, UndoRedo, data, words } from "@/pages/site/compose/referencePieces";

import { Checkbox } from "./Checkbox";
import { Glyph } from "./Glyph";
import { LiveRegion, useAnnouncer } from "./LiveRegion";

export const COLOUR_PICKER_COPY = {
  head: "Colour",
  close: "Close",
  wheel: "Colour wheel",
  lightness: "Lightness",
  hex: "Colour code",
  screen: "Pick from the screen",
  saved: "Saved",
  recent: "Recent",
  suggested: "Suggested",
  saveThis: "Save this colour",
  useThis: "Use this colour",
  removeSaved: "Remove from saved",
  none: "No colour",
  done: "Done",
  alsoTiles: "Also colour its tiles that have no colour",
  alsoSessions: "Also colour its sessions that have no colour",
  hint: HEX_HINT,
  alsoUsedBy: (names: string) => `Also used by ${names}`,
  makeGroup: "Make a group",
  addToGroup: "Add to a group",
  linkedText: "Linked text",
  oneOfOne: (has: boolean) => ` · ${has ? 1 : 0} of 1`,
  findWords: "Find words in the post",
  selectWords: "Select words in the post instead",
  removeLink: "Remove the link",
  noMatch: "Those words are not in the post",
  group: "Reference group",
  notInOne: " · not in one",
  components: (n: number) => ` · ${n} ${n === 1 ? "component" : "components"}`,
  belongs: "Its colour and its linked text belong to the group.",
  openGroup: "Open group",
  removeFromGroup: "Remove from group",
  noName: "No name",
  post: (n: number) => `Post ${n}`,
} as const;

export const PICKER_WIDTH = 320;
export const WHEEL_SIZE = 124;
const SWATCH = 22;
/** The swatch rows' label column. */
const LABEL_COLUMN = 62;

/** Recent and Saved, as the maker's profile keeps them (CA-06 P6): Saved is `favourites` on screen. */
export type Swatches = ColourSwatches;

/** A group as the picker lists it. */
export interface PickerGroup {
  id: string;
  name?: string;
  colour: string;
  count: number;
}

/**
 * CA-19 P4: what the picker knows of the component's references, and what it can do with them. Absent: the picker colours
 * and nothing more (a dev page, a group's own colour from its window).
 */
export interface PickerReferences {
  /** The group the component is in: the picker opens in its group state. */
  group?: PickerGroup;
  /** The other components with the colour shown, by name, for "Also used by". */
  alsoUsedBy: (hex: string | null) => { to: string; name: string }[];
  /** "Make a group" on the Also used by line: a group of the two, at once. */
  onGroupWith: (other: string, colour: string) => void;
  /** The component's linked text, or null. */
  linked: { words: string; post: number; colour: string | null; number: string } | null;
  findWords: (query: string) => FoundWords[];
  onLinkFound: (found: FoundWords) => void;
  /** "Select words in the post instead": the picker closes and the post asks for the words. */
  onSelectWords: () => void;
  onRemoveLink: () => void;
  /** The build's groups, for Add to a group. */
  groups: readonly PickerGroup[];
  /** Make a group: the group window opens with this component in it, in the colour shown. */
  onMakeGroup: (colour: string | null) => void;
  onAddToGroup: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
  onRemoveFromGroup: () => void;
}

export interface PickerHistory {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export interface ColourPickerProps {
  open: boolean;
  /** The button that opened it: the window goes under it. */
  anchor: HTMLElement | null;
  /** What it colours: "Result 2 · Data model". */
  what: string;
  /** The component's colour as the picker opens; null for none. */
  initial: string | null;
  /** A session: offers "Also colour its tiles that have no colour". */
  session?: boolean;
  /** CA-17 P5, a part: offers "Also colour its sessions that have no colour" instead. */
  part?: boolean;
  swatches: Swatches;
  onSwatches: (next: Swatches) => void;
  /** Every change, as it happens: the page draws it on the component and its links. */
  onPreview: (colour: string | null, alsoTiles: boolean) => void;
  /** Done: keep it. */
  onDone: (colour: string | null, alsoTiles: boolean) => void;
  /** Escape, the close square, a press outside: the page puts back `initial`. */
  onCancel: () => void;
  phone: boolean;
  /** CA-19 P4: linked text and groups. */
  references?: PickerReferences;
  history?: PickerHistory;
  /** CA-19 P6: drawn in place, inside another window (the group window's Change…), with no portal of its own. */
  inline?: boolean;
}

/** What the EyeDropper API returns, where the browser has it. */
type EyeDropperLike = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperLike | null => (typeof window !== "undefined" && "EyeDropper" in window ? ((window as unknown as { EyeDropper: EyeDropperLike }).EyeDropper ?? null) : null);

/** Saved with `hex` at the end, once, never past 24. */
export function withSaved(saved: readonly string[], hex: string): string[] {
  const colour = normaliseHex(hex);
  if (!colour || saved.includes(colour)) return [...saved];
  return saved.length >= FAVOURITES_MAX ? [...saved] : [...saved, colour];
}

/* ── the wheel ── */

function Wheel({ colour, lightness, onPick }: { colour: string | null; lightness: number; onPick: (hex: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const [focused, setFocused] = useState(false);
  const radius = WHEEL_SIZE / 2;
  const at = colour ? hexToHsl(colour) : null;
  const point = at ? wheelPoint(at.h, at.s, radius) : null;

  // Drawn pixel by pixel, and again whenever the lightness changes.
  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext?.("2d");
    if (!el || !context) return;
    const ratio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    const size = WHEEL_SIZE * ratio;
    el.width = size;
    el.height = size;
    const image = context.createImageData(size, size);
    image.data.set(wheelPixels(size, lightness));
    context.putImageData(image, 0, 0);
  }, [lightness]);

  const pickAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const { h, s } = wheelAt(event.clientX - box.left - radius, event.clientY - box.top - radius, radius);
    onPick(hslToHex({ h, s, l: lightness }));
  };

  return (
    <div style={{ position: "relative", width: WHEEL_SIZE, height: WHEEL_SIZE, flexShrink: 0 }}>
      <canvas
        ref={canvas}
        width={WHEEL_SIZE}
        height={WHEEL_SIZE}
        tabIndex={0}
        role="slider"
        aria-label={COLOUR_PICKER_COPY.wheel}
        aria-valuetext={colour ?? COLOUR_PICKER_COPY.none}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(at?.h ?? 0)}
        data-testid="colour-wheel"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          pickAt(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) pickAt(event);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(event: KeyboardEvent<HTMLCanvasElement>) => {
          const next = wheelKey(event.key, { h: at?.h ?? 0, s: at?.s ?? 0 });
          if (!next) return;
          event.preventDefault();
          onPick(hslToHex({ ...next, l: lightness }));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: "50%", display: "block", cursor: "crosshair", touchAction: "none", ...(focused ? ring(true) : { outline: "none" }) }}
      />
      {point ? (
        <span
          aria-hidden="true"
          data-testid="wheel-marker"
          style={{
            position: "absolute",
            left: radius + point.x - 5,
            top: radius + point.y - 5,
            width: 10,
            height: 10,
            boxSizing: "border-box",
            borderRadius: "50%",
            boxShadow: `0 0 0 2px ${t.text}, inset 0 0 0 1px ${t.window}`,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

/* ── lightness ── */

function Lightness({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const { state, handlers } = useInteractive<HTMLDivElement>();
  const share = (value - LIGHTNESS_MIN) / (LIGHTNESS_MAX - LIGHTNESS_MIN);
  const fromPointer = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    onChange(lightnessOf(LIGHTNESS_MIN + ((clientX - box.left) / box.width) * (LIGHTNESS_MAX - LIGHTNESS_MIN)));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={words(12, 400, t.label)}>{COLOUR_PICKER_COPY.lightness}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={COLOUR_PICKER_COPY.lightness}
        aria-valuemin={LIGHTNESS_MIN}
        aria-valuemax={LIGHTNESS_MAX}
        aria-valuenow={value}
        data-testid="colour-lightness"
        {...handlers}
        onKeyDown={(event) => {
          const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
          if (event.key === "Home") onChange(LIGHTNESS_MIN);
          else if (event.key === "End") onChange(LIGHTNESS_MAX);
          else if (step) onChange(lightnessOf(value + step));
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          fromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging.current) fromPointer(event.clientX);
        }}
        onPointerUp={() => (dragging.current = false)}
        style={{ position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none", borderRadius: 6, ...(state.focusVisible ? ring(true) : { outline: "none" }) }}
      >
        {/* The track is the well; the thumb the control. */}
        <span aria-hidden="true" style={{ ...WELL, position: "absolute", left: 0, right: 0, height: 6, borderRadius: 4 }} />
        <span aria-hidden="true" style={{ ...CONTROL, position: "absolute", left: `calc(${share * 100}% - 8px)`, width: 16, height: 16, boxSizing: "border-box", borderRadius: "50%" }} />
      </div>
    </div>
  );
}

/* ── swatches ── */

function Swatch({ hex, current, onPick, onKeyDown }: { hex: string; current: boolean; onPick: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={hex}
      aria-pressed={current}
      data-swatch={hex}
      onClick={onPick}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        width: SWATCH,
        height: SWATCH,
        padding: 0,
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        flexShrink: 0,
        ...swatchFor(hex),
        // The current colour: a 2px gap, then a 1.5px ring in `--text`.
        boxShadow: current ? `0 0 0 2px ${t.window}, 0 0 0 3.5px ${t.text}` : `inset 0 0 0 1px ${t.hairline}`,
        ...ring(state.focusVisible),
      }}
    />
  );
}

/** Left and right move along a row of swatches. */
function moveAlong(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const row = event.currentTarget.closest("[data-swatch-row]");
  const all = Array.from(row?.querySelectorAll<HTMLButtonElement>("button[data-swatch]") ?? []);
  const at = all.indexOf(event.currentTarget);
  const next = all[at + (event.key === "ArrowRight" ? 1 : -1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

/** The dashed circle at the end of Saved: saves the colour shown. */
function SaveCircle({ disabled, onSave }: { disabled: boolean; onSave: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      aria-label={COLOUR_PICKER_COPY.saveThis}
      title={COLOUR_PICKER_COPY.saveThis}
      disabled={disabled}
      data-testid="save-colour"
      onClick={onSave}
      {...handlers}
      style={{
        width: SWATCH,
        height: SWATCH,
        padding: 0,
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `1px dashed ${t.segOnBorder}`,
        background: state.hovered && !disabled ? t.controlOn : "transparent",
        color: disabled ? t.textDisabled : t.text2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name="plus" size={12} />
    </button>
  );
}

/** A saved swatch, with its menu on right-click (press and hold on a phone): Use this colour, Remove from saved. */
export function SavedSwatch({ hex, current, onUse, onRemove }: { hex: string; current: boolean; onUse: () => void; onRemove: () => void }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <span style={{ display: "inline-flex" }} data-saved-swatch={hex}>
          <Swatch hex={hex} current={current} onPick={onUse} onKeyDown={moveAlong} />
        </span>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content style={{ ...menuSurface(), zIndex: 70 }}>
          <ContextMenu.Item style={menuItem(true, false)} onSelect={onUse}>
            {COLOUR_PICKER_COPY.useThis}
          </ContextMenu.Item>
          <ContextMenu.Item style={menuItem(true, false)} onSelect={onRemove}>
            {COLOUR_PICKER_COPY.removeSaved}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function SwatchRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", alignItems: "center", minHeight: 34, minWidth: 0 }}>
      <span aria-hidden="true" style={{ ...words(12, 400, t.label), width: LABEL_COLUMN, flexShrink: 0 }}>
        {label}
      </span>
      <div data-swatch-row="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: GAP.swatch, padding: "6px 0", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ── the colour code ── */

function CodeField({ colour, phone, onApply }: { colour: string | null; phone: boolean; onApply: (hex: string) => void }) {
  const [typed, setTyped] = useState(colour ?? "");
  const [problem, setProblem] = useState(false);
  const [focused, setFocused] = useState(false);
  const hintId = useRef(`colour-hint-${Math.random().toString(36).slice(2, 8)}`).current;
  // Shows the colour as it changes from elsewhere (the wheel, a swatch), as #RRGGBB.
  useEffect(() => {
    setTyped(colour ?? "");
    setProblem(false);
  }, [colour]);
  const commit = () => {
    if (typed.trim() === (colour ?? "")) return;
    const hex = normaliseHex(typed);
    if (!hex) {
      setProblem(true);
      return;
    }
    setTyped(hex);
    onApply(hex);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flexGrow: 1 }}>
      <input
        type="text"
        aria-label={COLOUR_PICKER_COPY.hex}
        aria-invalid={problem || undefined}
        aria-describedby={problem ? hintId : undefined}
        value={typed}
        placeholder="#RRGGBB"
        spellCheck={false}
        autoComplete="off"
        maxLength={9}
        onChange={(event) => {
          setTyped(event.target.value);
          setProblem(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        style={fieldStyle(phone, { ...CODE_FIELD, ...(phone ? null : { height: 30, borderRadius: 7 }), ...(focused ? FIELD_FOCUS : { outline: "none" }) })}
      />
      {problem ? (
        <p id={hintId} role="alert" style={{ ...words(12, 400, DANGER), margin: 0 }}>
          {COLOUR_PICKER_COPY.hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── linked text and the group ── */

function LinkedPanel({ refs, phone }: { refs: PickerReferences; phone: boolean }) {
  const theme = useResolvedTheme();
  const [query, setQuery] = useState("");
  const found = useMemo(() => (query.trim() ? refs.findWords(query) : []), [query, refs]);
  const linked = refs.linked;
  return (
    <InnerPanel testId="picker-linked" style={{ display: "flex", flexDirection: "column", gap: GAP.column }}>
      <span style={words(12.5, 500, t.text)}>
        {COLOUR_PICKER_COPY.linkedText}
        <span style={words(12.5, 400, t.label)}>{COLOUR_PICKER_COPY.oneOfOne(Boolean(linked))}</span>
      </span>
      {linked ? (
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span data-testid="picker-linked-words" style={{ ...words(13, 400, t.text), ...refWordsStyle(refPaint({ colour: linked.colour, number: linked.number }, theme)), ...ELLIPSIS, cursor: "default" }}>
            {linked.words}
          </span>
          <span style={{ ...data(11, t.label), flexGrow: 1 }}>{COLOUR_PICKER_COPY.post(linked.post)}</span>
          <GhostIcon glyph="x" label={COLOUR_PICKER_COPY.removeLink} size={26} phone={phone} onClick={refs.onRemoveLink} />
        </span>
      ) : (
        <>
          <FieldInput phone={phone} aria-label={COLOUR_PICKER_COPY.findWords} placeholder={COLOUR_PICKER_COPY.findWords} value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false} />
          {query.trim() ? (
            <ul aria-label={COLOUR_PICKER_COPY.findWords} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {found.length === 0 ? (
                <li style={words(12.5, 400, t.text2)}>{COLOUR_PICKER_COPY.noMatch}</li>
              ) : (
                found.map((hit) => (
                  <li key={hit.from}>
                    <FoundRow hit={hit} onPick={() => refs.onLinkFound(hit)} />
                  </li>
                ))
              )}
            </ul>
          ) : null}
          <TextLink phone={phone} onClick={refs.onSelectWords}>
            {COLOUR_PICKER_COPY.selectWords}
          </TextLink>
        </>
      )}
    </InnerPanel>
  );
}

function FoundRow({ hit, onPick }: { hit: FoundWords; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-found={hit.from}
      onClick={onPick}
      {...handlers}
      style={{ appearance: "none", border: 0, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, minHeight: 30, padding: "4px 8px", borderRadius: 6, background: state.hovered ? t.controlOn : "transparent", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <span style={{ ...words(12.5, 400, t.text2), ...ELLIPSIS, flexGrow: 1 }}>
        {hit.before ? `…${hit.before}` : ""}
        <span style={words(12.5, 600, t.text)}>{hit.match}</span>
        {hit.after ? `${hit.after}…` : ""}
      </span>
      <span style={{ ...data(11, t.label), flexShrink: 0 }}>{COLOUR_PICKER_COPY.post(hit.post)}</span>
    </button>
  );
}

function GroupPanel({ refs, colour, phone }: { refs: PickerReferences; colour: string | null; phone: boolean }) {
  const [listing, setListing] = useState(false);
  return (
    <InnerPanel testId="picker-group" style={{ display: "flex", flexDirection: "column", gap: GAP.column }}>
      <span style={words(12.5, 500, t.text)}>
        {COLOUR_PICKER_COPY.group}
        <span style={words(12.5, 400, t.label)}>{COLOUR_PICKER_COPY.notInOne}</span>
      </span>
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <RecipeButton small phone={phone} onClick={() => refs.onMakeGroup(colour)}>
          {COLOUR_PICKER_COPY.makeGroup}
        </RecipeButton>
        <RecipeButton small phone={phone} disabled={refs.groups.length === 0} aria-expanded={listing} onClick={() => setListing((open) => !open)}>
          {COLOUR_PICKER_COPY.addToGroup}
        </RecipeButton>
      </span>
      {listing ? (
        <ul aria-label={COLOUR_PICKER_COPY.addToGroup} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {refs.groups.map((group) => (
            <li key={group.id}>
              <GroupChoice group={group} onPick={() => refs.onAddToGroup(group.id)} />
            </li>
          ))}
        </ul>
      ) : null}
    </InnerPanel>
  );
}

function GroupChoice({ group, onPick }: { group: PickerGroup; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-group-choice={group.id}
      onClick={onPick}
      {...handlers}
      style={{ appearance: "none", border: 0, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: GAP.row, height: 32, padding: PAD.row, borderRadius: 7, background: state.hovered ? t.controlOn : "transparent", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <SquareSwatch colour={group.colour} />
      <span style={{ ...words(13, 500, group.name ? t.text : t.text2), ...ELLIPSIS, flexGrow: 1 }}>{group.name ?? COLOUR_PICKER_COPY.noName}</span>
      <span style={{ ...words(12, 400, t.label), flexShrink: 0 }}>{COLOUR_PICKER_COPY.components(group.count).slice(3)}</span>
    </button>
  );
}

/* ── the head and the footer ── */

function Head({ what, phone, onClose }: { what: string; phone: boolean; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: phone ? "0 0 12px" : PAD.head, flexShrink: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1, minWidth: 0 }}>
        {/* On a phone the sheet's own title says "Colour". */}
        {phone ? null : <span style={words(14, 500, t.text)}>{COLOUR_PICKER_COPY.head}</span>}
        <span style={{ ...words(12.5, 400, t.text2), ...ELLIPSIS }}>{what}</span>
      </div>
      {phone ? null : (
        <div style={HEADER_ICONS}>
          <IconSquare glyph="x" label={COLOUR_PICKER_COPY.close} onClick={onClose} />
        </div>
      )}
    </div>
  );
}

const section = (pad: string, phone: boolean, rule = true): CSSProperties => ({ padding: phone ? "12px 0" : pad, ...(rule ? { borderTop: `1px solid ${t.hairline}` } : null), minWidth: 0 });

/* ── the body ── */

function PickerBody({ what, initial, session = false, part = false, swatches, onSwatches, onPreview, onDone, onCancel, phone, references, history }: Omit<ColourPickerProps, "open" | "anchor">) {
  const [colour, setColour] = useState<string | null>(initial);
  const [lightness, setLightness] = useState(() => (initial ? lightnessOf(hexToHsl(initial)?.l ?? LIGHTNESS_START) : LIGHTNESS_START));
  const [alsoTiles, setAlsoTiles] = useState(false);
  const [said, say] = useAnnouncer();

  const apply = useCallback(
    (next: string | null, also = alsoTiles) => {
      setColour(next);
      onPreview(next, also);
      if (next) say(next);
    },
    [alsoTiles, onPreview, say],
  );

  // A colour from a swatch or the field keeps its own lightness; the slider follows it.
  const take = (hex: string) => {
    const hsl = hexToHsl(hex);
    if (hsl) setLightness(lightnessOf(hsl.l));
    apply(hex);
  };

  const onLightness = (next: number) => {
    setLightness(next);
    const hsl = colour ? hexToHsl(colour) : null;
    if (hsl) apply(hslToHex({ h: hsl.h, s: Math.min(hsl.s, SATURATION_MAX), l: next }));
  };

  const Dropper = eyeDropper();
  const group = references?.group;
  const others = references && !group ? references.alsoUsedBy(colour) : [];

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCancel();
    }
  };

  if (group && references) {
    return (
      <div data-testid="colour-picker" data-state="group" onKeyDown={keys} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Head what={what} phone={phone} onClose={onCancel} />
        <div style={{ ...section(PAD.section, phone), display: "flex", flexDirection: "column", gap: GAP.column }}>
          <InnerPanel testId="picker-in-group" bar={group.colour} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SquareSwatch colour={group.colour} size={10} />
            <span style={{ ...words(13, 500, group.name ? t.text : t.text2), ...ELLIPSIS }}>
              {group.name ?? COLOUR_PICKER_COPY.noName}
              <span style={words(13, 400, t.label)}>{COLOUR_PICKER_COPY.components(group.count)}</span>
            </span>
          </InnerPanel>
          <p style={{ ...words(12.5, 400, t.text2, 18), margin: 0 }}>{COLOUR_PICKER_COPY.belongs}</p>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <RecipeButton small phone={phone} onClick={() => references.onOpenGroup(group.id)}>
              {COLOUR_PICKER_COPY.openGroup}
            </RecipeButton>
            <RecipeButton small phone={phone} onClick={references.onRemoveFromGroup}>
              {COLOUR_PICKER_COPY.removeFromGroup}
            </RecipeButton>
          </span>
        </div>
        <div data-testid="colour-picker-footer" style={footerStyle(phone)}>
          {history ? <UndoRedo phone={phone} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.onUndo} onRedo={history.onRedo} /> : null}
          <span style={{ flexGrow: 1 }} />
          <RecipeButton small variant="primary" phone={phone} onClick={onCancel}>
            {COLOUR_PICKER_COPY.done}
          </RecipeButton>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="colour-picker" data-state={colour ? "single" : "none"} onKeyDown={keys} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <LiveRegion message={said} />
      <Head what={what} phone={phone} onClose={onCancel} />
      <div style={{ minHeight: 0, overflowY: phone ? undefined : "auto" }}>
        <div style={{ ...section(PAD.section, phone, false), display: "flex", alignItems: "flex-start", gap: GAP.picker }}>
          <Wheel colour={colour} lightness={lightness} onPick={(hex) => apply(hex)} />
          <div style={{ display: "flex", flexDirection: "column", gap: GAP.column, flexGrow: 1, minWidth: 0 }}>
            <Lightness value={lightness} onChange={onLightness} />
            <span style={words(12, 400, t.label)}>{COLOUR_PICKER_COPY.hex}</span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
              <SquareSwatch colour={colour} size={30} />
              <CodeField colour={colour} phone={phone} onApply={take} />
              {Dropper ? (
                <GhostIcon
                  glyph="eyedropper"
                  label={COLOUR_PICKER_COPY.screen}
                  size={26}
                  phone={phone}
                  onClick={() => {
                    void new Dropper()
                      .open()
                      .then((result) => {
                        const hex = normaliseHex(result.sRGBHex);
                        if (hex) take(hex);
                      })
                      .catch(() => undefined);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div style={{ ...section(PAD.rows, phone), display: "flex", flexDirection: "column" }}>
          <SwatchRow label={COLOUR_PICKER_COPY.saved}>
            {swatches.favourites.map((hex) => (
              <SavedSwatch key={hex} hex={hex} current={hex === colour} onUse={() => take(hex)} onRemove={() => onSwatches({ ...swatches, favourites: swatches.favourites.filter((entry) => entry !== hex) })} />
            ))}
            <SaveCircle disabled={!colour || swatches.favourites.includes(colour) || swatches.favourites.length >= FAVOURITES_MAX} onSave={() => colour && onSwatches({ ...swatches, favourites: withSaved(swatches.favourites, colour) })} />
          </SwatchRow>
          <SwatchRow label={COLOUR_PICKER_COPY.recent}>
            {swatches.recent.map((hex) => (
              <Swatch key={hex} hex={hex} current={hex === colour} onPick={() => take(hex)} onKeyDown={moveAlong} />
            ))}
          </SwatchRow>
          <SwatchRow label={COLOUR_PICKER_COPY.suggested}>
            {SUGGESTED_COLOURS.map((hex) => (
              <Swatch key={hex} hex={hex} current={hex === colour} onPick={() => take(hex)} onKeyDown={moveAlong} />
            ))}
          </SwatchRow>
          {others.length > 0 && colour && references ? (
            <span data-testid="also-used-by" style={{ ...words(12, 400, t.label), display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, paddingTop: 6 }}>
              {COLOUR_PICKER_COPY.alsoUsedBy(others.map((other) => other.name).join(", "))}
              <span aria-hidden="true">·</span>
              <TextLink phone={phone} onClick={() => references.onGroupWith(others[0].to, colour)}>
                {COLOUR_PICKER_COPY.makeGroup}
              </TextLink>
            </span>
          ) : null}
          {session || part ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", ...words(12, 400, t.text), paddingTop: 8 }}>
              <Checkbox
                checked={alsoTiles}
                onChange={(event) => {
                  setAlsoTiles(event.target.checked);
                  onPreview(colour, event.target.checked);
                }}
              />
              {part ? COLOUR_PICKER_COPY.alsoSessions : COLOUR_PICKER_COPY.alsoTiles}
            </label>
          ) : null}
        </div>
        {references ? (
          <div style={{ ...section(PAD.section, phone), display: "flex", flexDirection: "column", gap: GAP.panels }}>
            <LinkedPanel refs={references} phone={phone} />
            <GroupPanel refs={references} colour={colour} phone={phone} />
          </div>
        ) : null}
      </div>
      <div data-testid="colour-picker-footer" style={footerStyle(phone)}>
        {history ? <UndoRedo phone={phone} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.onUndo} onRedo={history.onRedo} /> : null}
        <span style={{ flexGrow: 1 }} />
        <TextButton target={phone} disabled={!colour} style={words(12.5, 400, t.text2)} onClick={() => apply(null)}>
          {COLOUR_PICKER_COPY.none}
        </TextButton>
        <RecipeButton small variant="primary" phone={phone} onClick={() => onDone(colour, alsoTiles)}>
          {COLOUR_PICKER_COPY.done}
        </RecipeButton>
      </div>
    </div>
  );
}

export function ColourPicker(props: ColourPickerProps) {
  const { open, anchor, phone, onCancel } = props;
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  // A new component, or the picker opened again, starts afresh on that component's colour.
  const key = useMemo(() => `${props.what}:${props.initial ?? "none"}:${open}:${props.references?.group?.id ?? ""}`, [props.what, props.initial, open, props.references?.group?.id]);

  useLayoutEffect(() => {
    if (!open || phone || !anchor || props.inline) return;
    const at = anchor.getBoundingClientRect();
    const height = box.current?.offsetHeight ?? 560;
    const below = at.bottom + 4;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, Math.min(at.top - 4 - height, window.innerHeight - height - 8)) : below;
    setPlace({ top, left: Math.max(8, Math.min(at.right - PICKER_WIDTH, window.innerWidth - PICKER_WIDTH - 8)) });
  }, [open, phone, anchor]);

  // A press outside puts the colour back. Not inside a menu the picker opened, nor on the notice.
  useEffect(() => {
    if (!open || phone || props.inline) return;
    const away = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      if (box.current?.contains(target) || target?.closest?.("[data-radix-popper-content-wrapper]") || target?.closest?.('[data-testid="reference-notice"]') || target === anchor || anchor?.contains(target)) return;
      onCancel();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open, phone, anchor, onCancel, props.inline]);

  // Focus goes into the picker as it opens, and back to the button as it closes.
  useEffect(() => {
    if (!open || phone) return;
    box.current?.querySelector<HTMLElement>("canvas, button")?.focus({ preventScroll: true });
    return () => anchor?.focus({ preventScroll: true });
  }, [open, phone, anchor]);

  if (!open) return null;
  if (props.inline) {
    return (
      <div ref={box} role="dialog" aria-label={`${COLOUR_PICKER_COPY.head}: ${props.what}`} data-testid="colour-picker-inline" style={{ ...frameStyle(PICKER_WIDTH), maxWidth: "100%", boxShadow: "none" }}>
        <PickerBody key={key} {...props} phone={false} />
      </div>
    );
  }
  if (phone) {
    return (
      <BottomSheet open onOpenChange={(next) => !next && onCancel()} title={COLOUR_PICKER_COPY.head}>
        <PickerBody key={key} {...props} />
      </BottomSheet>
    );
  }
  const surface: CSSProperties = { ...frameStyle(PICKER_WIDTH), position: "fixed", zIndex: 60, top: place?.top ?? -9999, left: place?.left ?? 0, maxHeight: "calc(100dvh - 16px)" };
  return createPortal(
    <div ref={box} role="dialog" aria-label={`${COLOUR_PICKER_COPY.head}: ${props.what}`} style={surface}>
      <PickerBody key={key} {...props} />
    </div>,
    document.body,
  );
}

/** What Done leaves Recent as: the colour first, when one was applied. */
export const recentAfterDone = (swatches: Swatches, colour: string | null): Swatches => (colour ? { ...swatches, recent: withRecent(swatches.recent, colour) } : swatches);

export default ColourPicker;
