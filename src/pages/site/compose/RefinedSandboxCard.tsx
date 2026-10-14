/* UI-P94 — the Card in the refined look, as `design/reference/refined/{dusk,noon}/composer-card.html` draws it.

   A FORK, NOT AN EDIT. `SandboxCard` stays the current look; this takes its props (imported, not copied), keeps the
   same Radix Dialog (focus trapped, Esc closes, the page behind inert), the same fields and their ids, the same order
   and the same accessible names. `RefinedSandboxView` renders it.

   THE SHEET: the window recipe with `--sheet-shadow`, 472 wide, inset 6 from the top, right and bottom, radius 12,
   over `--scrim`; a phone keeps today's full-height sheet. The header is 56 high under `--hairline-module`: "Card"
   15/500 and the boxed 30 close. The body, padding 24 and gap 24: Cover (title 13.5/500, subtitle 12 `--text2`, the
   drop zone 216 high in the tile's fill with the dot grid, 1px dashed `--line`, radius 8, the `image` glyph 20
   `--text2`, the drop line 13/500 and the underlined browse link 12 `--text2`); the fields, labels 12.5/500 over the
   well recipe 36 high (the summary 80, its counter 11.5 `--label` tabular, the hint 12 `--label`); Made with, as
   `ModelTag`s; More details (optional) as a disclosure. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { useRing } from "./composeFields";
import { DESCRIPTION_MAX } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";
import { MoreDetails } from "./MoreDetails";
import { CARD_FIELD_ID, type SandboxCardProps } from "./SandboxCard";
import { text, tnum, wellField } from "./refinedStyles";

const underlined: CSSProperties = { ...text(12, 400, t.text2), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line };

/** A field: the label 12.5/500 (and its hint, or what sits on its right) over the control, 8 apart. */
function RefinedField({ id, label, hint, right, children }: { id: string; label: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label htmlFor={id} style={text(12.5, 500, t.text)}>
          {label}
        </label>
        {hint ? <span style={text(12, 400, t.label)}>{hint}</span> : null}
        {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Adding({ pct }: { pct: number }) {
  return (
    <div role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: t.hairlineModule, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: t.text2 }} />
      </div>
      <span style={{ ...text(12, 400, t.text2), ...tnum }}>Adding… {pct}%</span>
    </div>
  );
}

type CoverProps = Pick<SandboxCardProps, "cover" | "adding" | "mediaError" | "accept" | "onFiles" | "onRemoveCover" | "onUseResultPicture" | "phone">;

/** The Cover: the same file input, drop, replace and remove as `MediaPanel`, in the refined look. */
function Cover({ cover, adding, mediaError, accept, onFiles, onRemoveCover, onUseResultPicture, phone }: CoverProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => input.current?.click();
  const busy = adding !== null;
  const pct = Math.round((adding ?? 0) * 100);
  const zoneRing = useRing<HTMLDivElement>();

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

  const zone: CSSProperties = {
    height: 216,
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px dashed ${over ? t.selectedEdge : t.line}`,
    backgroundColor: over ? t.controlOn : t.tile,
    backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
    backgroundSize: "16px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    textAlign: "center",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>Cover</h2>
        <p style={{ ...text(12, 400, t.text2), margin: 0 }}>What people see first in the Gallery.</p>
      </div>
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
          <div style={{ aspectRatio: "16 / 9", borderRadius: 6, overflow: "hidden", background: t.well, border: `1px solid ${t.wellBorder}`, boxSizing: "border-box" }}>
            {cover.url === null ? null : cover.kind === "video" ? (
              <video src={cover.url} controls muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <img src={cover.url} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
          {busy ? (
            <Adding pct={pct} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flexGrow: 1, ...text(12, 400, t.label) }}>Cover</span>
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
        <div style={{ ...zone, borderColor: t.line }}>
          <div style={{ width: "100%", maxWidth: 320 }}>
            <Adding pct={pct} />
          </div>
        </div>
      ) : (
        <div
          data-testid="compose-dropzone"
          data-over={over ? "true" : undefined}
          {...dropHandlers}
          {...(phone
            ? {
                ...zoneRing.handlers,
                role: "button",
                tabIndex: 0,
                "aria-label": "Add a screenshot or a short video",
                onClick: pick,
                onKeyDown: (event: KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    pick();
                  }
                },
              }
            : null)}
          style={{ ...zone, cursor: phone ? "pointer" : "default", ...(phone ? zoneRing.style : null) }}
        >
          <Glyph name="image" size={20} color={t.text2} />
          <span style={text(13, 500, t.text)}>{phone ? "Add a screenshot or a short video" : "Drop a screenshot or a short video"}</span>
          <TextButton
            underline
            onClick={(event) => {
              event.stopPropagation();
              pick();
            }}
            style={underlined}
          >
            or browse your files
          </TextButton>
        </div>
      )}
      {mediaError ? (
        <p role="alert" style={{ ...text(12.5, 400, t.breakage), margin: 0 }}>
          {mediaError}
        </p>
      ) : null}
      {onUseResultPicture ? (
        <div>
          <TextButton underline onClick={onUseResultPicture} style={underlined}>
            Use a result's picture
          </TextButton>
        </div>
      ) : null}
    </div>
  );
}

export function RefinedSandboxCard(props: SandboxCardProps) {
  const { open, onOpenChange, field, phone } = props;
  const titleRing = useRing<HTMLInputElement>();
  const summaryRing = useRing<HTMLTextAreaElement>();
  const audienceRing = useRing<HTMLInputElement>();
  /* A phone's fields are 44 high at 16, so the page does not zoom on focus. */
  const fieldText = phone ? 16 : 13.5;

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
            zIndex: 51,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.sheetShadow,
            color: t.text,
            outline: "none",
            ...(phone ? { top: 0, right: 0, bottom: 0, width: "100%", borderRadius: 0 } : { top: 6, right: 6, bottom: 6, width: 472, maxWidth: "calc(100vw - 12px)", borderRadius: 12 }),
          }}
        >
          <div style={{ height: 56, flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "0 16px 0 24px", borderBottom: `1px solid ${t.hairlineModule}` }}>
            <Dialog.Title style={{ ...text(15, 500, t.text), margin: 0, flexGrow: 1 }}>Card</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label="Close" size={30} />
            </Dialog.Close>
          </div>

          <div style={{ flexGrow: 1, overflowY: "auto", padding: phone ? 16 : 24, display: "flex", flexDirection: "column", gap: 24 }}>
            <section id={CARD_FIELD_ID.cover} tabIndex={-1} aria-label="Cover" style={{ outline: "none" }}>
              <Cover
                phone={phone}
                cover={props.cover}
                adding={props.adding}
                mediaError={props.mediaError}
                accept={props.accept}
                onFiles={props.onFiles}
                onRemoveCover={props.onRemoveCover}
                onUseResultPicture={props.onUseResultPicture}
              />
            </section>

            <RefinedField id={CARD_FIELD_ID.title} label="Title">
              <input
                id={CARD_FIELD_ID.title}
                type="text"
                value={props.title}
                placeholder="Name your build"
                autoComplete="off"
                onChange={(event) => props.onTitle(event.target.value)}
                {...titleRing.handlers}
                style={{ ...wellField, height: phone ? 44 : 36, padding: "0 12px", ...text(fieldText, 500, t.text), ...titleRing.style }}
              />
            </RefinedField>

            <RefinedField
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
                {...summaryRing.handlers}
                style={{ ...wellField, display: "block", height: 80, padding: "8px 12px", ...text(fieldText, 400, t.text), lineHeight: "21px", resize: "vertical", ...summaryRing.style }}
              />
            </RefinedField>

            <RefinedField id={CARD_FIELD_ID.audience} label="Who it's for" hint="Separate with commas">
              <input
                id={CARD_FIELD_ID.audience}
                type="text"
                list="card-audience-options"
                value={props.audience}
                autoComplete="off"
                onChange={(event) => props.onAudience(event.target.value)}
                {...audienceRing.handlers}
                style={{ ...wellField, height: phone ? 44 : 36, padding: "0 12px", ...text(fieldText, 400, t.text), ...audienceRing.style }}
              />
              <datalist id="card-audience-options">
                {props.audienceOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </RefinedField>

            <MadeWithLine
              phone={phone}
              chips={props.madeWith}
              hasSessions={props.madeWith.some((chip) => chip.kind !== "entry")}
              onToggle={props.onToggleMadeWith}
              onAdd={props.onAddMadeWith}
            />

            <MoreDetails phone={phone} details={props.details} onDetail={props.onDetail} onGapSwitch={props.onGapSwitch} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RefinedSandboxCard;
