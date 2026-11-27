/* The prompt window's "Attached" section: the message's files and pictures at 72, in order.

   The maker drags one to a new place (a phone: long-press, then drag), or uses its menu, Move up and Move down, from the keyboard;
   removes one with its close button, after "Remove this attachment?"; gives each a note of up to 140 characters and, on a
   picture, the day it was captured. "Attached after the text" says where they sat. "Attach" opens the file picker for several
   files at once; on a phone "Attach" and the camera are the first two items of the row.

   PURE: the attachments in, intentions out. The page uploads, links, reorders and deletes. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";

import { ATTACHMENT_COPY, ATTACHMENTS_MAX, dragAttachment, moveAttachment, type Attachment } from "@/lib/build/attachments";
import { ATTACHMENT_NOTE_MAX } from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";
import { space } from "@/lib/theme/space";
import { Block, BlockHead, FieldInput, Inline, RecipeButton } from "@/pages/site/compose/modalRecipes";
import { LAYER } from "@/pages/site/compose/layers";
import { menuItem, menuSurface } from "@/pages/site/compose/refinedStyles";

import { ATTACHMENT_RADIUS, ATTACHMENT_SIZE, AttachmentItem } from "./AttachmentStrip";

export interface AttachedSectionProps {
  attachments: readonly Attachment[];
  at: "before" | "after";
  phone: boolean;
  /** Files picked, pasted or dropped, in the order given. */
  onAttach: (files: File[]) => void;
  onOrder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  /** A File node's `note` or `captured_at`; null takes it off. */
  onExtras: (id: string, patch: Record<string, unknown>) => void;
  onAt: (at: "before" | "after") => void;
  /** Crop or blur a picture, where the page offers it. */
  onEditPicture?: (attachment: Attachment) => void;
}

/** How long a press on a phone is held before the item can be dragged. */
export const LONG_PRESS_MS = 400;
const HIT = 32;

const squareButton = (phone: boolean): CSSProperties => ({
  appearance: "none",
  width: phone ? 44 : HIT,
  height: phone ? 44 : HIT,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  margin: 0,
  border: 0,
  background: "transparent",
  color: t.text2,
  cursor: "pointer",
  fontFamily: FIGTREE,
  fontSize: textStep.meta,
  borderRadius: ATTACHMENT_RADIUS,
});

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={{ appearance: "none", display: "inline-flex", alignItems: "center", gap: space[2], padding: 0, border: 0, background: "transparent", cursor: "pointer", color: t.text, fontFamily: FIGTREE, fontSize: textStep.meta, minHeight: 32 }}>
      <span aria-hidden="true" style={{ width: 32, height: 18, borderRadius: 9, background: checked ? t.brandAccent : t.control, position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: 7, background: t.text }} />
      </span>
      {label}
    </button>
  );
}

function Item({ attachment, index, count, phone, props, dragging, onDragStart, onDragOver, onDrop, onPointerDown }: { attachment: Attachment; index: number; count: number; phone: boolean; props: AttachedSectionProps; dragging: boolean; onDragStart: () => void; onDragOver: (event: DragEvent) => void; onDrop: () => void; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState(attachment.note ?? "");
  const [day, setDay] = useState(attachment.capturedAt ?? "");
  const ids = props.attachments.map((entry) => entry.id);
  const side = ATTACHMENT_SIZE.reader;
  return (
    <div data-testid="attached-item" data-id={attachment.id} role="listitem" aria-label={attachment.name} style={{ display: "flex", flexDirection: "column", gap: space[2], width: phone ? side + 8 : 200, flexShrink: 0, opacity: dragging ? 0.5 : 1 }}>
      <div
        draggable={!phone}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPointerDown={phone ? onPointerDown : undefined}
        data-attached-index={index}
        style={{ position: "relative", display: "inline-flex", alignSelf: "flex-start", cursor: phone ? "default" : "grab", touchAction: phone ? "pan-x" : undefined }}
      >
        <AttachmentItem attachment={attachment} side={side} />
        <button type="button" aria-label={ATTACHMENT_COPY.remove(attachment.name)} onClick={() => setAsking(true)} style={{ ...squareButton(phone), position: "absolute", top: -8, right: -8, borderRadius: 16 }}>
          <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 10, background: t.control, color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>×</span>
        </button>
      </div>
      {asking ? (
        <div role="group" aria-label={ATTACHMENT_COPY.removeAsk} style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
          <span style={{ fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text }}>{ATTACHMENT_COPY.removeAsk}</span>
          <Inline>
            <RecipeButton small phone={phone} onClick={() => props.onRemove(attachment.id)}>
              {ATTACHMENT_COPY.removeYes}
            </RecipeButton>
            <RecipeButton small variant="ghost" phone={phone} onClick={() => setAsking(false)}>
              {ATTACHMENT_COPY.keep}
            </RecipeButton>
          </Inline>
        </div>
      ) : null}
      {phone ? null : (
        <>
          <span aria-hidden="true" style={{ fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text2 }}>{ATTACHMENT_COPY.note}</span>
          <FieldInput
            phone={phone}
            aria-label={`${ATTACHMENT_COPY.note}: ${attachment.name}`}
            maxLength={ATTACHMENT_NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note.trim() !== (attachment.note ?? "")) props.onExtras(attachment.id, { note: note.trim() || null });
            }}
          />
          {attachment.kind === "picture" && attachment.mediaId ? (
            <label style={{ display: "flex", flexDirection: "column", gap: space[1], fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text2 }}>
              {ATTACHMENT_COPY.capturedOn}
              <FieldInput
                phone={phone}
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                onBlur={() => {
                  if (day !== (attachment.capturedAt ?? "")) props.onExtras(attachment.id, { captured_at: day || null });
                }}
              />
            </label>
          ) : null}
        </>
      )}
      <Inline>
        <Menu.Root>
          <Menu.Trigger asChild>
            <button type="button" aria-label={ATTACHMENT_COPY.moveMenu(attachment.name)} style={{ ...squareButton(phone), width: "auto", padding: `0 ${space[2]}px` }}>
              {`${index + 1} of ${count}`}
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="start" sideOffset={4} style={{ ...menuSurface(), zIndex: LAYER.floating }}>
              <Menu.Item disabled={index === 0} onSelect={() => props.onOrder(moveAttachment(ids, attachment.id, -1))} style={menuItem(index !== 0, phone)}>
                {ATTACHMENT_COPY.moveUp}
              </Menu.Item>
              <Menu.Item disabled={index === count - 1} onSelect={() => props.onOrder(moveAttachment(ids, attachment.id, 1))} style={menuItem(index !== count - 1, phone)}>
                {ATTACHMENT_COPY.moveDown}
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        {attachment.kind === "picture" && attachment.mediaId && props.onEditPicture ? (
          <RecipeButton small variant="ghost" phone={phone} onClick={() => props.onEditPicture?.(attachment)}>
            Crop or blur
          </RecipeButton>
        ) : null}
      </Inline>
    </div>
  );
}

export function AttachedSection(props: AttachedSectionProps) {
  const { attachments, at, phone, onAttach, onOrder, onAt } = props;
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState<number | null>(null);
  const press = useRef<{ timer: number; index: number; armed: boolean } | null>(null);
  const ids = attachments.map((attachment) => attachment.id);
  const full = attachments.length >= ATTACHMENTS_MAX;

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onAttach(files);
  };

  /* A phone: a long press arms the item; moving over another item then puts it there. */
  const onPointerDown = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const held = { timer: 0, index, armed: false };
    held.timer = window.setTimeout(() => {
      held.armed = true;
      setFrom(index);
      target.setPointerCapture?.(event.pointerId);
    }, LONG_PRESS_MS);
    press.current = held;
    const end = (up: globalThis.PointerEvent) => {
      window.clearTimeout(held.timer);
      if (held.armed) {
        const over = document.elementFromPoint(up.clientX, up.clientY)?.closest("[data-attached-index]");
        const to = over ? Number(over.getAttribute("data-attached-index")) : held.index;
        if (Number.isInteger(to) && to !== held.index) onOrder(dragAttachment(ids, held.index, to));
      }
      setFrom(null);
      press.current = null;
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const pickers = (
    <>
      <input ref={picker} type="file" multiple hidden data-testid="attach-input" onChange={(event) => { take(event.target.files); event.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden data-testid="camera-input" onChange={(event) => { take(event.target.files); event.target.value = ""; }} />
    </>
  );

  const items = attachments.map((attachment, index) => (
    <Item
      key={attachment.id}
      attachment={attachment}
      index={index}
      count={attachments.length}
      phone={phone}
      props={props}
      dragging={from === index}
      onDragStart={() => setFrom(index)}
      onDragOver={(event) => {
        if (from === null) return;
        event.preventDefault();
      }}
      onDrop={() => {
        if (from !== null && from !== index) onOrder(dragAttachment(ids, from, index));
        setFrom(null);
      }}
      onPointerDown={onPointerDown(index)}
    />
  ));

  const tile = (label: string, onClick: () => void, testId: string) => (
    <button type="button" data-testid={testId} disabled={full} onClick={onClick} style={{ width: ATTACHMENT_SIZE.reader, height: ATTACHMENT_SIZE.reader, flexShrink: 0, borderRadius: ATTACHMENT_RADIUS, border: `1px dashed ${t.line}`, background: "transparent", color: t.text2, fontFamily: FIGTREE, fontSize: textStep.meta, cursor: full ? "default" : "pointer" }}>
      {label}
    </button>
  );

  return (
    <Block testId="attached-section">
      <BlockHead label={ATTACHMENT_COPY.attached} count={attachments.length > 0 ? `${attachments.length} of ${ATTACHMENTS_MAX}` : undefined}>
        {phone ? null : (
          <RecipeButton small phone={phone} disabled={full} onClick={() => picker.current?.click()}>
            {ATTACHMENT_COPY.attach}
          </RecipeButton>
        )}
      </BlockHead>
      {pickers}
      <div role="list" aria-label={ATTACHMENT_COPY.attached} style={{ display: "flex", gap: space[3], overflowX: "auto", paddingTop: space[2], paddingRight: space[2], minWidth: 0, alignItems: "flex-start" }}>
        {phone ? (
          <>
            {tile(ATTACHMENT_COPY.attach, () => picker.current?.click(), "attach-tile")}
            {tile(ATTACHMENT_COPY.camera, () => camera.current?.click(), "camera-tile")}
          </>
        ) : null}
        {items}
      </div>
      <Switch checked={at === "after"} label={ATTACHMENT_COPY.after} onChange={(on) => onAt(on ? "after" : "before")} />
    </Block>
  );
}
