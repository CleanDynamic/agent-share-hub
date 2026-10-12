/* UI-P63 — the Card: the cover, the title, the one-line summary, who it's for,
   made with and more details, in a sheet on the right.

   PURE. Every field is today's: the same props the old composer's panels take,
   the same page supplying them, so there is no new write path. It opens from
   "Card", or from a missing item in the status line, in which case focus lands
   on that item's field.

   A Radix Dialog: focus is trapped, Esc closes, the page behind is inert. The
   sheet is `--flat` with a 1px `--line` left edge and the dialog shadow and
   scrim the other sheets use. Nothing on it blurs. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Field, TextButton } from "./composeControls";
import { fieldBase, useRing } from "./composeFields";
import { DESCRIPTION_MAX } from "./composeModel";
import { MediaPanel, type ComposeViewProps } from "./ComposeView";
import { MadeWithLine } from "./MadeWithLine";
import { MoreDetails } from "./MoreDetails";

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
}

function Section({ id, heading, children }: { id?: string; heading: string; children: ReactNode }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} aria-label={heading} style={{ outline: "none" }}>
      {children}
    </section>
  );
}

export function SandboxCard(props: SandboxCardProps) {
  const { open, onOpenChange, field, phone } = props;
  const titleRing = useRing<HTMLInputElement>();
  const summaryRing = useRing<HTMLTextAreaElement>();
  const audienceRing = useRing<HTMLInputElement>();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, zIndex: 50, background: t.sheetDim }} />
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
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 51,
            width: "min(480px, 100%)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            background: "var(--flat)",
            color: t.text,
            borderLeft: `1px solid ${t.line}`,
            boxShadow: t.shadowSheet,
            outline: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, padding: "16px 16px 0" }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>Card</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={34} />
            </Dialog.Close>
          </div>

          <div style={{ flexGrow: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <Section id={CARD_FIELD_ID.cover} heading="Cover">
              <MediaPanel
                phone={phone}
                heading="Cover"
                cover={props.cover}
                adding={props.adding}
                mediaError={props.mediaError}
                accept={props.accept}
                onFiles={props.onFiles}
                onRemoveCover={props.onRemoveCover}
              />
              {props.onUseResultPicture ? (
                <div style={{ marginTop: 7 }}>
                  <TextButton underline onClick={props.onUseResultPicture}>
                    Use a result's picture
                  </TextButton>
                </div>
              ) : null}
            </Section>

            <Field id={CARD_FIELD_ID.title} label="Title">
              <input
                id={CARD_FIELD_ID.title}
                type="text"
                value={props.title}
                placeholder="Name your build"
                autoComplete="off"
                onChange={(event) => props.onTitle(event.target.value)}
                {...titleRing.handlers}
                style={{ ...fieldBase, height: phone ? 44 : 36, padding: "0 10px", fontSize: 16, fontWeight: 600, ...titleRing.style }}
              />
            </Field>

            <Field
              id={CARD_FIELD_ID.summary}
              label="One-line summary"
              right={<span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>{props.description.length} / {DESCRIPTION_MAX}</span>}
            >
              <textarea
                id={CARD_FIELD_ID.summary}
                rows={3}
                value={props.description}
                maxLength={DESCRIPTION_MAX}
                placeholder="What does it do, and who is it for? One or two sentences."
                onChange={(event) => props.onDescription(event.target.value)}
                {...summaryRing.handlers}
                style={{ ...fieldBase, padding: "9px 10px", fontSize: phone ? 16 : 15, lineHeight: 1.5, resize: "vertical", display: "block", ...summaryRing.style }}
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
                {...audienceRing.handlers}
                style={{ ...fieldBase, height: 33, padding: "0 10px", fontSize: phone ? 16 : 14, ...audienceRing.style }}
              />
              <datalist id="card-audience-options">
                {props.audienceOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </Field>

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
