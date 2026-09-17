// Where a waiting import goes — the destination step (EX-P10).
//
// Between Review and the tick boxes, one question: a new build, or a draft the
// creator already has. "Start a new build" is pre-selected, because it is the
// safe answer and the only one EX-P09 gave; "Add to a draft I already have"
// opens the creator's drafts, most recently worked on first, each with its
// title, when it was last touched, and what it holds.
//
// WHEN THE CHAT ALREADY NAMED A DRAFT. The connector records target_build_id
// when the creator said "put this in my X draft". If that draft still exists
// and is still a draft it is pre-selected here, with a sentence saying so; if
// it has been published or deleted since, the step falls back to a new build
// and says so in one sentence. Either way the creator can change it — the
// model that sent the conversation never has the last word on where it goes.
//
// WHAT CHOOSING A DRAFT MEANS. Everything the creator keeps on the next screen
// is ADDED to that draft's tray, after what is already there. Nothing already
// in the draft is changed, reordered or removed: the writer continues the
// draft's own numbering and skips anything it has written before
// (docs/connector/RECON.md answer 3). This component decides nothing about
// that; it only carries the choice.
//
// A WORKING SURFACE: flat cards and hairlines, no glass, the same treatment
// the waiting-imports panel and the review use. Selection is drawn with the
// `--evidence` edge the review's own Keep toggle uses for "kept".

import { useState } from "react";
import type { CSSProperties } from "react";
import type { ClaimTarget } from "@/lib/build/imports";
import { arrivedAgo } from "@/components/compose/WaitingImports";
import { bodyText } from "@/components/build/tokens";
import { workspaceCard } from "@/components/shell/WorkspaceBar";
import { Button } from "@/components/ui/button";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText, measure, sectionHead as sectionHeadText } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

/** Where the connector was told to send the import, resolved against the drafts. */
export type DestinationPreset =
  | { kind: "none" }
  | { kind: "draft"; buildId: string }
  | { kind: "published" }
  | { kind: "missing" };

/** The creator's answer, as the review stage carries it. */
export type ImportDestinationChoice =
  | { kind: "new" }
  | { kind: "existing"; buildId: string; title: string };

interface ImportDestinationProps {
  /** "From Claude Code, 84 steps" — which conversation this is. */
  sourceLine: string;
  /** The tool that sent it, for the sentence saying where a target came from. */
  sentBy: string | null;
  targets: ClaimTarget[];
  preset: DestinationPreset;
  /** The drafts could not be read. A new build is still offered. */
  targetsError: string | null;
  onContinue: (choice: ImportDestinationChoice) => void;
  /** Leave the import waiting and go back to the offer. */
  onBack: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;
}

/** "last touched 3 hours ago · 4 parts · 12 steps". Counts only when counted. */
function targetLine(target: ClaimTarget): string {
  const parts = [`last touched ${arrivedAgo(target.updated_at)}`];
  if (target.part_count !== null) parts.push(plural(target.part_count, "part", "parts"));
  if (target.step_count !== null) parts.push(plural(target.step_count, "step", "steps"));
  return parts.join(" · ");
}

/** One sentence on where the chat asked for this to go, or null when it did not say. */
function presetSentence(
  preset: DestinationPreset,
  sentBy: string | null,
  targets: ClaimTarget[],
): string | null {
  const tool = sentBy ?? "Your AI tool";
  switch (preset.kind) {
    case "none":
      return null;
    case "draft": {
      const title = targets.find((target) => target.id === preset.buildId)?.title ?? "that draft";
      return `${tool} sent this to your draft “${title}”.`;
    }
    case "published":
      return `${tool} sent this to a draft that has since been published, so it will start a new build instead.`;
    case "missing":
      return `${tool} sent this to a draft that no longer exists, so it will start a new build instead.`;
  }
}

/** Tertiary: a ghost, the way the review's "Throw this away" is drawn. */
const tertiaryControl: CSSProperties = {
  ...bodyText,
  fontFamily: "inherit",
  fontSize: 12,
  background: "transparent",
  borderWidth: 0,
  borderStyle: "none",
  padding: 0,
  color: t.text2,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  whiteSpace: "nowrap",
};

function OptionRow({
  id,
  checked,
  disabled,
  onChoose,
  title,
  detail,
  testId,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChoose: () => void;
  title: string;
  detail: string;
  testId: string;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        ...workspaceCard,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "11px 13px",
        borderColor: checked ? t.evidence : t.line,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: feedback("border-color", "opacity"),
      }}
    >
      <input
        id={id}
        data-testid={testId}
        type="radio"
        name="import-destination"
        checked={checked}
        disabled={disabled}
        onChange={onChoose}
        style={{ margin: "3px 0 0", flexShrink: 0, accentColor: t.action, cursor: "inherit" }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ ...bodyText, color: t.text }}>{title}</span>
        <span style={{ ...bodyText, fontSize: 12, color: t.text2 }}>{detail}</span>
      </span>
    </label>
  );
}

export function ImportDestination({
  sourceLine,
  sentBy,
  targets,
  preset,
  targetsError,
  onContinue,
  onBack,
}: ImportDestinationProps) {
  const hasTargets = targets.length > 0;
  const [mode, setMode] = useState<"new" | "existing">(
    preset.kind === "draft" ? "existing" : "new",
  );
  const [chosenId, setChosenId] = useState<string | null>(
    preset.kind === "draft" ? preset.buildId : (targets[0]?.id ?? null),
  );

  const chosen = targets.find((target) => target.id === chosenId) ?? null;
  const canContinue = mode === "new" || chosen !== null;
  const sentence = presetSentence(preset, sentBy, targets);

  const existingDetail = targetsError
    ? "Your drafts could not be read just now."
    : hasTargets
      ? "What you keep joins that draft's tray, after what is already there. Nothing already in it changes."
      : "You have no unpublished drafts, so this will start a new build.";

  return (
    <div
      data-testid="import-destination"
      data-visual-slot="intake-destination"
      style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ ...sectionHeadText, color: t.text, margin: 0 }}>Where should it go?</h1>
        {/* Provenance is data, so the line is mono, as it is on the review. */}
        <p data-testid="import-destination-source" style={{ ...dataText, margin: 0, color: t.text2 }}>
          {sourceLine}
        </p>
        <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
          A new build, or a draft you already have. Nothing is saved until you
          have chosen what to keep on the next screen.
        </p>
        {sentence ? (
          <p
            data-testid="import-destination-note"
            style={{ ...bodyText, ...measure, margin: 0, color: t.text }}
          >
            {sentence}
          </p>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-label="Destination"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <OptionRow
          id="import-destination-new"
          testId="import-destination-new"
          checked={mode === "new"}
          onChoose={() => setMode("new")}
          title="Start a new build"
          detail="An empty draft, with what you keep in its tray."
        />
        <OptionRow
          id="import-destination-existing"
          testId="import-destination-existing"
          checked={mode === "existing"}
          disabled={!hasTargets}
          onChoose={() => setMode("existing")}
          title="Add to a draft I already have"
          detail={existingDetail}
        />
      </div>

      {targetsError ? (
        <p
          role="alert"
          data-testid="import-destination-error"
          style={{
            ...bodyText,
            margin: 0,
            padding: "10px 12px",
            backgroundColor: t.recess,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            borderRadius: r.panel,
            borderLeftWidth: 2,
            borderLeftStyle: "solid",
            borderLeftColor: t.catBreakage,
            color: t.text,
          }}
        >
          {targetsError}
        </p>
      ) : null}

      {mode === "existing" && hasTargets ? (
        <ul
          role="radiogroup"
          aria-label="Your drafts"
          data-testid="import-destination-drafts"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {targets.map((target) => {
            const selected = target.id === chosenId;
            return (
              <li key={target.id} style={{ listStyle: "none" }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid="import-destination-draft"
                  data-build-id={target.id}
                  onClick={() => setChosenId(target.id)}
                  style={{
                    ...workspaceCard,
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "9px 11px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    borderColor: selected ? t.evidence : t.line,
                    transition: feedback("border-color"),
                  }}
                >
                  <span style={{ ...bodyText, color: t.text, wordBreak: "break-word" }}>
                    {target.title}
                  </span>
                  <span style={{ ...dataText, color: t.text2 }}>{targetLine(target)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: t.line,
        }}
      >
        {/* The step's one primary action, on the kit's primary Button as the
            review's confirm is. */}
        <Button
          type="button"
          data-testid="import-destination-continue"
          onClick={() => {
            if (mode === "existing" && chosen) {
              onContinue({ kind: "existing", buildId: chosen.id, title: chosen.title });
            } else if (mode === "new") {
              onContinue({ kind: "new" });
            }
          }}
          disabled={!canContinue}
          style={{ marginTop: 14 }}
        >
          Continue
        </Button>

        <button
          type="button"
          data-testid="import-destination-back"
          onClick={onBack}
          style={{ ...tertiaryControl, marginTop: 14, cursor: "pointer" }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
