/* UI-P64 — Sources: the left panel of the new composer.

   PURE. Rows in, selections and adds out. `SandboxPage` reads the build's
   sessions, steps and files and the creator's library and hands them over
   already shaped (`sourcesModel.ts`); this file draws them. The old composer's
   `SessionsPanel` is untouched and still serves it.

   WHAT IT LISTS, in this order, each group left out when it is empty:
   Sessions in this build (with the prompts they gave it nested under them),
   Files in this build, and Not in a build (the library's sessions that no build
   has yet, each with one Add button). An empty build shows the S1 lines instead.

   AT MOST SIX ROWS PER GROUP, then one "Show {n} more" in place (CONCEPT §7).
   There is no filled button here. On a phone this is the content of the
   "Sources" bottom sheet, with rows at least 44 tall.

   THE DROP ZONE is the mouse's shortcut and the phone's button: without a fine
   pointer it is a button with the same words that opens the file picker, which
   the page owns (`onPick`). */

import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { IconButton } from "@/components/brand/IconButton";
import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import type { SourceFile, SourceLibraryItem, SourceSession } from "./sourcesModel";

/** CONCEPT §7: at most this many rows in any list, then one "Show {n} more". */
export const GROUP_ROWS = 6;

export const SOURCES_COPY = {
  inBuild: "Sessions in this build",
  files: "Files in this build",
  notInBuild: "Not in a build",
  drop: "Drop sessions or files",
  noSessions: "No sessions yet.",
  noFiles: "No files yet.",
  connect: "Connect a tool",
} as const;

export interface SourcesPanelProps {
  phone: boolean;
  fine: boolean;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  sessions: readonly SourceSession[];
  files: readonly SourceFile[];
  library: readonly SourceLibraryItem[];
  /** The selected session's key, or the selected step's id. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSession: (id: string) => void;
  /** Files dropped on the zone. */
  onDropFiles: (files: File[]) => void;
  /** Opens the page's file picker. */
  onPick: () => void;
  /** Where "Connect a tool" goes. */
  connectHref: string;
}

/* ── pieces ── */

const mono = (size: 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, color: t.text2 });

function GroupHead({ name, count, hollow }: { name: string; count: number; hollow?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: r.full,
          boxSizing: "border-box",
          background: hollow ? "transparent" : t.text2,
          border: hollow ? `1.5px solid ${t.text2}` : "none",
          flexShrink: 0,
        }}
      />
      <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 600, color: t.text }}>{name}</h3>
      <span style={{ ...mono(11.5), marginLeft: "auto" }}>{count}</span>
    </div>
  );
}

/** The first six rows of a group, then one button that shows the rest. */
function Capped<T>({ rows, render, phone }: { rows: readonly T[]; render: (row: T) => ReactNode; phone: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, GROUP_ROWS);
  const hidden = rows.length - shown.length;
  return (
    <>
      {shown.map(render)}
      {hidden > 0 ? (
        <div>
          <TextButton onClick={() => setAll(true)} target={phone}>
            Show {hidden} more
          </TextButton>
        </div>
      ) : null}
    </>
  );
}

function RowButton({
  selected,
  onClick,
  minHeight,
  children,
  label,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  minHeight: number;
  children: ReactNode;
  label?: string;
  style?: CSSProperties;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        minHeight,
        boxSizing: "border-box",
        padding: "0 6px",
        border: "none",
        borderRadius: r.control,
        background: selected ? tokenAlpha("action", 0.12) : state.hovered ? t.glass2 : "transparent",
        color: t.text,
        fontFamily: FIGTREE,
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

function SessionRow({
  session,
  phone,
  selectedId,
  onSelect,
}: {
  session: SourceSession;
  phone: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasPrompts = session.prompts.length > 0;
  const row = phone ? 44 : 40;
  const toggle = useInteractive<HTMLButtonElement>();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Open"} session ${session.number}`}
          disabled={!hasPrompts}
          onClick={() => setOpen((value) => !value)}
          {...toggle.handlers}
          style={{
            width: phone ? 44 : 24,
            height: phone ? 44 : 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: t.text2,
            borderRadius: 6,
            cursor: hasPrompts ? "pointer" : "default",
            opacity: hasPrompts ? 1 : 0.4,
            flexShrink: 0,
            ...ring(toggle.state.focusVisible),
          }}
        >
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
        <RowButton selected={selectedId === session.key} onClick={() => onSelect(session.key)} minHeight={row} style={{ minWidth: 0 }}>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Session {session.number} · {session.tool}
            </span>
            <span style={mono(12)}>{session.detail}</span>
          </span>
        </RowButton>
      </div>
      {open ? (
        <div style={{ marginLeft: 16, display: "flex", flexDirection: "column" }}>
          {session.prompts.map((prompt) => (
            <RowButton key={prompt.id} selected={selectedId === prompt.id} onClick={() => onSelect(prompt.id)} minHeight={phone ? 44 : 26}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: r.full, background: t.text2, flexShrink: 0 }} />
              <span style={mono(12)}>{prompt.number}</span>
              <span
                style={{
                  fontSize: 13,
                  color: prompt.isDefault ? t.text2 : t.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {prompt.title}
              </span>
            </RowButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({ file, phone }: { file: SourceFile; phone: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: phone ? 44 : 36, padding: "0 6px" }}>
      <FileText size={14} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {file.name}
        </span>
        <span style={mono(12)}>{file.note}</span>
      </span>
    </div>
  );
}

function LibraryRow({ item, phone, onAdd }: { item: SourceLibraryItem; phone: boolean; onAdd: (id: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minHeight: phone ? 44 : 36, padding: "0 0 0 6px" }}>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flexGrow: 1 }}>
        <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </span>
        <span style={mono(12)}>{item.line}</span>
      </span>
      <IconButton icon={Plus} label="Add session" size={30} disabled={item.adding} onClick={() => onAdd(item.id)} />
    </div>
  );
}

function DropZone({ fine, onDropFiles, onPick }: Pick<SourcesPanelProps, "fine" | "onDropFiles" | "onPick">) {
  const [over, setOver] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const base: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    borderRadius: r.media,
    border: `1.5px dashed ${over ? t.evidence : t.line}`,
    background: over ? t.rowHighlight : t.recess,
    padding: 16,
    textAlign: "center",
    fontFamily: FIGTREE,
    fontSize: 13.5,
    color: t.text2,
  };
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  if (!fine) {
    return (
      <button type="button" data-testid="sources-drop" onClick={onPick} {...handlers} style={{ ...base, minHeight: 44, cursor: "pointer", ...ring(state.focusVisible) }}>
        {SOURCES_COPY.drop}
      </button>
    );
  }
  return (
    <div
      data-testid="sources-drop"
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
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onDropFiles(files);
      }}
      style={base}
    >
      {SOURCES_COPY.drop}
    </div>
  );
}

/* ── the panel ── */

export function SourcesPanel(props: SourcesPanelProps) {
  const { phone, fine, status, sessions, files, library } = props;
  const inBuild = sessions.length + files.length;
  const empty = sessions.length === 0 && files.length === 0;
  const line: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13.5, color: t.text2 };

  if (status === "loading") {
    return (
      <LoadingRegion what="your sources" announce>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Skeleton width={140} height={14} />
          <Skeleton height={36} radius={r.control} />
          <Skeleton height={36} radius={r.control} />
        </div>
      </LoadingRegion>
    );
  }
  if (status === "error") return <ErrorState line="Your sources didn't load." panel="Sources" onRetry={props.onRetry} />;

  return (
    <div data-testid="sources-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: phone ? "flex-end" : "space-between", alignItems: "baseline", gap: 9 }}>
        {/* On a phone the bottom sheet's own title is "Sources". */}
        {phone ? null : <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>Sources</h2>}
        <span style={mono(12)}>{inBuild} in build</span>
      </div>

      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={line}>{SOURCES_COPY.noSessions}</p>
          <Link to={props.connectHref} style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text2, textDecoration: "underline" }}>
            {SOURCES_COPY.connect}
          </Link>
          <p style={{ ...line, marginTop: 4 }}>{SOURCES_COPY.noFiles}</p>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <section aria-label={SOURCES_COPY.inBuild} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <GroupHead name={SOURCES_COPY.inBuild} count={sessions.length} />
          <Capped
            rows={sessions}
            phone={phone}
            render={(session) => <SessionRow key={session.key} session={session} phone={phone} selectedId={props.selectedId} onSelect={props.onSelect} />}
          />
        </section>
      ) : null}

      {files.length > 0 ? (
        <section aria-label={SOURCES_COPY.files} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <GroupHead name={SOURCES_COPY.files} count={files.length} />
          <Capped rows={files} phone={phone} render={(file) => <FileRow key={file.id} file={file} phone={phone} />} />
        </section>
      ) : null}

      {library.length > 0 ? (
        <section aria-label={SOURCES_COPY.notInBuild} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <GroupHead name={SOURCES_COPY.notInBuild} count={library.length} hollow />
          <Capped rows={library} phone={phone} render={(item) => <LibraryRow key={item.id} item={item} phone={phone} onAdd={props.onAddSession} />} />
        </section>
      ) : null}

      <DropZone fine={fine} onDropFiles={props.onDropFiles} onPick={props.onPick} />
    </div>
  );
}

export default SourcesPanel;
