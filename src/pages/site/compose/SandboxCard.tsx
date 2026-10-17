/* UI-P94 — the Card in the refined look, as `design/reference/refined/{dusk,noon}/composer-card.html` draws it.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `SandboxCard` stays the current look; this takes its props (imported, not copied), keeps the
   same Radix Dialog (focus trapped, Esc closes, the page behind inert), the same fields and their ids, the same order
   and the same accessible names. `SandboxView` renders it.

   THE SHEET: the window recipe with `--sheet-shadow`, 472 wide, inset 6 from the top, right and bottom, radius 12,
   over `--scrim`; a phone keeps today's full-height sheet. The header is 56 high under `--hairline-module`: "Card"
   15/500 and the boxed 30 close. The body, padding 24 and gap 24: Cover (title 13.5/500, subtitle 12 `--text2`, the
   drop zone 216 high in the tile's fill with the dot grid, 1px dashed `--line`, radius 8, the `image` glyph 20
   `--text2`, the drop line 13/500 and the underlined browse link 12 `--text2`); the fields, labels 12.5/500 over the
   well recipe 36 high (the summary 80, its counter 11.5 `--label` tabular, the hint 12 `--label`); Made with, as
   `ModelTag`s; More details (optional) as a disclosure.

   PT-05: THE COVER IS ONE LINE. It is the first picture in the post, so the sheet says that and offers "Edit the post",
   which closes it and opens the Post tab. The drop zone, Replace and Remove moved with the pictures (PT-06). */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { useRing } from "./composeFields";
import { DESCRIPTION_MAX } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";
import { MoreDetails } from "./MoreDetails";
import { text, tnum, wellField } from "./refinedStyles";
import { type ComposeViewProps } from "./ComposeView";

/** Where the Card opens: the field a missing item names. */
export type CardField = "cover" | "title" | "summary" | "audience";

/** The element ids focus lands on, one per field. */
export const CARD_FIELD_ID: Record<CardField, string> = {
  cover: "card-cover",
  title: "card-title",
  summary: "card-summary",
  audience: "card-audience",
};

export type CardProps = Pick<
  ComposeViewProps,
  | "title"
  | "onTitle"
  | "description"
  | "onDescription"
  | "audience"
  | "onAudience"
  | "audienceOptions"
  | "cover"
  | "adding"
  | "mediaError"
  | "accept"
  | "onFiles"
  | "onRemoveCover"
  | "madeWith"
  | "onToggleMadeWith"
  | "onAddMadeWith"
  | "projectLinks"
  | "onSetProjectLink"
  | "details"
  | "onDetail"
  | "onGapSwitch"
>;

export interface SandboxCardProps extends CardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The field to land on, or null to leave focus where the sheet puts it. */
  field: CardField | null;
  /** A result's picture can be the cover: present only when a result has one. */
  onUseResultPicture?: () => void;
  phone: boolean;
  /** PT-05: closes the sheet and opens the Post tab. The Cover line offers it when given. */
  onEditPost?: () => void;
}

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

export const COVER_LINE = "The cover is the first picture in your post.";

/** PT-05: the Cover is the first picture of the post, so the Card only says so and points at the Post tab. */
function Cover({ onEditPost }: { onEditPost?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>Cover</h2>
      <p style={{ ...text(12, 400, t.text2), margin: 0 }}>{COVER_LINE}</p>
      {onEditPost ? (
        <div>
          <TextButton underline onClick={onEditPost} style={underlined}>
            Edit the post
          </TextButton>
        </div>
      ) : null}
    </div>
  );
}

export function SandboxCard(props: SandboxCardProps) {
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
              <Cover onEditPost={props.onEditPost} />
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
              projectLinks={props.projectLinks}
              onSetProjectLink={props.onSetProjectLink}
            />

            <MoreDetails phone={phone} details={props.details} onDetail={props.onDetail} onGapSwitch={props.onGapSwitch} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SandboxCard;
