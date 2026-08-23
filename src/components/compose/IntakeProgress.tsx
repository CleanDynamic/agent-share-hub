// The parsing state, for a call that can take several seconds.
//
// An indeterminate sweep rather than a percentage: the function returns once,
// with everything, so there is no progress to report and a bar that crept to
// 90% and waited would be a lie. What it does instead is stay obviously alive,
// name the file or paste it is working on, and — once the wait stops feeling
// instant — say why it is still going.

import { useEffect, useState } from "react";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
  titleText,
} from "@/components/build/tokens";

/** Long enough that a fast parse never shows it, short enough to reassure. */
const PATIENCE_MS = 3500;

interface IntakeProgressProps {
  /** What is being read — a filename, or a description of the paste. */
  sourceLabel: string;
  /** Characters handed to the parser. Shown so a slow parse has a reason. */
  characterCount?: number;
}

export function IntakeProgress({ sourceLabel, characterCount }: IntakeProgressProps) {
  const [patient, setPatient] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setPatient(true), PATIENCE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const size =
    characterCount && characterCount > 0
      ? `${characterCount.toLocaleString("en-GB")} characters`
      : null;

  return (
    <div
      data-visual-slot="intake-progress"
      role="status"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...labelText, textTransform: "uppercase", color: TEAL }}>Reading</span>
        <h1 style={{ ...titleText, fontSize: 20, margin: 0, color: TEXT_PRIMARY }}>
          {sourceLabel}
        </h1>
      </div>

      {/* The track clips the sweep, so the bar reads as motion along a fixed
          rail rather than a block flying across the panel. */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          height: 2,
          width: "100%",
          overflow: "hidden",
          borderRadius: 2,
          background: HAIRLINE,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "25%",
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
            animation: "intakeSweep 1200ms ease-in-out infinite",
          }}
        />
      </div>

      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
        Splitting it into turns and pulling out the prompts, code and settings.
        Nothing is saved until you have looked at what it found.
      </p>

      {size ? <span style={{ ...labelText, color: TEXT_MUTED }}>{size}</span> : null}

      {patient ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            background: hexToRgba(TEAL, 0.05),
            color: TEXT_SECONDARY,
          }}
        >
          Still reading. A long transcript takes a few seconds — your draft
          already exists, so nothing is lost if this fails.
        </p>
      ) : null}
    </div>
  );
}
