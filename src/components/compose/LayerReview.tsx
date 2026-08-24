// The review pass: the one screen between pressing Publish and the build going
// live, where a creator decides what NeoScale is allowed to say about it.
//
// THE TWO CONTROLS ARE EQUALS. "Approve and publish" and "Publish without
// these" are the same height, the same shape, the same distance from the
// pointer, and neither asks a follow-up question. An expert who does not want
// a generated beginner layer on their post declines in ONE PRESS, every time
// they are asked, and is never made to explain why. If a later change makes
// the second control smaller, quieter, further away or conditional, it has
// broken the promise this file exists to keep.
//
// SKIPPING IS NOT A FAILURE AND NOT A DELETE. It leaves both rows exactly as
// generated with approved false: nothing of them is shown to a reader, and
// nothing has to be generated again if the creator changes their mind. The
// build publishes either way — publication never waits on this screen.
//
// EDITING IS APPROVING. Rewriting a step is taking the words as your own, so
// an edited layer is written with edited_by_creator AND approved whichever
// control is pressed. The chip on that layer says so before either is.
//
// PORTALLED TO THE BODY, like the publish confirmation and for the same
// reason: the compose top bar carries backdropFilter, which makes it the
// containing block for every fixed-position descendant. A fixed overlay
// rendered inside it would be trapped in a 52px strip.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LAYER_ATTRIBUTION,
  LAYER_BLURB,
  LAYER_TITLE,
  LAYERS,
  clearLayerReviewDeclined,
  commitLayerReview,
  generateLayers,
  recordLayerReviewDeclined,
  type BuildLayer,
  type Layer,
  type LayerDecision,
  type LayerStep,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  headingText,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "@/components/build/tokens";

/** Below this the two layers cannot sit beside each other, so they stack. */
const TWO_COLUMN_MIN = 900;

const LAYER_COLOUR: Record<Layer, string> = { run: ORANGE, understand: TEAL };

export interface LayerReviewResult {
  /** What the creator pressed. False is a real answer, not an error. */
  approved: boolean;
  /** The rows actually written, so a caller can update its cache. */
  written: BuildLayer[];
  /**
   * The rows the generator returned, written or not.
   *
   * A caller needs these even when the creator approved nothing: a forced
   * regeneration replaced the stored content whatever the creator then
   * decided, and a cache still holding the old rows would go on offering to
   * regenerate what has just been regenerated.
   */
  generated: BuildLayer[];
}

export interface LayerReviewProps {
  buildId: string;
  /**
   * publish  the two controls also publish the build. The default.
   * review   the build is already live; the controls only decide the layers.
   */
  mode?: "publish" | "review";
  /** Only ask about these. Both, when omitted. */
  only?: Layer[];
  /**
   * Regenerate even over a row the generator would protect. Set ONLY from the
   * staleness line, where the creator has just answered the question it asks.
   */
  force?: boolean;
  /** The record's hash, for remembering a decline against this exact record. */
  hash: string | null;
  onResolve: (result: LayerReviewResult) => void;
  /** Escape, and only Escape: nothing written, nothing published. */
  onCancel: () => void;
}

/** matchMedia rather than a CSS query: everything on this route is inline. */
function useTwoColumn(): boolean {
  const [twoColumn, setTwoColumn] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${TWO_COLUMN_MIN}px)`).matches
  );

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${TWO_COLUMN_MIN}px)`);
    const onChange = (event: MediaQueryListEvent) => setTwoColumn(event.matches);
    setTwoColumn(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return twoColumn;
}

const fieldBase: React.CSSProperties = {
  fontFamily: "inherit",
  width: "100%",
  borderRadius: 8,
  outline: "none",
  background: "transparent",
  border: "1px solid transparent",
  color: TEXT_PRIMARY,
  padding: "4px 6px",
  resize: "vertical",
};

/**
 * One step, editable where it stands.
 *
 * A textarea that looks like the paragraph it replaces rather than a form
 * field: the creator is reading these words as a reader will, and a box around
 * every line would turn reading into filling something in.
 */
function StepEditor({
  step,
  layer,
  colour,
  onChange,
}: {
  step: LayerStep;
  layer: Layer;
  colour: string;
  onChange: (next: LayerStep) => void;
}) {
  const [focused, setFocused] = useState<string | null>(null);

  const focusStyle = (field: string): React.CSSProperties =>
    focused === field
      ? { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)" }
      : {};

  return (
    <li style={{ ...cardGlass, padding: "10px 12px", display: "flex", gap: 10 }}>
      <span
        aria-hidden
        style={{
          ...labelText,
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: colour,
          background: hexToRgba(colour, 0.15),
          fontSize: 11,
        }}
      >
        {step.n}
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <input
          aria-label={`${LAYER_TITLE[layer]} step ${step.n} title`}
          value={step.title}
          onChange={(event) => onChange({ ...step, title: event.target.value })}
          onFocus={() => setFocused("title")}
          onBlur={() => setFocused(null)}
          spellCheck={false}
          style={{ ...fieldBase, ...titleText, ...focusStyle("title") }}
        />
        <textarea
          aria-label={`${LAYER_TITLE[layer]} step ${step.n} text`}
          value={step.body}
          onChange={(event) => onChange({ ...step, body: event.target.value })}
          onFocus={() => setFocused("body")}
          onBlur={() => setFocused(null)}
          rows={Math.min(8, Math.max(2, Math.ceil(step.body.length / 52)))}
          style={{ ...fieldBase, ...bodyText, ...focusStyle("body") }}
        />
      </div>
    </li>
  );
}

interface Panel {
  layer: Layer;
  row: BuildLayer | null;
  steps: LayerStep[];
  edited: boolean;
  /** The generator protected this row instead of rewriting it. */
  stale: boolean;
  error: string | null;
}

function LayerPanel({
  panel,
  working,
  onEdit,
}: {
  panel: Panel;
  working: boolean;
  onEdit: (layer: Layer, index: number, step: LayerStep) => void;
}) {
  const colour = LAYER_COLOUR[panel.layer];

  // Ordered by what a creator most needs to know about this panel before they
  // press anything. The stale case is third rather than last on purpose: text
  // written from a record that has since moved is the one thing here a
  // creator could approve without realising what they were approving.
  const chip = panel.edited
    ? { text: "Edited by you — kept and shown", colour: TEAL }
    : panel.error
      ? { text: "Could not be written", colour: GAP_RED }
      : panel.stale
        ? { text: "Written from an earlier version of your record", colour: ORANGE }
        : panel.row?.approved
          ? { text: "Approved", colour: TEAL }
          : working
            ? { text: "Writing…", colour: TEXT_MUTED }
            : { text: "Not shown unless you approve it", colour: TEXT_MUTED };

  return (
    <section
      data-visual-slot="layer-review-panel"
      data-layer={panel.layer}
      aria-label={LAYER_TITLE[panel.layer]}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ ...titleText, margin: 0, color: colour }}>
          {LAYER_TITLE[panel.layer]}
        </h3>
        <span style={{ ...labelText, fontSize: 11, color: chip.colour }}>{chip.text}</span>
      </div>

      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
        {LAYER_BLURB[panel.layer]}
      </p>

      {panel.error ? (
        <p style={{ ...bodyText, margin: 0, color: GAP_RED }}>{panel.error}</p>
      ) : null}

      {panel.steps.length === 0 && !panel.error ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
          {working ? "Reading your record…" : "Nothing was written for this one."}
        </p>
      ) : null}

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {panel.steps.map((step, index) => (
          <StepEditor
            key={`${panel.layer}-${index}`}
            step={step}
            layer={panel.layer}
            colour={colour}
            onChange={(next) => onEdit(panel.layer, index, next)}
          />
        ))}
      </ol>
    </section>
  );
}

const controlBase: React.CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  height: 34,
  padding: "0 18px",
  borderRadius: 100,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function LayerReview({
  buildId,
  mode = "publish",
  only,
  force,
  hash,
  onResolve,
  onCancel,
}: LayerReviewProps) {
  const wanted = useMemo(() => (only && only.length > 0 ? only : [...LAYERS]), [only]);
  const twoColumn = useTwoColumn();

  const [rows, setRows] = useState<Partial<Record<Layer, BuildLayer>>>({});
  const [steps, setSteps] = useState<Partial<Record<Layer, LayerStep[]>>>({});
  const [edited, setEdited] = useState<Partial<Record<Layer, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<Layer, string>>>({});
  const [protectedRows, setProtectedRows] = useState<Partial<Record<Layer, boolean>>>({});
  const [working, setWorking] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  /** The hash the generator itself computed. Authoritative over the prop. */
  const [writtenHash, setWrittenHash] = useState<string | null>(null);

  /**
   * One generation request, on the way in.
   *
   * A ref rather than a dependency list because this must happen exactly once
   * per opening of the review: a second call would be a second model bill for
   * a creator who has not pressed anything.
   */
  const asked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    void generateLayers({ buildId, layers: wanted, force })
      .then((result) => {
        if (!mounted.current) return;
        const nextRows: Partial<Record<Layer, BuildLayer>> = {};
        const nextSteps: Partial<Record<Layer, LayerStep[]>> = {};
        const nextErrors: Partial<Record<Layer, string>> = {};
        const nextProtected: Partial<Record<Layer, boolean>> = {};

        for (const outcome of result.layers) {
          if (outcome.row) {
            nextRows[outcome.layer] = outcome.row;
            nextSteps[outcome.layer] = outcome.row.content.steps.map((step) => ({ ...step }));
          }
          if (outcome.error) nextErrors[outcome.layer] = outcome.error;
          // The generator refused to overwrite this one: it is a creator's
          // approved or rewritten text, and the words on screen were written
          // from a record that has since changed.
          if (outcome.stale) nextProtected[outcome.layer] = true;
        }

        setRows(nextRows);
        setSteps(nextSteps);
        setErrors(nextErrors);
        setProtectedRows(nextProtected);
        setWrittenHash(result.hash);
        setWorking(false);
      })
      .catch((error: Error) => {
        if (!mounted.current) return;
        setCallError(error.message);
        setWorking(false);
      });
  }, [buildId, force, wanted]);

  const onEdit = useCallback((layer: Layer, index: number, next: LayerStep) => {
    setSteps((current) => {
      const list = current[layer];
      if (!list) return current;
      const copy = [...list];
      copy[index] = next;
      return { ...current, [layer]: copy };
    });
    setEdited((current) => (current[layer] ? current : { ...current, [layer]: true }));
  }, []);

  const panels: Panel[] = wanted.map((layer) => ({
    layer,
    row: rows[layer] ?? null,
    steps: steps[layer] ?? [],
    edited: Boolean(edited[layer]),
    stale: Boolean(protectedRows[layer]),
    error: errors[layer] ?? null,
  }));

  const anything = panels.some((panel) => panel.row);

  /**
   * Both controls come through here. The only difference between them is the
   * `approve` flag — the same rows are written, the same publication follows,
   * and neither asks anything further.
   */
  const decide = useCallback(
    async (approve: boolean) => {
      setCommitting(true);
      setWriteError(null);

      const decisions: LayerDecision[] = panels
        .filter((panel): panel is Panel & { row: BuildLayer } => Boolean(panel.row))
        .map((panel) => ({
          row: panel.row,
          steps: panel.edited ? panel.steps : null,
          approve,
        }));

      let written: BuildLayer[] = [];
      try {
        written = await commitLayerReview(decisions);
      } catch (error) {
        // A write that failed must not hold up publication. The creator is
        // told, and both controls stay live.
        if (mounted.current) {
          setWriteError((error as Error).message);
          setCommitting(false);
        }
        return;
      }

      const anyApproved = approve || panels.some((panel) => panel.edited);
      if (anyApproved) clearLayerReviewDeclined(buildId);
      else recordLayerReviewDeclined(buildId, writtenHash ?? hash);

      if (mounted.current) setCommitting(false);
      onResolve({
        approved: anyApproved,
        written,
        generated: panels
          .map((panel) => panel.row)
          .filter((row): row is BuildLayer => row !== null),
      });
    },
    [buildId, hash, onResolve, panels, writtenHash]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !committing) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [committing, onCancel]);

  const approveLabel = mode === "publish" ? "Approve and publish" : "Approve these";
  const skipLabel = mode === "publish" ? "Publish without these" : "Not now";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review what NeoScale wrote about this build"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(8,8,12,0.62)",
      }}
    >
      <div
        data-visual-slot="layer-review"
        style={{
          ...panelGlass,
          width: "min(1040px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: 14,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ ...headingText, margin: 0 }}>
            NeoScale wrote two readings of your record.
          </h2>
          <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
            Change any line, or take neither. Nothing here is shown to a reader
            unless you approve it, and your build publishes either way.
          </p>
        </div>

        <p
          data-testid="layer-attribution"
          style={{
            ...labelText,
            margin: 0,
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            background: "rgba(255,255,255,0.025)",
            color: TEXT_SECONDARY,
            fontWeight: 400,
            letterSpacing: 0,
            lineHeight: 1.5,
          }}
        >
          {`Whichever you approve carries this line, permanently: “${LAYER_ATTRIBUTION}”`}
        </p>

        {callError ? (
          <p style={{ ...bodyText, margin: 0, color: GAP_RED }}>{callError}</p>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: twoColumn ? "row" : "column",
            gap: 18,
            alignItems: "flex-start",
          }}
        >
          {panels.map((panel) => (
            <LayerPanel
              key={panel.layer}
              panel={panel}
              working={working}
              onEdit={onEdit}
            />
          ))}
        </div>

        {writeError ? (
          <p style={{ ...bodyText, margin: 0, color: GAP_RED }}>{writeError}</p>
        ) : null}

        {/* THE TWO CONTROLS. Same geometry, side by side, in reading order.
            The second is never disabled: declining cannot be blocked by a
            generation that failed, a write that failed, or a slow model. */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, marginRight: "auto" }}>
            Escape goes back without publishing.
          </span>

          <button
            type="button"
            disabled={!anything || committing}
            onClick={() => void decide(true)}
            style={{
              ...controlBase,
              color: anything ? TEXT_PRIMARY : TEXT_MUTED,
              border: `1px solid ${anything ? hexToRgba(ORANGE, 0.45) : "rgba(255,255,255,0.06)"}`,
              background: anything ? hexToRgba(ORANGE, 0.14) : "rgba(255,255,255,0.025)",
              cursor: anything && !committing ? "pointer" : "not-allowed",
              opacity: committing ? 0.7 : 1,
            }}
          >
            {approveLabel}
          </button>

          <button
            type="button"
            disabled={committing}
            onClick={() => void decide(false)}
            style={{
              ...controlBase,
              color: TEXT_PRIMARY,
              border: `1px solid ${HAIRLINE}`,
              background: "rgba(255,255,255,0.025)",
              opacity: committing ? 0.7 : 1,
            }}
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default LayerReview;
