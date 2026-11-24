/* UI-P30 — "Watch it get built", inside the part viewer.

   The replay's own behaviour (src/components/build/Replay.tsx: one step every
   PLAY_INTERVAL_MS, stopping at the end; a jump when another tab asks for a
   step; a dot over every step somebody rebuilt from; "Rebuild from here"; what
   existed at the step) with its controls in the site frame's grammar:

     play / pause    an IconButton 34
     the scrubber    a StripedBar in `--lit`, 9 tall, with a real
                     <input type="range"> laid over it, so the keyboard and the
                     pointer both move it and a screen reader hears a slider
     the step        its kind, coloured as the timeline colours it, and its
                     line in Figtree 14

   Under them, what existed at that step (the part the latest producing step
   made, drawn by the page through the anatomy's own renderer) and every step in
   order, in its phase, each one a button that goes to it.

   PURE. The page hands the steps, the markers and the drawing of a produced
   part; this file holds only where the reader is and whether it is playing. */

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { BigButton } from "@/components/phone/BigButton";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { Pause, Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { IconButton } from "@/components/brand/IconButton";
import { StripedBar } from "@/components/brand/StripedBar";
import { EVENT_INK } from "@/components/brand/Timeline";
import { PLAY_INTERVAL_MS } from "@/components/build/Replay";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { divergenceSummary, type ReplayEventView, type ReplayView } from "./buildModel";

/** The scrubber's bar. */
const BAR_HEIGHT = 9;
/** The slider's hit area: the bar is 9 tall, a finger needs 44. */
const HIT_HEIGHT = 44;

const kindStyle = (kind: ReplayEventView["kind"]): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: 13,
  letterSpacing: ".08em",
  textTransform: "none",
  color: EVENT_INK[kind],
  whiteSpace: "nowrap",
});

/* ── the scrubber ── */

function Scrubber({
  events,
  position,
  markers,
  onMove,
  onPointMarker,
}: {
  events: readonly ReplayEventView[];
  position: number;
  markers: ReplayView["markers"];
  onMove: (index: number) => void;
  onPointMarker: (index: number | null, open?: boolean) => void;
}) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  const last = Math.max(events.length - 1, 0);
  const current = events[Math.min(position, last)];
  const percent = last === 0 ? 100 : (position / last) * 100;
  const at = (index: number) => (last === 0 ? 0 : (index / last) * 100);

  return (
    <div data-testid="build-replay-scrubber" style={{ position: "relative", minWidth: 0, height: BAR_HEIGHT }}>
      {/* The picture of where the reader is. The slider below is the control and carries the semantics. */}
      <div aria-hidden="true" style={{ borderRadius: r.chip, ...ring(state.focusVisible) }}>
        <StripedBar value={percent} colour={t.lit} height={BAR_HEIGHT} label="Where the replay is" />
      </div>
      <input
        type="range"
        data-testid="build-replay-slider"
        min={0}
        max={last}
        step={1}
        value={Math.min(position, last)}
        onChange={(event) => onMove(Number(event.currentTarget.value))}
        aria-label="Step through the build"
        aria-valuetext={`Step ${current.ordinal} of ${events[last].ordinal}: ${current.kind}, ${current.text}`}
        {...handlers}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (BAR_HEIGHT - HIT_HEIGHT) / 2,
          width: "100%",
          height: HIT_HEIGHT,
          margin: 0,
          opacity: 0,
          cursor: "pointer",
        }}
      />
      {/* A dot over every step somebody rebuilt from. Above the slider, so a
          press on a dot opens the rebuild rather than moving the replay. */}
      {markers.map((marker) => (
        <button
          key={marker.index}
          type="button"
          data-testid="divergence-marker"
          data-divergence-ordinal={events[marker.index]?.ordinal}
          aria-label={marker.label}
          title={marker.label}
          onMouseEnter={() => onPointMarker(marker.index)}
          onMouseLeave={() => onPointMarker(null)}
          onFocus={() => onPointMarker(marker.index)}
          onBlur={() => onPointMarker(null)}
          onClick={() => onPointMarker(marker.index, true)}
          style={{
            position: "absolute",
            zIndex: 1,
            left: `calc(${at(marker.index)}% - 8px)`,
            top: -18,
            width: 16,
            height: 16,
            padding: 0,
            border: 0,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            borderRadius: r.full,
          }}
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: r.full, background: t.evidence }} />
        </button>
      ))}
    </div>
  );
}

/* ── the steps, in order ── */

function StepList({
  events,
  position,
  phone,
  onGo,
}: {
  events: readonly ReplayEventView[];
  position: number;
  phone: boolean;
  onGo: (index: number) => void;
}) {
  /* Phase headings only when the creator named at least one phase: a list of
     "Unphased" headings would say nothing. */
  const titled = events.some((event) => event.phaseTitle);
  const runs = useMemo(() => {
    const out: { key: string; title: string | null; items: { event: ReplayEventView; index: number }[] }[] = [];
    events.forEach((event, index) => {
      const run = out[out.length - 1];
      if (run && run.key === event.phaseKey) run.items.push({ event, index });
      else out.push({ key: event.phaseKey, title: event.phaseTitle, items: [{ event, index }] });
    });
    return out;
  }, [events]);

  return (
    <div data-testid="build-replay-steps">
      {runs.map((run) => (
        <div key={run.key}>
          {titled ? (
            <div
              style={{
                fontFamily: FIGTREE,
                fontSize: 13,
                letterSpacing: ".09em",
                textTransform: "none",
                color: t.label,
                padding: "9px 0 4px",
              }}
            >
              {run.title ?? "Unphased"}
            </div>
          ) : null}
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {run.items.map(({ event, index }) => (
              <StepRow key={event.id} event={event} current={index === position} phone={phone} onGo={() => onGo(index)} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function StepRow({ event, current, phone, onGo }: { event: ReplayEventView; current: boolean; phone: boolean; onGo: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <li>
      <button
        type="button"
        data-testid="build-replay-step"
        data-event-ordinal={event.ordinal}
        aria-current={current ? "step" : undefined}
        aria-label={`Go to step ${event.ordinal}: ${event.kind}, ${event.text}`}
        onClick={onGo}
        {...handlers}
        style={{
          display: "grid",
          gridTemplateColumns: phone ? "48px 78px minmax(0, 1fr)" : "44px 74px minmax(0, 1fr)",
          gap: 6,
          alignItems: "center",
          width: "100%",
          /* A step is a control: 44 on a phone (the touch floor), a one-line row's 32 above it. */
          minHeight: phone ? 44 : 32,
          padding: "0 7px",
          borderRadius: r.control,
          border: 0,
          background: current ? t.rowHighlight : "transparent",
          color: t.text,
          textAlign: "left",
          cursor: "pointer",
          boxSizing: "border-box",
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.label }}>{event.at}</span>
        <span style={kindStyle(event.kind)}>{event.kind}</span>
        <span
          style={{
            fontFamily: FIGTREE,
            fontSize: phone ? 13 : 13,
            lineHeight: 1.4,
            color: t.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {event.text}
        </span>
      </button>
    </li>
  );
}

/* ── the body ── */


/* ── on a phone (prompt 22) ── */

/** The phone's scrubber: a 4px track on Raised, the played part Mint, a 16 thumb in Text, a 28 tall hit area. */
const PHONE_TRACK = 4;
const PHONE_THUMB = 16;
const PHONE_SCRUB_HIT = 28;

function PhoneScrubber({ events, position, markers, onMove, onPointMarker }: { events: readonly ReplayEventView[]; position: number; markers: ReplayView["markers"]; onMove: (index: number) => void; onPointMarker: (index: number | null, open?: boolean) => void }) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  const last = Math.max(events.length - 1, 0);
  const current = events[Math.min(position, last)];
  const percent = last === 0 ? 100 : (position / last) * 100;
  const at = (index: number) => (last === 0 ? 0 : (index / last) * 100);
  return (
    <div data-testid="build-replay-scrubber" style={{ position: "relative", flex: "1 1 0", minWidth: 0, height: PHONE_SCRUB_HIT }}>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: (PHONE_SCRUB_HIT - PHONE_TRACK) / 2, height: PHONE_TRACK, borderRadius: PHONE_TRACK / 2, background: t.control }}>
        <div style={{ width: `${percent}%`, height: "100%", borderRadius: PHONE_TRACK / 2, background: t.brandAccent }} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: (PHONE_SCRUB_HIT - PHONE_THUMB) / 2,
          left: `calc(${percent}% - ${(percent / 100) * PHONE_THUMB}px)`,
          width: PHONE_THUMB,
          height: PHONE_THUMB,
          borderRadius: r.full,
          background: t.text,
          ...ring(state.focusVisible),
        }}
      />
      <input
        type="range"
        data-testid="build-replay-slider"
        min={0}
        max={last}
        step={1}
        value={Math.min(position, last)}
        onChange={(event) => onMove(Number(event.currentTarget.value))}
        aria-label="Where the replay is"
        aria-valuetext={`Step ${current.ordinal} of ${events[last].ordinal}: ${current.kind}, ${current.text}`}
        {...handlers}
        style={{ position: "absolute", inset: 0, width: "100%", height: PHONE_SCRUB_HIT, margin: 0, opacity: 0, cursor: "pointer" }}
      />
      {markers.map((marker) => (
        <button
          key={marker.index}
          type="button"
          data-testid="divergence-marker"
          data-divergence-ordinal={events[marker.index]?.ordinal}
          aria-label={marker.label}
          onFocus={() => onPointMarker(marker.index)}
          onBlur={() => onPointMarker(null)}
          onClick={() => onPointMarker(marker.index, true)}
          style={{ position: "absolute", zIndex: 1, left: `calc(${at(marker.index)}% - 8px)`, top: -12, width: 16, height: 16, padding: 0, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: r.full }}
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: r.full, background: t.evidence }} />
        </button>
      ))}
    </div>
  );
}

function PhoneReplay({
  events,
  position,
  playing,
  made,
  markers,
  pointed,
  onToggle,
  onMove,
  onPointMarker,
  onOpenRebuild,
  onFork,
  forkPending,
}: {
  events: readonly ReplayEventView[];
  position: number;
  playing: boolean;
  made: { ordinal: number; node: ReactNode } | null;
  markers: ReplayView["markers"];
  pointed: ReplayView["markers"][number] | undefined;
  onToggle: () => void;
  onMove: (index: number) => void;
  onPointMarker: (index: number | null, open?: boolean) => void;
  onOpenRebuild?: (id: string) => void;
  onFork?: (ordinal: number) => void;
  forkPending: boolean;
}) {
  const play = useInteractive<HTMLButtonElement>();
  const last = Math.max(events.length - 1, 0);
  const current = events[Math.min(position, last)];
  return (
    <section data-testid="build-replay" aria-label="Watch it get built" style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FIGTREE }}>
      {/* The frame of the result, on Card with the dot grid behind it. */}
      <div
        data-testid="build-replay-frame"
        style={{
          height: 240,
          borderRadius: 16,
          background: t.module,
          backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
          overflow: "auto",
          padding: 16,
          boxSizing: "border-box",
          display: "flex",
          alignItems: made ? "flex-start" : "center",
          justifyContent: "center",
        }}
      >
        {made ? (
          <div data-testid="build-replay-produced" data-produced-by-ordinal={made.ordinal} style={{ width: "100%", minWidth: 0, borderRadius: 12, background: t.surface, padding: 12, boxSizing: "border-box" }}>
            {made.node}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: "20px", color: t.text2, textAlign: "center" }}>Nothing had been made yet at this point.</p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: markers.length > 0 ? 8 : 0 }}>
        <button
          type="button"
          aria-label={playing ? "Pause the build" : "Play the build"}
          aria-pressed={playing}
          onClick={onToggle}
          {...play.handlers}
          style={{ flexShrink: 0, width: 48, height: 48, padding: 0, border: 0, borderRadius: r.full, background: t.brandAccent, color: t.onBrandAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(play.state.focusVisible) }}
        >
          <MobileIcon name={playing ? "pause" : "play"} size={22} />
        </button>
        <PhoneScrubber events={events} position={position} markers={markers} onMove={onMove} onPointMarker={onPointMarker} />
        <span style={{ flexShrink: 0, fontFamily: DM_MONO, fontSize: 13, color: t.label, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {position + 1} / {events.length}
        </span>
      </div>

      {markers.length > 0 ? (
        <p data-testid="divergence-names" style={{ margin: 0, fontSize: 13, lineHeight: "16px", color: t.text2 }}>
          {pointed
            ? pointed.rebuilds.map((rebuild, index) => (
                <span key={rebuild.id}>
                  {index > 0 ? ", " : null}
                  <button type="button" onClick={() => onOpenRebuild?.(rebuild.id)} style={{ padding: 0, minHeight: 44, border: 0, background: "transparent", fontFamily: FIGTREE, fontSize: 13, color: t.text, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
                    {rebuild.label}
                  </button>
                </span>
              ))
            : divergenceSummary(markers)}
        </p>
      ) : null}

      <div data-testid="build-replay-current" style={{ display: "flex", flexDirection: "column", gap: 4, padding: 16, borderRadius: 12, background: t.surface }}>
        <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{[`Event ${current.ordinal}`, current.kind.charAt(0).toUpperCase() + current.kind.slice(1), current.when ?? current.at].join(" · ")}</span>
        {current.phaseTitle ? <span style={{ fontSize: 15, lineHeight: "20px", color: t.text }}>{current.phaseTitle}</span> : null}
        <p style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: t.text2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{current.text}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: onFork ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 8 }}>
        <BigButton full disabled={position >= last} onClick={() => onMove(position + 1)} style={{ padding: "0 12px", whiteSpace: "normal", lineHeight: "18px", textAlign: "center" }}>
          Step through the build
        </BigButton>
        {onFork ? (
          <BigButton full disabled={forkPending} onClick={() => onFork(current.ordinal)} style={{ padding: "0 12px", whiteSpace: "normal", lineHeight: "18px", textAlign: "center" }}>
            {forkPending ? "Rebuilding…" : "Rebuild from here"}
          </BigButton>
        ) : null}
      </div>
    </section>
  );
}

export function ReplayBody({ replay, phone = false }: { replay: ReplayView; phone?: boolean }) {
  const { events, markers, focusOrdinal, produced, onFork, forkPending = false, onOpenRebuild } = replay;
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** The marker being pointed at or opened, as an index into `events`. */
  const [named, setNamed] = useState<number | null>(null);

  const last = Math.max(events.length - 1, 0);
  const go = useCallback((next: number) => setPosition(Math.min(Math.max(next, 0), last)), [last]);

  /* A jump from another tab: the step at that ordinal, or the nearest one below it. */
  useEffect(() => {
    if (focusOrdinal === null || focusOrdinal === undefined) return;
    let target = -1;
    events.forEach((event, index) => {
      if (event.ordinal <= focusOrdinal) target = index;
    });
    if (target >= 0) {
      setPlaying(false);
      setPosition(target);
    }
  }, [focusOrdinal, events]);

  /* A sequence that shrank under the reader keeps them on a step that exists. */
  useEffect(() => {
    setPosition((at) => Math.min(at, last));
  }, [last]);

  /* One step per interval, stopping at the end: a story that restarts itself is a carousel. */
  useEffect(() => {
    if (!playing) return;
    if (position >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => go(position + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, position, last, go]);

  if (events.length === 0) {
    return (
      <p data-testid="build-replay-empty" style={{ margin: 0, color: t.text2 }}>
        No steps were recorded for this build.
      </p>
    );
  }

  const current = events[Math.min(position, last)];
  const made = produced(position);
  const pointed = named === null ? undefined : markers.find((marker) => marker.index === named);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    /* Play from the start once the end has been reached, rather than doing nothing. */
    if (position >= last) setPosition(0);
    setPlaying(true);
  };

  const move = (index: number) => {
    setPlaying(false);
    go(index);
  };

  if (phone) {
    return (
      <PhoneReplay
        events={events}
        position={position}
        playing={playing}
        made={made}
        markers={markers}
        pointed={pointed}
        onToggle={toggle}
        onMove={move}
        onPointMarker={(index, open) => {
          setNamed(index);
          if (!open || index === null) return;
          const marker = markers.find((candidate) => candidate.index === index);
          if (marker && marker.rebuilds.length === 1) onOpenRebuild?.(marker.rebuilds[0].id);
        }}
        onOpenRebuild={onOpenRebuild}
        onFork={onFork}
        forkPending={forkPending}
      />
    );
  }

  return (
    <section data-testid="build-replay" aria-label="Watch it get built" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", gap: 9, alignItems: "center", paddingTop: markers.length > 0 ? 7 : 0 }}>
        <IconButton
          icon={playing ? Pause : Play}
          label={playing ? "Pause the build" : "Play the build"}
          size={32}
          aria-pressed={playing}
          onClick={toggle}
        />
        <Scrubber
          events={events}
          position={position}
          markers={markers}
          onMove={move}
          onPointMarker={(index, open) => {
            setNamed(index);
            if (!open || index === null) return;
            /* One rebuild at a step is unambiguous: the press opens it. Several are named below instead. */
            const marker = markers.find((candidate) => candidate.index === index);
            if (marker && marker.rebuilds.length === 1) onOpenRebuild?.(marker.rebuilds[0].id);
          }}
        />
        <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.text2, whiteSpace: "nowrap" }}>
          step {current.ordinal} of {events[last].ordinal}
        </span>
      </div>

      {markers.length > 0 ? (
        <p data-testid="divergence-names" style={{ margin: 0, fontFamily: DM_MONO, fontSize: 13, color: t.text2 }}>
          {pointed
            ? pointed.rebuilds.map((rebuild, index) => (
                <span key={rebuild.id}>
                  {index > 0 ? ", " : null}
                  <button
                    type="button"
                    onClick={() => onOpenRebuild?.(rebuild.id)}
                    style={{
                      padding: 0,
                      border: 0,
                      background: "transparent",
                      fontFamily: FIGTREE,
                      fontSize: 13,
                      color: t.action,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      cursor: "pointer",
                    }}
                  >
                    {rebuild.label}
                  </button>
                </span>
              ))
            : divergenceSummary(markers)}
        </p>
      ) : null}

      <div data-testid="build-replay-current" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={kindStyle(current.kind)}>{current.kind}</span>
          <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.label }}>{current.at}</span>
        </div>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.65, color: t.text, whiteSpace: "pre-wrap" }}>
          {current.text}
        </p>
      </div>

      {onFork ? (
        <div>
          <Button
            variant="secondary"
            size={30}
            fontSize={13}
            icon={RefreshCw}
            disabled={forkPending}
            onClick={() => onFork(current.ordinal)}
          >
            {forkPending ? "Rebuilding…" : "Rebuild from here"}
          </Button>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Eyebrow size={10}>What existed at step {current.ordinal}</Eyebrow>
        {made ? (
          <div
            data-testid="build-replay-produced"
            data-produced-by-ordinal={made.ordinal}
            style={{ border: `1px solid ${t.line}`, borderRadius: r.control, padding: "9px 10px", minWidth: 0 }}
          >
            {made.node}
          </div>
        ) : (
          <p style={{ margin: 0, color: t.text2 }}>Nothing had been made yet at this point.</p>
        )}
      </div>

      <StepList events={events} position={position} phone={phone} onGo={move} />
    </section>
  );
}

export default ReplayBody;
