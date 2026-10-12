/* UI-P64 — Sources: the left panel of the new composer.

   PURE. Rows in, intentions out. `SandboxPage` works the rows out
   (`sourcesModel`) and does the writes; the dev page hands in a fixture.

   THE ONLY LIST OF SOURCES (CONCEPT §5). Sessions in this build, each opening
   to the prompts it gave the build; files in this build; sessions not in a
   build; and the drop zone. A group with nothing in it is left out, and an
   empty build shows the two empty lines instead.

   ONE ROUTE TO EACH THING. A session joins the build with its + (or Add ›
   Session in the Build panel's menu, which lists the same rows); a file joins
   by dropping it here or Add › File. Nothing here has a filled button: Publish
   is the page's one primary.

   SIX ROWS, THEN "Show {n} more" in place, in every group and in every opened
   session ⟦hicks-law: six, then More⟧.

   ON A PHONE this is the content of the "Sources" bottom sheet, which names it,
   so the head says only how many are in the build. Rows are 44 tall, and the
   drop zone is a button that opens the file picker. */

import { ChevronDown, FileText, Plus } from "lucide-react";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { IconButton } from "@/components/brand/IconButton";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { move } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import {
  capRows,
  sessionHeading,
  sessionLine,
  type SourcesFile,
  type SourcesLibraryRow,
  type SourcesSession,
} from "./sourcesModel";

/** What the maker has selected: Details shows it (UI-P66). */
export type SourcesSelection =
  | { kind: "session"; key: string }
  | { kind: "prompt"; id: string }
  | { kind: "file"; id: string };

export interface SourcesPanelProps {
  sessions: readonly SourcesSession[];
  files: readonly SourcesFile[];
  /** Sessions that can still be added: waiting, in no build. */
  library: readonly SourcesLibraryRow[];
  libraryStatus: "loading" | "error" | "ready";
  onRetryLibrary: () => void;
  selected: SourcesSelection | null;
  onSelect: (selection: SourcesSelection) => void;
  onAttachSession: (sessionId: string) => void;
  /** Files dropped here or chosen in the picker. */
  onFiles: (files: File[]) => void;
  /** Opens the file picker; the page owns the input. */
  onPickFiles: () => void;
  /** A session export was dropped: say where it is read. */
  intakeNote: boolean;
}

/** The chevron's slot: rows under a session sit this far in, with the dot. */
const CHEVRON_SLOT = 28;

const quiet: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13.5, color: t.text2 };

/* ── small parts ── */

function Dot({ hollow = false, size = 7 }: { hollow?: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: "50%",
        background: hollow ? "transparent" : t.text,
        border: hollow ? `1.5px solid ${t.text2}` : "none",
      }}
    />
  );
}

function GroupHead({ name, count, hollow = false }: { name: string; count: number; hollow?: boolean }) {
  return (
    <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontWeight: 400 }}>
      <Dot hollow={hollow} />
      <span style={{ fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 600, color: t.text }}>{name}</span>
      <span style={{ fontFamily: DM_MONO, fontSize: 11.5, color: t.text2 }}>{count}</span>
    </h3>
  );
}

/** A row's whole face as one button: hover, focus ring and the selected ground. */
function RowButton({
  selected,
  onClick,
  minHeight,
  children,
  style,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  minHeight: number;
  children: ReactNode;
  style?: CSSProperties;
  label?: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      aria-label={label}
      {...handlers}
      style={{
        boxSizing: "border-box",
        minHeight,
        width: "100%",
        minWidth: 0,
        margin: 0,
        border: 0,
        borderRadius: 8,
        background: selected ? t.recess : state.hovered ? t.rowHighlight : "transparent",
        color: t.text,
        textAlign: "left",
        cursor: "pointer",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ShowMore({ more, all, onToggle, phone }: { more: number; all: boolean; onToggle: () => void; phone: boolean }) {
  if (more === 0 && !all) return null;
  return (
    <div style={{ padding: "4px 0 0 2px" }}>
      <TextButton underline target={phone} aria-expanded={all} onClick={onToggle} style={{ fontSize: 12 }}>
        {all ? "Show fewer" : `Show ${more} more`}
      </TextButton>
    </div>
  );
}

/* ── a session and the prompts it gave the build ── */

function SessionRow({
  session,
  first,
  phone,
  selected,
  onSelect,
}: {
  session: SourcesSession;
  first: boolean;
  phone: boolean;
  selected: SourcesSelection | null;
  onSelect: (selection: SourcesSelection) => void;
}) {
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const chevron = useInteractive<HTMLButtonElement>();
  const { shown, more } = capRows(session.prompts, all);
  const rowHeight = phone ? 44 : 26;
  const sessionSelected = selected?.kind === "session" && selected.key === session.key;
  const line = sessionLine(session);

  return (
    <li
      data-testid="source-session"
      style={{ listStyle: "none", borderTop: first ? "none" : `1px solid ${t.hairline}`, padding: "6px 0" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Prompts of session ${session.number}`}
          onClick={() => setOpen((value) => !value)}
          {...chevron.handlers}
          style={{
            width: phone ? 44 : 26,
            height: phone ? 44 : 26,
            flexShrink: 0,
            padding: 0,
            border: 0,
            borderRadius: 8,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            ...ring(chevron.state.focusVisible),
          }}
        >
          <ChevronDown
            aria-hidden="true"
            size={16}
            strokeWidth={1.6}
            color="var(--text2)"
            style={{ transform: open ? "none" : "rotate(-90deg)", transition: move() }}
          />
        </button>
        <RowButton
          selected={sessionSelected}
          minHeight={phone ? 44 : 38}
          onClick={() => onSelect({ kind: "session", key: session.key })}
          style={{ padding: "3px 6px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}
        >
          <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sessionHeading(session)}
          </span>
          {line ? <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</span> : null}
        </RowButton>
      </div>

      {open && session.prompts.length > 0 ? (
        <div style={{ paddingLeft: CHEVRON_SLOT + 16 - 12, paddingTop: 4 }}>
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.map((prompt) => (
              <li key={prompt.id} data-testid="source-prompt" style={{ listStyle: "none" }}>
                <RowButton
                  selected={selected?.kind === "prompt" && selected.id === prompt.id}
                  minHeight={rowHeight}
                  onClick={() => onSelect({ kind: "prompt", id: prompt.id })}
                  label={`Prompt ${prompt.number}: ${prompt.title}`}
                  style={{ padding: "0 8px", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Dot size={6} />
                  <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2, minWidth: 14 }}>{prompt.number}</span>
                  <span
                    style={{
                      minWidth: 0,
                      fontFamily: FIGTREE,
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: prompt.isDefault ? t.text2 : t.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {prompt.title}
                  </span>
                </RowButton>
              </li>
            ))}
          </ul>
          <ShowMore more={more} all={all} phone={phone} onToggle={() => setAll((value) => !value)} />
        </div>
      ) : null}
    </li>
  );
}

/* ── a file ── */

function FileRow({
  file,
  first,
  phone,
  selected,
  onSelect,
}: {
  file: SourcesFile;
  first: boolean;
  phone: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li data-testid="source-file" style={{ listStyle: "none", borderTop: first ? "none" : `1px solid ${t.hairline}`, padding: "6px 0" }}>
      <RowButton
        selected={selected}
        minHeight={phone ? 44 : 38}
        onClick={onSelect}
        style={{ padding: "3px 6px", display: "flex", alignItems: "center", gap: 8 }}
      >
        <FileText aria-hidden="true" size={14} strokeWidth={1.6} color="var(--text)" style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.name}
          </span>
          <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.origin}
          </span>
        </span>
      </RowButton>
    </li>
  );
}

/* ── a session that is not in the build ── */

function LibraryRow({
  row,
  first,
  phone,
  onAttach,
}: {
  row: SourcesLibraryRow;
  first: boolean;
  phone: boolean;
  onAttach: (sessionId: string) => void;
}) {
  const textId = `source-library-${row.id}`;
  return (
    <li
      data-testid="source-library"
      style={{
        listStyle: "none",
        borderTop: first ? "none" : `1px solid ${t.hairline}`,
        padding: "6px 0",
        display: "flex",
        alignItems: "center",
        gap: 2,
        minHeight: phone ? 44 : undefined,
      }}
    >
      <span aria-hidden="true" style={{ width: phone ? 44 : 26, flexShrink: 0 }} />
      <span id={textId} style={{ flexGrow: 1, minWidth: 0, padding: "3px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {`Session · ${row.source}`}
        </span>
        <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.line}</span>
      </span>
      <IconButton
        icon={Plus}
        size={30}
        label="Add session"
        aria-describedby={textId}
        style={phone ? { width: 44, height: 44 } : undefined}
        onClick={() => onAttach(row.id)}
      />
    </li>
  );
}

/* ── the drop zone ── */

function DropZone({ fine, phone, onFiles, onPickFiles }: { fine: boolean; phone: boolean; onFiles: (files: File[]) => void; onPickFiles: () => void }) {
  const [over, setOver] = useState(false);
  const button = useInteractive<HTMLButtonElement>();

  const box: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    minHeight: phone ? 44 : 46,
    padding: "12px 16px",
    borderRadius: r.control,
    border: `1.5px dashed ${over ? t.text2 : t.line}`,
    background: over ? t.recess : "transparent",
    color: t.text2,
    fontFamily: FIGTREE,
    fontSize: 13.5,
    textAlign: "center",
  };

  if (!fine) {
    return (
      <button type="button" data-testid="sources-drop" onClick={onPickFiles} {...button.handlers} style={{ ...box, cursor: "pointer", ...ring(button.state.focusVisible) }}>
        Drop sessions or files
      </button>
    );
  }

  const stop = (event: DragEvent) => {
    event.preventDefault();
  };
  return (
    <div
      data-testid="sources-drop"
      data-over={over ? "true" : undefined}
      onDragEnter={(event) => {
        stop(event);
        setOver(true);
      }}
      onDragOver={(event) => {
        stop(event);
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        stop(event);
        setOver(false);
        const dropped = Array.from(event.dataTransfer.files ?? []);
        if (dropped.length > 0) onFiles(dropped);
      }}
      style={box}
    >
      Drop sessions or files
    </div>
  );
}

/* ── the panel ── */

export function SourcesPanel({
  sessions,
  files,
  library,
  libraryStatus,
  onRetryLibrary,
  selected,
  onSelect,
  onAttachSession,
  onFiles,
  onPickFiles,
  intakeNote,
}: SourcesPanelProps) {
  const phone = useIsPhone();
  const fine = useFinePointer() && !phone;
  const [allSessions, setAllSessions] = useState(false);
  const [allFiles, setAllFiles] = useState(false);
  const [allLibrary, setAllLibrary] = useState(false);

  const inBuild = sessions.length + files.length;
  const sessionRows = capRows(sessions, allSessions);
  const fileRows = capRows(files, allFiles);
  const libraryRows = capRows(library, allLibrary);
  const empty = sessions.length === 0 && files.length === 0;

  const list: CSSProperties = { margin: "6px 0 0", padding: 0, borderTop: `1px solid ${t.hairline}` };
  const group: CSSProperties = { marginTop: 14 };

  return (
    <div data-testid="sources-panel">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: phone ? "flex-start" : "space-between", gap: 9 }}>
        {phone ? null : <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>Sources</h2>}
        <span data-testid="sources-count" style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
          {inBuild} in build
        </span>
      </div>

      {empty ? (
        <div style={{ ...group, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={quiet}>
            No sessions yet.{" "}
            <Link to="/connect" style={{ color: t.text2, textDecoration: "underline", borderRadius: 6 }}>
              Connect a tool
            </Link>
          </p>
          <p style={quiet}>No files yet.</p>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <section aria-label="Sessions in this build" style={group}>
          <GroupHead name="Sessions in this build" count={sessions.length} />
          <ul style={list}>
            {sessionRows.shown.map((session, index) => (
              <SessionRow key={session.key} session={session} first={index === 0} phone={phone} selected={selected} onSelect={onSelect} />
            ))}
          </ul>
          <ShowMore more={sessionRows.more} all={allSessions} phone={phone} onToggle={() => setAllSessions((value) => !value)} />
        </section>
      ) : null}

      {files.length > 0 ? (
        <section aria-label="Files in this build" style={group}>
          <GroupHead name="Files in this build" count={files.length} />
          <ul style={list}>
            {fileRows.shown.map((file, index) => (
              <FileRow
                key={file.id}
                file={file}
                first={index === 0}
                phone={phone}
                selected={selected?.kind === "file" && selected.id === file.id}
                onSelect={() => onSelect({ kind: "file", id: file.id })}
              />
            ))}
          </ul>
          <ShowMore more={fileRows.more} all={allFiles} phone={phone} onToggle={() => setAllFiles((value) => !value)} />
        </section>
      ) : null}

      {libraryStatus === "loading" ? (
        <LoadingRegion what="sessions not in a build" style={{ ...group, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton height={phone ? 44 : 38} radius={8} />
        </LoadingRegion>
      ) : libraryStatus === "error" ? (
        <p style={{ ...quiet, ...group, fontSize: 12 }}>
          Your other sessions didn&apos;t load.{" "}
          <TextButton underline target={phone} onClick={onRetryLibrary} style={{ fontSize: 12 }}>
            Try again
          </TextButton>
        </p>
      ) : library.length > 0 ? (
        <section aria-label="Not in a build" style={group}>
          <GroupHead name="Not in a build" count={library.length} hollow />
          <ul style={list}>
            {libraryRows.shown.map((row, index) => (
              <LibraryRow key={row.id} row={row} first={index === 0} phone={phone} onAttach={onAttachSession} />
            ))}
          </ul>
          <ShowMore more={libraryRows.more} all={allLibrary} phone={phone} onToggle={() => setAllLibrary((value) => !value)} />
        </section>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
        <DropZone fine={fine} phone={phone} onFiles={onFiles} onPickFiles={onPickFiles} />
        {intakeNote ? (
          <p role="status" data-testid="sources-intake-note" style={{ ...quiet, fontSize: 12 }}>
            That looks like a session export.{" "}
            <Link to="/compose/start" style={{ color: t.text2, textDecoration: "underline", borderRadius: 6 }}>
              Read it in the intake
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SourcesPanel;
