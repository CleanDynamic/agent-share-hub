/* UI-P93 — Sources in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html` draws them.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `SourcesPanel` stays the current look; this takes its props (imported, not copied) and lists
   the same groups in the same order with the same accessible names: Sessions in this build (each a toggle and the
   row itself), Files in this build, Not in a build (each with Add session), then the drop zone.

   THE LOOK. Title 13.5/500 with the in-build count; each group a 6px square (hollow for Not in a build), its label
   12/500 `--text2` and its count; rows separated by `--hairline`. A session row leads with the `chev` glyph and the
   tool's real mark at 20; a file row with the `file` glyph; a waiting session with its mark, its name in `--text2`
   and the boxed 26 plus. The drop zone is 56 high, 1px dashed `--line`, radius 6. A selected row is the selected
   recipe, never a colour. */

import { Plus } from "lucide-react";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ErrorState } from "@/components/brand/ErrorState";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import { ToolMark } from "./refinedPieces";
import { bareButton, ellipsis, text, tnum } from "./refinedStyles";
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

const rowLine: CSSProperties = { borderTop: `1px solid ${t.hairline}` };

/** A selected row: the selected recipe's fill and edge, drawn inside the row so the hairlines do not move. */
const selectedRow = (selected: boolean): CSSProperties =>
  selected ? { background: t.selectedFill, boxShadow: `inset 0 0 0 1px ${t.selectedEdge}`, borderRadius: 6 } : {};

function GroupHead({ name, count, hollow }: { name: string; count: number; hollow?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          boxSizing: "border-box",
          borderRadius: 1,
          background: hollow ? "transparent" : t.text2,
          border: hollow ? `1px solid ${t.text2}` : "none",
          flexShrink: 0,
        }}
      />
      <h3 style={{ ...text(12, 500, t.text2), margin: 0, flexGrow: 1, minWidth: 0 }}>{name}</h3>
      <span style={{ ...text(11.5, 400, t.label), ...tnum }}>{count}</span>
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
        <div style={{ ...rowLine, paddingTop: 8 }}>
          <TextButton onClick={() => setAll(true)} target={phone} style={text(12.5, 500, t.text2)}>
            Show {hidden} more
          </TextButton>
        </div>
      ) : null}
    </>
  );
}

function SelectButton({
  selected,
  onClick,
  minHeight,
  children,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  minHeight: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      {...handlers}
      style={{
        ...bareButton,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexGrow: 1,
        minWidth: 0,
        minHeight,
        boxSizing: "border-box",
        padding: "0 6px",
        borderRadius: 6,
        ...(state.hovered && !selected ? { background: t.controlOn } : null),
        ...selectedRow(selected),
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
  const toggle = useInteractive<HTMLButtonElement>();
  return (
    <div style={{ ...rowLine, padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Open"} session ${session.number}`}
          disabled={!hasPrompts}
          onClick={() => setOpen((value) => !value)}
          {...toggle.handlers}
          style={{
            ...bareButton,
            width: phone ? 44 : 20,
            height: phone ? 44 : 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.label,
            borderRadius: 4,
            cursor: hasPrompts ? "pointer" : "default",
            filter: hasPrompts ? undefined : t.dimFilter,
            flexShrink: 0,
            ...ring(toggle.state.focusVisible),
          }}
        >
          <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : undefined }}>
            <Glyph name="chev" size={16} />
          </span>
        </button>
        <SelectButton selected={selectedId === session.key} onClick={() => onSelect(session.key)} minHeight={phone ? 44 : 40} style={{ alignItems: "flex-start", padding: "6px" }}>
          <ToolMark tool={session.tool} size={20} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text(13, 500, t.text), overflowWrap: "anywhere" }}>
              Session {session.number} · {session.tool}
            </span>
            <span style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{session.detail}</span>
          </span>
        </SelectButton>
      </div>
      {open ? (
        <div style={{ marginLeft: 22, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
          {session.prompts.map((prompt) => (
            <SelectButton key={prompt.id} selected={selectedId === prompt.id} onClick={() => onSelect(prompt.id)} minHeight={phone ? 44 : 30}>
              <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, ...tnum }}>{prompt.number}</span>
              <span style={{ ...text(12.5, prompt.isDefault ? 400 : 500, prompt.isDefault ? t.text2 : t.text), ...ellipsis }}>{prompt.title}</span>
            </SelectButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({ file, phone }: { file: SourceFile; phone: boolean }) {
  return (
    <div style={{ ...rowLine, display: "flex", alignItems: "flex-start", gap: 8, minHeight: phone ? 44 : undefined, padding: "12px 0", boxSizing: "border-box" }}>
      <span style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
        <Glyph name="file" size={16} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ ...text(13, 500, t.text), ...ellipsis }}>{file.name}</span>
        <span style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{file.note}</span>
      </span>
    </div>
  );
}

function LibraryRow({ item, phone, onAdd }: { item: SourceLibraryItem; phone: boolean; onAdd: (id: string) => void }) {
  return (
    <div style={{ ...rowLine, display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : undefined, padding: "8px 0", boxSizing: "border-box" }}>
      <ToolMark tool={item.label} size={20} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        <span style={{ ...text(13, 400, t.text2), ...ellipsis }}>{item.label}</span>
        <span style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{item.line}</span>
      </span>
      <IconButton icon={Plus} glyph="plus" label="Add session" size={26} disabled={item.adding} onClick={() => onAdd(item.id)} />
    </div>
  );
}

function DropZone({ fine, onDropFiles, onPick }: Pick<SourcesPanelProps, "fine" | "onDropFiles" | "onPick">) {
  const [over, setOver] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const base: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    borderRadius: 6,
    border: `1px dashed ${over ? t.text2 : t.line}`,
    background: over ? t.well : "transparent",
    textAlign: "center",
    ...text(12.5, 400, t.text2),
  };
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  if (!fine) {
    return (
      <button type="button" data-testid="sources-drop" onClick={onPick} {...handlers} style={{ ...base, cursor: "pointer", ...ring(state.focusVisible) }}>
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

const group: CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0 };

export function SourcesPanel(props: SourcesPanelProps) {
  const { phone, fine, status, sessions, files, library } = props;
  const inBuild = sessions.length + files.length;
  const empty = sessions.length === 0 && files.length === 0;

  if (status === "loading") {
    return (
      <LoadingRegion what="your sources" announce>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width={120} height={13} />
          <Skeleton height={40} radius={6} />
          <Skeleton height={40} radius={6} />
        </div>
      </LoadingRegion>
    );
  }
  if (status === "error") return <ErrorState line="Your sources didn't load." panel="Sources" onRetry={props.onRetry} />;

  return (
    <div data-testid="sources-panel" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: phone ? "flex-end" : "space-between", alignItems: "baseline", gap: 8 }}>
        {/* On a phone the bottom sheet's own title is "Sources". */}
        {phone ? null : <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>Sources</h2>}
        <span style={{ ...text(11.5, 400, t.label), ...tnum }}>{inBuild} in build</span>
      </div>

      {empty ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ ...text(13, 400, t.text), margin: 0 }}>{SOURCES_COPY.noSessions}</p>
          <Link to={props.connectHref} style={{ ...text(12.5, 500, t.text), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
            {SOURCES_COPY.connect}
          </Link>
          <p style={{ ...text(13, 400, t.text), margin: "6px 0 0" }}>{SOURCES_COPY.noFiles}</p>
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <section aria-label={SOURCES_COPY.inBuild} style={group}>
          <GroupHead name={SOURCES_COPY.inBuild} count={sessions.length} />
          <Capped
            rows={sessions}
            phone={phone}
            render={(session) => <SessionRow key={session.key} session={session} phone={phone} selectedId={props.selectedId} onSelect={props.onSelect} />}
          />
        </section>
      ) : null}

      {files.length > 0 ? (
        <section aria-label={SOURCES_COPY.files} style={group}>
          <GroupHead name={SOURCES_COPY.files} count={files.length} />
          <Capped rows={files} phone={phone} render={(file) => <FileRow key={file.id} file={file} phone={phone} />} />
        </section>
      ) : null}

      {library.length > 0 ? (
        <section aria-label={SOURCES_COPY.notInBuild} style={group}>
          <GroupHead name={SOURCES_COPY.notInBuild} count={library.length} hollow />
          <Capped rows={library} phone={phone} render={(item) => <LibraryRow key={item.id} item={item} phone={phone} onAdd={props.onAddSession} />} />
        </section>
      ) : null}

      <DropZone fine={fine} onDropFiles={props.onDropFiles} onPick={props.onPick} />
    </div>
  );
}

export default SourcesPanel;
