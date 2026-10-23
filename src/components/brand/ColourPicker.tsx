// ColourPicker: the colour of a tile or a session (CA-06 P5).
//
// A popover on the menu surface, 264 wide, padding 14, gap 12 (a BottomSheet on a phone). Top to bottom: the head
// ("Colour" and what it colours), the wheel, lightness, the hex field with Copy, Pick from the screen (only where the
// browser can), Suggested, Recent, Favourites, No colour, then Cancel and Done under a hairline. A session's picker
// also offers "Also colour its tiles that have no colour", off to start; a part's (CA-17) offers "Also colour its sessions
// that have no colour" in the same place.
//
// THE WHEEL IS A CANVAS, drawn pixel by pixel (no CSS gradient anywhere): angle is hue, distance from the centre is
// saturation from 0 to 70%, at the lightness the slider sets. Drag or click picks; with the canvas focused the arrow
// keys move hue (left, right) and saturation (up, down) by 2; the hex is said through a live region as it changes.
//
// EVERY CHANGE PREVIEWS LIVE (`onPreview`): on the tile, the session and the post's links. Cancel and Escape put back
// the colour the part had when the picker opened; Done keeps it. No colour is ever chosen for the maker: the picker
// opens on the part's own colour, or on none.

import * as ContextMenu from "@radix-ui/react-context-menu";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { BottomSheet } from "@/components/shell/BottomSheet";
import type { ColourSwatches } from "@/lib/profile/colourSwatches";
import {
  hexToHsl,
  hslToHex,
  LIGHTNESS_MAX,
  LIGHTNESS_MIN,
  LIGHTNESS_START,
  lightnessOf,
  SATURATION_MAX,
  toggleFavourite,
  wheelAt,
  wheelKey,
  wheelPixels,
  wheelPoint,
  withRecent,
} from "@/lib/theme/colourWheel";
import { fieldStyle, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { HEX_HINT, normaliseHex, SUGGESTED_COLOURS } from "@/lib/theme/partColour";
import { CONTROL, WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { TextButton } from "@/pages/site/compose/composeControls";
import { menuItem, menuSurface, text } from "@/pages/site/compose/refinedStyles";

import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { LiveRegion, useAnnouncer } from "./LiveRegion";

export const COLOUR_PICKER_COPY = {
  head: "Colour",
  wheel: "Colour wheel",
  lightness: "Lightness",
  hex: "Colour code",
  copy: "Copy",
  copied: "Copied",
  screen: "Pick from the screen",
  suggested: "Suggested",
  recent: "Recent",
  favourites: "Favourites",
  save: "Save as favourite",
  unsave: "Remove from favourites",
  remove: "Remove",
  none: "No colour",
  cancel: "Cancel",
  done: "Done",
  alsoTiles: "Also colour its tiles that have no colour",
  alsoSessions: "Also colour its sessions that have no colour",
  hint: HEX_HINT,
} as const;

export const PICKER_WIDTH = 264;
/** The picker's padding: 14, as the Post References page draws it. */
const PAD = "14px";
export const WHEEL_SIZE = 168;
const SWATCH = 22;

/** Recent and Favourites, as the maker's profile keeps them (CA-06 P6). */
export type Swatches = ColourSwatches;

export interface ColourPickerProps {
  open: boolean;
  /** The button that opened it: the popover goes under it. */
  anchor: HTMLElement | null;
  /** What it colours: "Prompt 7 · Launch email". */
  what: string;
  /** The part's colour as the picker opens; null for none. */
  initial: string | null;
  /** A session: offers "Also colour its tiles that have no colour". */
  session?: boolean;
  /** CA-17 P5, a part: offers "Also colour its sessions that have no colour" instead. */
  part?: boolean;
  swatches: Swatches;
  onSwatches: (next: Swatches) => void;
  /** Every change, as it happens: the page draws it on the part and its links. */
  onPreview: (colour: string | null, alsoTiles: boolean) => void;
  /** Done: keep it. */
  onDone: (colour: string | null, alsoTiles: boolean) => void;
  /** Cancel, Escape, a press outside: the page puts back `initial`. */
  onCancel: () => void;
  phone: boolean;
}

/** What the EyeDropper API returns, where the browser has it. */
type EyeDropperLike = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperLike | null => (typeof window !== "undefined" && "EyeDropper" in window ? ((window as unknown as { EyeDropper: EyeDropperLike }).EyeDropper ?? null) : null);

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
    <div style={{ position: "relative", width: WHEEL_SIZE, height: WHEEL_SIZE, alignSelf: "center" }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ ...text(12, 400, t.label), flexShrink: 0 }}>{COLOUR_PICKER_COPY.lightness}</span>
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
        style={{ position: "relative", flexGrow: 1, height: 20, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none", borderRadius: 6, ...(state.focusVisible ? ring(true) : { outline: "none" }) }}
      >
        {/* The track is the well; the thumb the control. */}
        <span aria-hidden="true" style={{ ...WELL, position: "absolute", left: 0, right: 0, height: 6, borderRadius: 4 }} />
        <span
          aria-hidden="true"
          style={{ ...CONTROL, position: "absolute", left: `calc(${share * 100}% - 8px)`, width: 16, height: 16, boxSizing: "border-box", borderRadius: "50%" }}
        />
      </div>
      <span style={{ ...text(12, 400, t.text2), fontVariantNumeric: "tabular-nums", minWidth: 20, textAlign: "right" }}>{value}</span>
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
        background: hex,
        cursor: "pointer",
        flexShrink: 0,
        boxShadow: current ? `0 0 0 2px ${t.window}, 0 0 0 4px ${t.text}` : `inset 0 0 0 1px ${t.hairline}`,
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

function SwatchRow({ label, colours, current, onPick, onRemove }: { label: string; colours: readonly string[]; current: string | null; onPick: (hex: string) => void; onRemove?: (hex: string) => void }) {
  if (colours.length === 0) return null;
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={text(12, 400, t.label)}>{label}</span>
      <div data-swatch-row="" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {colours.map((hex) =>
          onRemove ? (
            <ContextMenu.Root key={hex}>
              <ContextMenu.Trigger asChild>
                <span style={{ display: "inline-flex" }}>
                  <Swatch hex={hex} current={hex === current} onPick={() => onPick(hex)} onKeyDown={moveAlong} />
                </span>
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content style={{ ...menuSurface(), zIndex: 70 }}>
                  <ContextMenu.Item style={menuItem(true, false)} onSelect={() => onRemove(hex)}>
                    {COLOUR_PICKER_COPY.remove}
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          ) : (
            <Swatch key={hex} hex={hex} current={hex === current} onPick={() => onPick(hex)} onKeyDown={moveAlong} />
          ),
        )}
      </div>
    </div>
  );
}

/* ── the body ── */

function PickerBody({ what, initial, session = false, part = false, swatches, onSwatches, onPreview, onDone, onCancel, phone }: Omit<ColourPickerProps, "open" | "anchor">) {
  const [colour, setColour] = useState<string | null>(initial);
  const [lightness, setLightness] = useState(() => (initial ? lightnessOf(hexToHsl(initial)?.l ?? LIGHTNESS_START) : LIGHTNESS_START));
  const [typed, setTyped] = useState(initial ?? "");
  const [problem, setProblem] = useState(false);
  const [alsoTiles, setAlsoTiles] = useState(false);
  const [fieldFocus, setFieldFocus] = useState(false);
  const [said, say] = useAnnouncer();
  const hintId = useRef(`colour-hint-${Math.random().toString(36).slice(2, 8)}`).current;

  const apply = useCallback(
    (next: string | null, also = alsoTiles) => {
      setColour(next);
      setTyped(next ?? "");
      setProblem(false);
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

  const commitTyped = () => {
    if (typed.trim() === (colour ?? "")) return;
    const hex = normaliseHex(typed);
    if (!hex) {
      setProblem(true);
      return;
    }
    take(hex);
  };

  const favourite = colour ? swatches.favourites.includes(colour) : false;
  const Dropper = eyeDropper();
  const quiet = text(12, 400, t.label);

  return (
    <div
      data-testid="colour-picker"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <LiveRegion message={said} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* On a phone the sheet's own title says "Colour". */}
        {phone ? null : <span style={text(13, 500, t.text)}>{COLOUR_PICKER_COPY.head}</span>}
        <span style={text(12, 400, t.label)}>{what}</span>
      </div>
      <Wheel colour={colour} lightness={lightness} onPick={(hex) => apply(hex)} />
      <Lightness value={lightness} onChange={onLightness} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" data-testid="colour-current" style={{ width: 12, height: 12, borderRadius: 4, flexShrink: 0, boxSizing: "border-box", ...(colour ? { background: colour } : { boxShadow: `inset 0 0 0 1px ${t.label}` }) }} />
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
                commitTyped();
              }
            }}
            onFocus={() => setFieldFocus(true)}
            onBlur={() => {
              setFieldFocus(false);
              commitTyped();
            }}
            style={{ ...fieldStyle({ focusVisible: fieldFocus, invalid: problem }), width: 96, boxSizing: "border-box", height: phone ? 44 : 28, padding: "0 8px", fontFamily: DM_MONO, fontSize: phone ? 16 : 12.5 }}
          />
          <TextButton
            target={phone}
            disabled={!colour}
            style={text(12, 500, t.text2)}
            onClick={() => {
              if (!colour) return;
              void navigator.clipboard?.writeText(colour).then(() => say(COLOUR_PICKER_COPY.copied), () => undefined);
            }}
          >
            {COLOUR_PICKER_COPY.copy}
          </TextButton>
        </div>
        {problem ? (
          <p id={hintId} role="alert" style={{ ...text(12, 400, t.text), margin: 0 }}>
            {COLOUR_PICKER_COPY.hint}
          </p>
        ) : null}
      </div>
      {Dropper ? (
        <span>
          <TextButton
            target={phone}
            style={text(12, 500, t.text2)}
            onClick={() => {
              void new Dropper()
                .open()
                .then((result) => {
                  const hex = normaliseHex(result.sRGBHex);
                  if (hex) take(hex);
                })
                .catch(() => undefined);
            }}
          >
            {COLOUR_PICKER_COPY.screen}
          </TextButton>
        </span>
      ) : null}
      <SwatchRow label={COLOUR_PICKER_COPY.suggested} colours={SUGGESTED_COLOURS} current={colour} onPick={take} />
      <SwatchRow label={COLOUR_PICKER_COPY.recent} colours={swatches.recent} current={colour} onPick={take} />
      <SwatchRow
        label={COLOUR_PICKER_COPY.favourites}
        colours={swatches.favourites}
        current={colour}
        onPick={take}
        onRemove={(hex) => onSwatches({ ...swatches, favourites: swatches.favourites.filter((entry) => entry !== hex) })}
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {colour ? (
          <TextButton target={phone} style={text(12, 500, t.text2)} onClick={() => onSwatches({ ...swatches, favourites: toggleFavourite(swatches.favourites, colour) })}>
            {favourite ? COLOUR_PICKER_COPY.unsave : COLOUR_PICKER_COPY.save}
          </TextButton>
        ) : null}
        <TextButton target={phone} disabled={!colour} style={text(12, 500, t.text2)} onClick={() => apply(null)}>
          {COLOUR_PICKER_COPY.none}
        </TextButton>
      </div>
      {session || part ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", ...quiet, color: t.text }}>
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 12, borderTop: `1px solid ${t.hairlineModule}` }}>
        <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={onCancel}>
          {COLOUR_PICKER_COPY.cancel}
        </Button>
        <Button size={phone ? 44 : 28} fontSize={12} onClick={() => onDone(colour, alsoTiles)}>
          {COLOUR_PICKER_COPY.done}
        </Button>
      </div>
    </div>
  );
}

export function ColourPicker(props: ColourPickerProps) {
  const { open, anchor, phone, onCancel } = props;
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  // A new part, or the picker opened again, starts afresh on that part's colour.
  const key = useMemo(() => `${props.what}:${props.initial ?? "none"}:${open}`, [props.what, props.initial, open]);

  useLayoutEffect(() => {
    if (!open || phone || !anchor) return;
    const at = anchor.getBoundingClientRect();
    const height = box.current?.offsetHeight ?? 560;
    const below = at.bottom + 4;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, at.top - 4 - height) : below;
    setPlace({ top, left: Math.max(8, Math.min(at.right - PICKER_WIDTH, window.innerWidth - PICKER_WIDTH - 8)) });
  }, [open, phone, anchor]);

  // A press outside is Cancel. Not inside a context menu the picker opened.
  useEffect(() => {
    if (!open || phone) return;
    const away = (event: globalThis.PointerEvent) => {
      const target = event.target as Element | null;
      if (box.current?.contains(target) || target?.closest?.("[data-radix-popper-content-wrapper]") || target === anchor || anchor?.contains(target)) return;
      onCancel();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open, phone, anchor, onCancel]);

  // Focus goes into the picker as it opens, and back to the button as it closes.
  useEffect(() => {
    if (!open || phone) return;
    box.current?.querySelector<HTMLElement>("canvas")?.focus({ preventScroll: true });
    return () => anchor?.focus({ preventScroll: true });
  }, [open, phone, anchor]);

  if (!open) return null;
  if (phone) {
    return (
      <BottomSheet open onOpenChange={(next) => !next && onCancel()} title={COLOUR_PICKER_COPY.head}>
        <PickerBody key={key} {...props} />
      </BottomSheet>
    );
  }
  const surface: CSSProperties = { ...menuSurface(PICKER_WIDTH), padding: PAD, position: "fixed", zIndex: 60, top: place?.top ?? -9999, left: place?.left ?? 0, boxSizing: "border-box", maxHeight: "calc(100dvh - 16px)", overflowY: "auto" };
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
