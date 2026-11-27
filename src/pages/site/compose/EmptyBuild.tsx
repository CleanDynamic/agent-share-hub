/* CA-24 P2: the empty build.

   A build with no sessions and no tiles shows this in the Build column, under the post, in place of the default first
   session and the add rows under the build. "Add your first session", a box of two rows (import from the connected chats, or
   a new empty session) and a place to drop sessions or files. Once the first session exists the page takes it away and the
   build shows as it always has.

   ROW 1 opens the existing list of connected chats (Add a session, then Add from your connected chats), anchored to the row.
   ROW 2 runs `onStartNew`, the page's `onStartSession`. THE DROP ZONE takes what Sources' does and goes where it goes: a
   folder is walked, a chat export goes to the intake. Without a mouse it is a button that opens the file picker. */

import { useRef, useState, type DragEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { ChatsPicker, type AddSessionRowProps } from "./AddSessionRow";
import { holdsFolder, readDrop } from "./dropFolders";
import { SLIDE_ATTR } from "./flip";
import { MotionBoundary, NO_SLIDE, useListMotion } from "./listMotion";
import {
  EMPTY_BOX,
  EMPTY_BUILD_COPY,
  EMPTY_CHEVRON,
  EMPTY_COLUMN,
  EMPTY_DETAIL,
  EMPTY_HEADING,
  EMPTY_MARK,
  EMPTY_NAME,
  EMPTY_NAMES,
  EMPTY_ROW,
  EMPTY_RULE,
  PHONE_EMPTY_BOX,
  PHONE_EMPTY_DETAIL,
  PHONE_EMPTY_HEADING,
  PHONE_EMPTY_NAME,
  PHONE_EMPTY_ROW,
  emptyDrop,
  phoneEmptyDrop,
} from "./emptyBuildRecipes";
import { size } from "@/lib/theme/space";

export interface EmptyBuildProps {
  phone: boolean;
  /** A mouse or trackpad: the zone takes drops. Otherwise it opens the file picker. */
  fine: boolean;
  /** Sources' library rows not yet in this build. */
  available: number;
  /** The same props the Add a session row takes: the library, `onAdd`, `onStartNew`, `adding`. */
  addSession: Omit<AddSessionRowProps, "phone">;
  onDropFiles: (files: File[], paths?: string[]) => void;
  onPick: () => void;
}

function Row({ name, detail, onClick, disabled, testId, phone = false, icon }: { name: string; detail?: string; onClick?: () => void; disabled?: boolean; testId: string; phone?: boolean; icon?: MobileIconName }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (phone) {
    /* 29f: the row's own icon at 20 in Text 2 in place of the grey square, and no chevron. */
    return (
      <button type="button" data-testid={testId} disabled={disabled} onClick={onClick} {...handlers} style={{ ...PHONE_EMPTY_ROW, ...(disabled ? { cursor: "default" } : null), ...ring(state.focusVisible) }}>
        <span aria-hidden="true" style={{ display: "inline-flex", width: 24, justifyContent: "center", flexShrink: 0, color: t.text2 }}>
          {icon ? <MobileIcon name={icon} size={20} /> : null}
        </span>
        <span style={EMPTY_NAMES}>
          <span style={PHONE_EMPTY_NAME}>{name}</span>
          {detail ? <span style={PHONE_EMPTY_DETAIL}>{detail}</span> : null}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      style={{ ...EMPTY_ROW, ...(state.hovered && !disabled ? { background: hoverFill() } : null), ...(disabled ? { cursor: "default" } : null), ...ring(state.focusVisible) }}
    >
      <span aria-hidden="true" style={EMPTY_MARK} />
      <span style={EMPTY_NAMES}>
        <span style={EMPTY_NAME}>{name}</span>
        {detail ? <span style={EMPTY_DETAIL}>{detail}</span> : null}
      </span>
      <span aria-hidden="true" style={EMPTY_CHEVRON}>
        <Glyph name="chev" size={size.icon} />
      </span>
    </button>
  );
}

function DropZone({ fine, onDropFiles, onPick, phone = false }: Pick<EmptyBuildProps, "fine" | "onDropFiles" | "onPick"> & { phone?: boolean }) {
  const drop = phone ? phoneEmptyDrop : emptyDrop;
  const [over, setOver] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  if (!fine) {
    return (
      <button type="button" data-testid="empty-build-drop" onClick={onPick} {...handlers} style={{ ...drop(false), cursor: "pointer", ...ring(state.focusVisible) }}>
        {EMPTY_BUILD_COPY.drop}
      </button>
    );
  }
  return (
    <div
      data-testid="empty-build-drop"
      data-over={over ? "true" : undefined}
      onDragEnter={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setOver(false);
        // A folder is walked, so a skill's files keep their places.
        if (holdsFolder(event.dataTransfer)) {
          void readDrop(event.dataTransfer).then(({ files, paths }) => {
            if (files.length > 0) onDropFiles(files, paths);
          });
          return;
        }
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onDropFiles(files);
      }}
      style={drop(over)}
    >
      {EMPTY_BUILD_COPY.drop}
    </div>
  );
}

export function EmptyBuild({ phone, fine, available, addSession, onDropFiles, onPick }: EmptyBuildProps) {
  const [picking, setPicking] = useState(false);
  /* SV-07 P6: the list of chats opens under its row, and what stands below it slides down through the List's one animator. */
  const root = useRef<HTMLDivElement | null>(null);
  const motion = useListMotion(root);
  return (
    <MotionBoundary motion={motion} slide={NO_SLIDE}>
      <div ref={root} data-testid="empty-build" style={EMPTY_COLUMN}>
        <h2 style={phone ? PHONE_EMPTY_HEADING : EMPTY_HEADING}>{EMPTY_BUILD_COPY.heading}</h2>
        <div style={phone ? PHONE_EMPTY_BOX : EMPTY_BOX}>
          <ChatsPicker props={{ ...addSession, phone }} open={picking} onOpenChange={setPicking}>
            <Row phone={phone} icon="import" testId="empty-build-chats" name={EMPTY_BUILD_COPY.fromChats} detail={EMPTY_BUILD_COPY.availableOf(available)} disabled={addSession.adding} onClick={() => setPicking(!picking)} />
          </ChatsPicker>
          {/* 29f: no rule between the rows on a phone; the spacing separates them. */}
          {phone ? null : <div aria-hidden="true" style={EMPTY_RULE} {...{ [SLIDE_ATTR]: "empty:rule" }} />}
          <div {...{ [SLIDE_ATTR]: "empty:new" }}>
            <Row phone={phone} icon="session" testId="empty-build-new" name={EMPTY_BUILD_COPY.startNew} disabled={addSession.adding} onClick={() => addSession.onStartNew()} />
          </div>
        </div>
        <div {...{ [SLIDE_ATTR]: "empty:drop" }}>
          <DropZone phone={phone} fine={fine} onDropFiles={onDropFiles} onPick={onPick} />
        </div>
      </div>
    </MotionBoundary>
  );
}

export default EmptyBuild;
