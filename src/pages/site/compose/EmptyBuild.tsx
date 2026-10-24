/* CA-24 P2: the empty build.

   A build with no sessions and no tiles shows this in the Build column, under the post, in place of the default first
   session and the add rows under the build. "Add your first session", a box of two rows (import from the connected chats, or
   a new empty session) and a place to drop sessions or files. Once the first session exists the page takes it away and the
   build shows as it always has.

   ROW 1 opens the existing list of connected chats (Add a session, then Add from your connected chats), anchored to the row.
   ROW 2 runs `onStartNew`, the page's `onStartSession`. THE DROP ZONE takes what Sources' does and goes where it goes: a
   folder is walked, a chat export goes to the intake. Without a mouse it is a button that opens the file picker. */

import { useState, type DragEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { ChatsPicker, type AddSessionRowProps } from "./AddSessionRow";
import { holdsFolder, readDrop } from "./dropFolders";
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
  emptyDrop,
} from "./emptyBuildRecipes";

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

function Row({ name, detail, onClick, disabled, testId }: { name: string; detail?: string; onClick?: () => void; disabled?: boolean; testId: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      style={{ ...EMPTY_ROW, ...(state.hovered && !disabled ? { background: t.controlOn } : null), ...(disabled ? { cursor: "default" } : null), ...ring(state.focusVisible) }}
    >
      <span aria-hidden="true" style={EMPTY_MARK} />
      <span style={EMPTY_NAMES}>
        <span style={EMPTY_NAME}>{name}</span>
        {detail ? <span style={EMPTY_DETAIL}>{detail}</span> : null}
      </span>
      <span aria-hidden="true" style={EMPTY_CHEVRON}>
        <Glyph name="chev" size={16} />
      </span>
    </button>
  );
}

function DropZone({ fine, onDropFiles, onPick }: Pick<EmptyBuildProps, "fine" | "onDropFiles" | "onPick">) {
  const [over, setOver] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  if (!fine) {
    return (
      <button type="button" data-testid="empty-build-drop" onClick={onPick} {...handlers} style={{ ...emptyDrop(false), cursor: "pointer", ...ring(state.focusVisible) }}>
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
      style={emptyDrop(over)}
    >
      {EMPTY_BUILD_COPY.drop}
    </div>
  );
}

export function EmptyBuild({ phone, fine, available, addSession, onDropFiles, onPick }: EmptyBuildProps) {
  const [picking, setPicking] = useState(false);
  return (
    <div data-testid="empty-build" style={EMPTY_COLUMN}>
      <h2 style={EMPTY_HEADING}>{EMPTY_BUILD_COPY.heading}</h2>
      <div style={EMPTY_BOX}>
        <ChatsPicker props={{ ...addSession, phone }} open={picking} onOpenChange={setPicking}>
          <Row testId="empty-build-chats" name={EMPTY_BUILD_COPY.fromChats} detail={EMPTY_BUILD_COPY.availableOf(available)} disabled={addSession.adding} onClick={() => setPicking(true)} />
        </ChatsPicker>
        <div aria-hidden="true" style={EMPTY_RULE} />
        <Row testId="empty-build-new" name={EMPTY_BUILD_COPY.startNew} disabled={addSession.adding} onClick={() => addSession.onStartNew()} />
      </div>
      <DropZone fine={fine} onDropFiles={onDropFiles} onPick={onPick} />
    </div>
  );
}

export default EmptyBuild;
