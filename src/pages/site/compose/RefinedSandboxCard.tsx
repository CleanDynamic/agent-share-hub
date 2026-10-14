/* UI-P94 — the Card in the refined look, as `design/reference/refined/{dusk,noon}/composer-card.html` draws it.

   A FORK, NOT AN EDIT. `SandboxCard` stays the current look; this takes its props (imported, not copied), the same
   fields in the same order, the same ids focus lands on, the same handlers and the same accessible names.
   `RefinedSandboxView` renders it.

   THE SHEET: the window recipe with `--sheet-shadow`, 472 wide, inset 6 from the top, right and bottom, radius 12, over
   `--scrim`, no blur. A header 56 high under `--hairline-module`: "Card" 15/500 and a boxed 30 close. The body, padding
   24 and gap 24: Cover (its title 13.5/500, the subtitle 12 `--text2`, a 216-high drop zone in the tile's fill with the
   dot grid and a 1px dashed `--line`, radius 8, the `image` glyph 20, the drop line 13/500 and the underlined browse
   link); the fields, labels 12.5/500 over wells 36 high (the summary 80, its counter 11.5 `--label` tnum, the hint 12
   `--label`); Made with as `ModelTag`s; More details (optional) as a disclosure led by the `chev` glyph. A phone takes
   the full width, and its fields are 44 high at 16. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef, useState, type CSSProperties, type DragEvent, type FocusEvent, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { ModelTag } from "@/components/brand/ModelTag";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { DESCRIPTION_MAX, type MadeWithChip } from "./composeModel";
import type { ComposeDetailKey } from "./MoreDetails";
import { AddEntry, Toggle } from "./MadeWithLine";
import { Switch } from "./MoreDetails";
import { CARD_FIELD_ID, type SandboxCardProps } from "./SandboxCard";
import { text, tnum } from "./refinedStyles";

/* ── fields ── */

const labelStyle: CSSProperties = text(12.5, 500, t.text);

/** A field in the well recipe, its focused edge `--selected-edge`. */
function useWell<T extends HTMLElement>(phone: boolean, height?: number) {
  const [focused, setFocused] = useState(false);
  const { state, handlers: base } = useInteractive<T>();
  const handlers = {
    ...base,
    onFocus: (event: FocusEvent<T>) => {
      setFocused(true);
      base.onFocus?.(event);
    },
    onBlur: (event: FocusEvent<T>) => {
      setFocused(false);
      base.onBlur?.(event);
    },
  };
  const style: CSSProperties = {
    ...WELL,
    ...(focused ? { borderColor: t.selectedEdge } : null),
    borderRadius: 6,
    boxSizing: "border-box",
    width: "100%",
    outline: "none",
    ...(height ? { height: phone ? 44 : height } : null),
    ...text(phone ? 16 : 13.5, 400, t.text),
    ...ring(state.focusVisible),
  };
  return { handlers, style };
}

/** A label over its field, gap 8; the hint 12 `--label` beside the label, or anything on the right. */
function Field({ id, label, hint, right, children }: { id: string; label: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    /* The size is set here because `index.css` makes a desktop field inherit its parent's (a phone's stays 16). */
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, fontSize: 13.5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label htmlFor={id} style={{ ...labelStyle, flexGrow: right ? 1 : undefined }}>
          {label}
        </label>
        {hint ? <span style={text(12, 400, t.label)}>{hint}</span> : null}
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── the cover ── */

function Cover(props: SandboxCardProps) {
  const { phone, cover, adding, mediaError, accept, onFiles, onRemoveCover } = props;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const zone = useInteractive<HTMLDivElement>();
  const pick = () => input.current?.click();
  const busy = adding !== null;
  const pct = Math.round((adding ?? 0) * 100);

  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setOver(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setOver(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0 && !busy) onFiles(files);
    },
  };

  const frame: CSSProperties = {
    height: 216,
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px dashed ${over ? t.selectedEdge : t.line}`,
    background: `radial-gradient(${t.dotGrid} 1px, transparent 1px) 0 0 / 16px 16px, ${t.tile}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    textAlign: "center",
  };

  const adding_ = (
    <div role="status" style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: 360 }}>
      <div style={{ height: 4, borderRadius: 2, background: t.barBase, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: t.evidence }} />
      </div>
      <span style={{ ...text(12, 400, t.text2), ...tnum }}>Adding… {pct}%</span>
    </div>
  );

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
        hidden
        data-testid="compose-file"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      {cover ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden", ...WELL }}>
            {cover.url === null ? null : cover.kind === "video" ? (
              <video src={cover.url} controls muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <img src={cover.url} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
          {busy ? (
            adding_
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ ...text(12, 400, t.label), flexGrow: 1 }}>Cover</span>
              <TextButton onClick={pick} style={text(12.5, 500, t.text2)}>
                Replace
              </TextButton>
              <TextButton onClick={onRemoveCover} style={text(12.5, 500, t.text2)}>
                Remove
              </TextButton>
            </div>
          )}
        </div>
      ) : busy ? (
        <div style={frame}>{adding_}</div>
      ) : (
        <div
          data-testid="compose-dropzone"
          data-over={over ? "true" : undefined}
          {...dropHandlers}
          {...(phone
            ? {
                ...zone.handlers,
                role: "button",
                tabIndex: 0,
                "aria-label": "Add a screenshot or a short video",
                onClick: pick,
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    pick();
                  }
                },
              }
            : null)}
          style={{ ...frame, cursor: phone ? "pointer" : "default", ...(phone ? ring(zone.state.focusVisible) : null) }}
        >
          <Glyph name="image" size={20} color={t.text2} />
          <span style={text(13, 500, t.text)}>{phone ? "Add a screenshot or a short video" : "Drop a screenshot or a short video"}</span>
          <TextButton
            underline
            onClick={(event) => {
              event.stopPropagation();
              pick();
            }}
            style={{ ...text(12, 400, t.text2), textUnderlineOffset: 3, textDecorationColor: t.line }}
          >
            or browse your files
          </TextButton>
        </div>
      )}
      {mediaError ? (
        <p role="alert" style={{ ...text(12.5, 400, t.catBreakage), margin: 0 }}>
          {mediaError}
        </p>
      ) : null}
    </>
  );
}

/* ── made with ── */

function MadeTag({ chip }: { chip: MadeWithChip }) {
  const out = chip.kind === "model" && !chip.on;
  if (out) {
    /* A model left out stays on the line, struck through, so Change can bring it back. */
    return (
      <span data-testid="made-with-chip" data-on="false" style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 4, background: t.tagFill, ...text(11.5, 500, t.onTag), whiteSpace: "nowrap" }}>
        {chip.tool ? `${chip.tool} · ` : null}
        <s style={{ color: t.text2 }}>{chip.model}</s>
        <span style={VISUALLY_HIDDEN}> (left out)</span>
      </span>
    );
  }
  return (
    <span data-testid="made-with-chip" data-on={chip.on ? "true" : "false"} style={{ display: "inline-flex" }}>
      <ModelTag tool={chip.tool} model={chip.model}>
        {chip.label}
      </ModelTag>
    </span>
  );
}

/** Made with, as `MadeWithLine` writes it: the session tags, "from your sessions.", what was typed, then Change. */
function MadeWith({ phone, chips, onToggle, onAdd }: { phone: boolean; chips: SandboxCardProps["madeWith"]; onToggle: SandboxCardProps["onToggleMadeWith"]; onAdd: SandboxCardProps["onAddMadeWith"] }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<readonly MadeWithChip[]>([]);
  const fromSessions = chips.filter((chip) => chip.kind !== "entry");
  const typed = chips.filter((chip) => chip.kind === "entry");
  const hasSessions = fromSessions.length > 0;
  const changeable = chips.some((chip) => chip.kind !== "tool");
  const toggles: MadeWithChip[] = (() => {
    const now = chips.filter((chip) => chip.kind !== "tool");
    const gone = opened.filter((chip) => chip.kind === "entry" && !now.some((current) => current.key === chip.key)).map((chip) => ({ ...chip, on: false }));
    return [...now, ...gone];
  })();
  const flip = () => {
    if (!open) setOpened(chips);
    setOpen((value) => !value);
  };
  return (
    <div data-testid="compose-made-with" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, ...text(12.5, 400, t.text2) }}>
        <span>Made with</span>
        {fromSessions.map((chip) => (
          <MadeTag key={chip.key} chip={chip} />
        ))}
        {hasSessions ? <span>from your sessions.</span> : null}
        {typed.map((chip) => (
          <MadeTag key={chip.key} chip={chip} />
        ))}
        {hasSessions ? null : <AddEntry phone={phone} onAdd={onAdd} />}
        {changeable || open ? (
          <TextButton
            underline
            target={phone}
            aria-expanded={open}
            onClick={flip}
            style={{ ...text(12.5, 400, t.text), textUnderlineOffset: 3, textDecorationColor: t.line }}
          >
            {open ? "Done" : "Change"}
          </TextButton>
        ) : null}
      </div>
      {open ? (
        <div role="group" aria-label="What it was made with" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {toggles.map((chip) => (
            <Toggle key={chip.key} chip={chip} phone={phone} onToggle={onToggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── more details ── */

function WellText({ id, value, placeholder, phone, onChange }: { id: string; value: string; placeholder: string; phone: boolean; onChange: (value: string) => void }) {
  const well = useWell<HTMLTextAreaElement>(phone);
  return (
    <textarea
      id={id}
      rows={2}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      {...well.handlers}
      style={{ ...well.style, display: "block", padding: "8px 12px", lineHeight: "21px", resize: "vertical" }}
    />
  );
}

function WellNumber({ id, label, value, whole, phone, onChange }: { id: string; label: string; value: string; whole?: boolean; phone: boolean; onChange: (value: string) => void }) {
  const well = useWell<HTMLInputElement>(phone, 36);
  return (
    <div style={{ flex: "1 1 120px", minWidth: 0 }}>
      <Field id={id} label={label}>
        <input
          id={id}
          type="number"
          inputMode={whole ? "numeric" : "decimal"}
          min={0}
          step={whole ? 1 : "any"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...well.handlers}
          style={{ ...well.style, padding: "0 12px", ...tnum }}
        />
      </Field>
    </div>
  );
}

function Details({ phone, details, onDetail, onGapSwitch }: Pick<SandboxCardProps, "phone" | "details" | "onDetail" | "onGapSwitch">) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useInteractive<HTMLButtonElement>();
  const gap = useWell<HTMLInputElement>(phone, 36);
  const set = (key: ComposeDetailKey) => (value: string) => onDetail(key, value);
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setOpen((value) => !value)}
        {...toggle.handlers}
        style={{
          alignSelf: "flex-start",
          height: phone ? 44 : 32,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px 0 0",
          border: 0,
          borderRadius: 6,
          background: "transparent",
          cursor: "pointer",
          ...text(13, 500, t.text),
          ...ring(toggle.state.focusVisible),
        }}
      >
        <Glyph name={open ? "chevd" : "chev"} color={t.label} />
        More details
        <span style={{ color: t.text2, fontWeight: 400, whiteSpace: "pre" }}> (optional)</span>
      </button>
      {open ? (
        <div id={`${id}-panel`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <legend style={{ ...text(13.5, 500, t.text), padding: 0, marginBottom: 12 }}>Where it broke</legend>
            <Field id={`${id}-broke`} label="What broke">
              <WellText id={`${id}-broke`} value={details.symptom} placeholder="exiftool: command not found" phone={phone} onChange={set("symptom")} />
            </Field>
            <Field id={`${id}-fixed`} label="How you fixed it">
              <WellText id={`${id}-fixed`} value={details.resolution} placeholder="Install it first with brew install exiftool." phone={phone} onChange={set("resolution")} />
            </Field>
          </fieldset>
          <div style={row}>
            <WellNumber id={`${id}-monthly`} label="Monthly cost (£)" value={details.costMonthly} phone={phone} onChange={set("costMonthly")} />
            <WellNumber id={`${id}-setup`} label="Setup cost (£)" value={details.costSetup} phone={phone} onChange={set("costSetup")} />
            <WellNumber id={`${id}-first`} label="First result in (minutes)" value={details.firstResult} whole phone={phone} onChange={set("firstResult")} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Switch on={details.gapOn} label="Leave one part open for someone else to solve" phone={phone} onChange={onGapSwitch} />
            {details.gapOn ? (
              <>
                <Field id={`${id}-open`} label="What's left open?">
                  <input
                    id={`${id}-open`}
                    type="text"
                    value={details.gapProblem}
                    autoComplete="off"
                    onChange={(event) => onDetail("gapProblem", event.target.value)}
                    {...gap.handlers}
                    style={{ ...gap.style, padding: "0 12px" }}
                  />
                </Field>
                <p style={{ ...text(12, 400, t.label), margin: 0 }}>Readers will see it as one part left open. You can add a reward on Bounties after publishing.</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── the sheet ── */

export function RefinedSandboxCard(props: SandboxCardProps) {
  const { open, onOpenChange, field, phone } = props;
  const title = useWell<HTMLInputElement>(phone, 36);
  const summary = useWell<HTMLTextAreaElement>(phone);
  const audience = useWell<HTMLInputElement>(phone, 36);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, zIndex: 50, background: t.scrim }} />
        <Dialog.Content
          data-testid="sandbox-card"
          data-look="refined"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            if (!field) return;
            const target = document.getElementById(CARD_FIELD_ID[field]);
            if (!target) return;
            event.preventDefault();
            target.focus();
          }}
          style={{
            position: "fixed",
            top: 6,
            right: 6,
            bottom: 6,
            zIndex: 51,
            width: phone ? "calc(100% - 12px)" : "min(472px, calc(100% - 12px))",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            borderRadius: 12,
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.sheetShadow,
            color: t.text,
            outline: "none",
            overflow: "hidden",
          }}
        >
          <div style={{ height: 56, flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "0 16px 0 24px", borderBottom: `1px solid ${t.hairlineModule}` }}>
            <Dialog.Title style={{ ...text(15, 500, t.text), margin: 0, flexGrow: 1 }}>Card</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label="Close" size={30} />
            </Dialog.Close>
          </div>

          <div style={{ flexGrow: 1, minHeight: 0, overflowY: "auto", padding: phone ? 16 : 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <section id={CARD_FIELD_ID.cover} tabIndex={-1} aria-label="Cover" style={{ outline: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h3 style={{ ...text(13.5, 500, t.text), margin: 0 }}>Cover</h3>
                <p style={{ ...text(12, 400, t.text2), margin: 0 }}>What people see first in the Gallery.</p>
              </div>
              <Cover {...props} />
              {props.onUseResultPicture ? (
                <TextButton underline onClick={props.onUseResultPicture} style={{ ...text(12.5, 400, t.text2), alignSelf: "flex-start", textUnderlineOffset: 3, textDecorationColor: t.line }}>
                  Use a result's picture
                </TextButton>
              ) : null}
            </section>

            <Field id={CARD_FIELD_ID.title} label="Title">
              <input
                id={CARD_FIELD_ID.title}
                type="text"
                value={props.title}
                placeholder="Name your build"
                autoComplete="off"
                onChange={(event) => props.onTitle(event.target.value)}
                {...title.handlers}
                style={{ ...title.style, padding: "0 12px", fontWeight: 500 }}
              />
            </Field>

            <Field
              id={CARD_FIELD_ID.summary}
              label="One-line summary"
              right={
                <span style={{ ...text(11.5, 400, t.label), ...tnum }}>
                  {props.description.length} / {DESCRIPTION_MAX}
                </span>
              }
            >
              <textarea
                id={CARD_FIELD_ID.summary}
                rows={3}
                value={props.description}
                maxLength={DESCRIPTION_MAX}
                placeholder="What does it do, and who is it for? One or two sentences."
                onChange={(event) => props.onDescription(event.target.value)}
                {...summary.handlers}
                style={{ ...summary.style, display: "block", height: 80, padding: "8px 12px", lineHeight: "21px", resize: "none" }}
              />
            </Field>

            <Field id={CARD_FIELD_ID.audience} label="Who it's for" hint="Separate with commas">
              <input
                id={CARD_FIELD_ID.audience}
                type="text"
                list="card-audience-options"
                value={props.audience}
                autoComplete="off"
                onChange={(event) => props.onAudience(event.target.value)}
                {...audience.handlers}
                style={{ ...audience.style, padding: "0 12px" }}
              />
              <datalist id="card-audience-options">
                {props.audienceOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </Field>

            <MadeWith phone={phone} chips={props.madeWith} onToggle={props.onToggleMadeWith} onAdd={props.onAddMadeWith} />

            <Details phone={phone} details={props.details} onDetail={props.onDetail} onGapSwitch={props.onGapSwitch} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RefinedSandboxCard;
