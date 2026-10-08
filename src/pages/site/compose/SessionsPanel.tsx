/* UI-P48 — Your sessions: the sessions this build was made from, and only
   their prompts.

   PURE. Sessions in, intentions out: `ComposePage` loads them, and loads a
   session's prompts once its section is open (`onOpenChange` says which are).

   ONE SECTION PER SESSION, oldest first, numbered as the prompts' source lines
   number them ("Session 1 · Sonnet 5.5"). The head is one button that opens and
   closes the section; it is drawn under the head's text so that "Add model"
   can sit after the label without a button inside a button. The first two
   sections start open, the first one alone on a phone.

   A PROMPT IS ADDED WITH + OR BY DRAGGING IT into Prompts. Dragging is a
   mouse's: on a phone, or on any pointer that is not fine, rows do not drag and
   the + is the way. Once added, the prompt reads in `--text2` with "added" in
   place of the +, and it no longer drags.

   UNDER THE SECTIONS, "+ Add a session" offers the sessions in no build yet (a
   dropdown on desktop, a bottom sheet on the phone, as on Drafts), and the old
   paste screen stays one link away. */

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LABS, MODEL_VERSIONS } from "@/lib/models/registry";
import { MENU_ITEM_CLASS, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { move } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { fieldBase } from "./composeFields";
import { addPromptLabel, MADE_WITH_ENTRY_MAX, promptDragData } from "./composeModel";
import { PROMPT_DRAG_TYPE } from "./PromptsPanel";

/** The desktop header is 64px tall; the panel sticks 24px under it. */
const STICKY_TOP = 64 + 24;

/** The select's value for "Other…". */
const OTHER = "__other__";

export interface ComposeSessionPrompt {
  ordinal: number;
  text: string;
  added: boolean;
}

export interface ComposeSession {
  id: string;
  /** From 1, oldest first. */
  number: number;
  /** The model's name, or the client's label while the model is not known. */
  label: string;
  /** False while the session's model is not known: "Add model" is offered. */
  modelKnown: boolean;
  /** "Today", "Yesterday", "3 Oct". */
  date: string;
  /** Its prompts in order; null while they load. */
  prompts: readonly ComposeSessionPrompt[] | null;
  promptsError: boolean;
}

export interface ComposeOtherSession {
  id: string;
  firstPrompt: string;
  /** "Sonnet 5.5 · Today". */
  meta: string;
}

export interface SessionsPanelProps {
  phone: boolean;
  /** A mouse or trackpad: rows drag. */
  fine: boolean;
  /** Beside the left column, under the header: sticky. */
  sticky: boolean;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  sessions: readonly ComposeSession[];
  /** Which sections are open, whenever that changes. */
  onOpenChange: (ids: readonly string[]) => void;
  onRetryPrompts: (sessionId: string) => void;
  onAdd: (sessionId: string, ordinal: number) => void;
  onSetModel: (sessionId: string, model: string) => void;
  /** The sessions in no build; null while they load. */
  others: readonly ComposeOtherSession[] | null;
  onAttach: (sessionId: string) => void;
}

const floating: CSSProperties = {
  boxSizing: "border-box",
  padding: 9,
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
  zIndex: 50,
};

const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 36,
  padding: "4px 9px",
  borderRadius: 10,
  fontFamily: FIGTREE,
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
};

const textLink: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  color: t.text2,
  textDecoration: "underline",
  background: "transparent",
  border: 0,
  padding: 0,
  borderRadius: 6,
  cursor: "pointer",
};

/* ── Add model ── */

function AddModel({ session, phone, onSetModel }: { session: ComposeSession; phone: boolean; onSetModel: (id: string, model: string) => void }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const otherRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const trigger = useInteractive<HTMLButtonElement>();
  const value = choice === OTHER ? other.trim() : choice;

  useEffect(() => {
    if (choice === OTHER) otherRef.current?.focus();
  }, [choice]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    onSetModel(session.id, value);
    setOpen(false);
    setChoice("");
    setOther("");
  };

  const control: CSSProperties = { ...fieldBase, height: phone ? 44 : 33, padding: "0 7px", fontSize: phone ? 16 : 14 };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        {...trigger.handlers}
        aria-label={`Add model to session ${session.number}`}
        style={{
          ...textLink,
          position: "relative",
          zIndex: 1,
          fontSize: 12,
          whiteSpace: "nowrap",
          flexShrink: 0,
          ...(phone ? { padding: "12px 4px", margin: "-12px -4px", minHeight: 44 } : null),
          ...ring(trigger.state.focusVisible),
        }}
      >
        Add model
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={16} style={{ ...floating, width: 280, maxWidth: "calc(100vw - 32px)" }}>
          <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label htmlFor={`${id}-model`} style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600 }}>
              Which model was session {session.number}?
            </label>
            <select id={`${id}-model`} value={choice} onChange={(event) => setChoice(event.target.value)} style={control}>
              <option value="" disabled>
                Choose a model
              </option>
              {LABS.map((lab) => (
                <optgroup key={lab} label={lab}>
                  {MODEL_VERSIONS.filter((version) => version.lab === lab).map((version) => (
                    <option key={version.id} value={version.name}>
                      {version.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={OTHER}>Other…</option>
            </select>
            {choice === OTHER ? (
              <input
                ref={otherRef}
                type="text"
                aria-label="Model name"
                placeholder="The model's name"
                value={other}
                maxLength={MADE_WITH_ENTRY_MAX}
                autoComplete="off"
                onChange={(event) => setOther(event.target.value)}
                style={control}
              />
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" size={phone ? 44 : 36} fontSize={13} disabled={!value}>
                Save
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ── one session ── */

function PromptItem({
  sessionId,
  prompt,
  phone,
  fine,
  onAdd,
}: {
  sessionId: string;
  prompt: ComposeSessionPrompt;
  phone: boolean;
  fine: boolean;
  onAdd: (sessionId: string, ordinal: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const draggable = fine && !phone && !prompt.added;
  const slot = phone ? 44 : 30;
  return (
    <li
      data-testid="session-prompt"
      data-added={prompt.added ? "true" : undefined}
      draggable={draggable || undefined}
      onDragStart={
        draggable
          ? (event: DragEvent) => {
              event.dataTransfer.setData("text/plain", promptDragData(sessionId, prompt.ordinal));
              event.dataTransfer.setData(PROMPT_DRAG_TYPE, "1");
              event.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      onMouseEnter={() => fine && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 4px 6px 6px",
        borderRadius: 10,
        background: hover ? t.rowHighlight : "transparent",
        cursor: draggable ? "grab" : "default",
      }}
    >
      <span
        style={{
          flexGrow: 1,
          minWidth: 0,
          fontFamily: FIGTREE,
          fontSize: 13,
          lineHeight: 1.45,
          color: prompt.added ? t.text2 : t.text,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {prompt.text}
      </span>
      {prompt.added ? (
        <span style={{ width: slot, flexShrink: 0, textAlign: "center", fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>added</span>
      ) : (
        <IconButton
          icon={Plus}
          size={phone ? 38 : 30}
          style={phone ? { width: 44, height: 44 } : undefined}
          label={addPromptLabel(prompt.text)}
          onClick={() => onAdd(sessionId, prompt.ordinal)}
        />
      )}
    </li>
  );
}

function SessionSection({
  session,
  open,
  first,
  phone,
  fine,
  onToggle,
  onRetryPrompts,
  onAdd,
  onSetModel,
}: {
  session: ComposeSession;
  open: boolean;
  first: boolean;
  phone: boolean;
  fine: boolean;
  onToggle: () => void;
} & Pick<SessionsPanelProps, "onRetryPrompts" | "onAdd" | "onSetModel">) {
  const head = useInteractive<HTMLButtonElement>();
  const listId = useId();
  const quiet: CSSProperties = { position: "relative", pointerEvents: "none" };

  return (
    <section data-testid="compose-session" style={{ borderTop: first ? "none" : `1px solid ${t.hairline}`, padding: "4px 0" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, minHeight: phone ? 44 : 36 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={onToggle}
          {...head.handlers}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            margin: 0,
            padding: 0,
            border: 0,
            borderRadius: 10,
            background: head.state.hovered ? t.rowHighlight : "transparent",
            cursor: "pointer",
            ...ring(head.state.focusVisible),
          }}
        >
          <span style={VISUALLY_HIDDEN}>{`Session ${session.number}: ${session.label}, ${session.date}`}</span>
        </button>
        <span aria-hidden="true" style={{ ...quiet, paddingLeft: 6, fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
          {session.number}
        </span>
        <span
          aria-hidden="true"
          style={{ ...quiet, minWidth: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {session.label}
        </span>
        {session.modelKnown ? null : <AddModel session={session} phone={phone} onSetModel={onSetModel} />}
        <span aria-hidden="true" style={{ ...quiet, fontFamily: FIGTREE, fontSize: 13, color: t.text2, whiteSpace: "nowrap" }}>
          · {session.date}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          strokeWidth={1.6}
          color="var(--text2)"
          style={{ ...quiet, marginLeft: "auto", marginRight: 6, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: move() }}
        />
      </div>

      {open ? (
        <div id={listId} style={{ paddingTop: 2 }}>
          {session.promptsError ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 6px 7px", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
              <span>These prompts didn&apos;t load.</span>
              <button type="button" onClick={() => onRetryPrompts(session.id)} style={{ ...textLink, fontSize: 12 }}>
                Try again
              </button>
            </div>
          ) : session.prompts === null ? (
            <LoadingRegion what={`session ${session.number}'s prompts`} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0 4px" }}>
              <Skeleton height={33} radius={10} />
              <Skeleton height={33} radius={10} />
            </LoadingRegion>
          ) : session.prompts.length === 0 ? (
            <p style={{ margin: 0, padding: "4px 6px 7px", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>No prompts in this session.</p>
          ) : (
            <ul style={{ margin: 0, padding: "0 0 4px", display: "flex", flexDirection: "column", gap: 2 }}>
              {session.prompts.map((prompt) => (
                <PromptItem key={prompt.ordinal} sessionId={session.id} prompt={prompt} phone={phone} fine={fine} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

/* ── + Add a session ── */

function AddSession({ phone, others, onAttach }: Pick<SessionsPanelProps, "phone" | "others" | "onAttach">) {
  const [sheet, setSheet] = useState(false);
  const line: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const meta: CSSProperties = { fontFamily: DM_MONO, fontSize: 11, color: t.text2 };
  const empty = others !== null && others.length === 0;
  const waiting = others === null;

  const trigger = (
    <Button variant="secondary" size={phone ? 44 : 38} fontSize={14} icon={Plus} fullWidth={phone} onClick={phone ? () => setSheet(true) : undefined}>
      Add a session
    </Button>
  );

  if (phone) {
    return (
      <>
        {trigger}
        <BottomSheet open={sheet} onOpenChange={setSheet} title="Add a session">
          {waiting || empty ? (
            <p style={{ margin: 0, padding: "6px 4px", fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
              {waiting ? "Loading your sessions…" : "No other sessions."}
            </p>
          ) : (
            others.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setSheet(false);
                  onAttach(session.id);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  minHeight: 46,
                  width: "100%",
                  padding: "6px 4px",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
              >
                <span style={{ ...line, fontSize: 14, maxWidth: "100%" }}>{session.firstPrompt}</span>
                <span style={meta}>{session.meta}</span>
              </button>
            ))
          )}
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} style={{ ...floating, padding: 4, width: 320, maxHeight: 360, overflowY: "auto" }}>
        {waiting || empty ? (
          <DropdownMenuItem disabled className={MENU_ITEM_CLASS} style={{ ...menuItem, cursor: "default" }}>
            {waiting ? "Loading your sessions…" : "No other sessions."}
          </DropdownMenuItem>
        ) : (
          others.map((session) => (
            <DropdownMenuItem key={session.id} className={MENU_ITEM_CLASS} style={menuItem} onSelect={() => onAttach(session.id)}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, width: "100%" }}>
                <span style={line}>{session.firstPrompt}</span>
                <span style={meta}>{session.meta}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── the panel ── */

export function SessionsPanel({
  phone,
  fine,
  sticky,
  status,
  onRetry,
  sessions,
  onOpenChange,
  onRetryPrompts,
  onAdd,
  onSetModel,
  others,
  onAttach,
}: SessionsPanelProps) {
  const drag = fine && !phone;
  /** Sections the maker opened or closed; the rest keep their default. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const openByDefault = phone ? 1 : 2;
  /**
   * Each section's default, fixed the first time it is drawn. Sessions are
   * numbered oldest first, so adding an older one moves the others down; a
   * section the maker has been reading must not close because of it.
   */
  const defaults = useRef<Record<string, boolean>>({});
  const isOpen = (session: ComposeSession, index: number) =>
    toggled[session.id] ?? defaults.current[session.id] ?? index < openByDefault;
  useEffect(() => {
    sessions.forEach((session, index) => {
      if (!(session.id in defaults.current)) defaults.current[session.id] = index < openByDefault;
    });
  }, [sessions, openByDefault]);

  const openIds = sessions.filter((session, index) => isOpen(session, index)).map((session) => session.id);
  const openKey = openIds.join(",");
  const report = useRef(onOpenChange);
  report.current = onOpenChange;
  useEffect(() => {
    report.current(openKey ? openKey.split(",") : []);
  }, [openKey]);

  const paste = useInteractive<HTMLAnchorElement>();

  return (
    <Panel
      surface="flat"
      padding="16px"
      style={sticky ? { position: "sticky", top: STICKY_TOP, maxHeight: `calc(100dvh - ${STICKY_TOP + 24}px)`, overflow: "hidden auto" } : undefined}
    >
      <div data-testid="compose-sessions">
        <PanelHead
          title={
            <>
              Your sessions
              <span style={{ marginLeft: 6, fontFamily: DM_MONO, fontSize: 12, fontWeight: 400, color: t.text2 }}>{sessions.length}</span>
            </>
          }
          subtitle={drag ? "Drag a prompt into Prompts, or press +." : "Press + to add a prompt to Prompts."}
          headingLevel={2}
        />

        <div style={{ marginTop: 9 }}>
          {status === "loading" ? (
            <LoadingRegion what="your sessions" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton height={phone ? 44 : 36} radius={10} />
              <Skeleton height={phone ? 44 : 36} radius={10} />
            </LoadingRegion>
          ) : status === "error" ? (
            <ErrorState line="Your sessions didn't load." panel="Your sessions" onRetry={onRetry} />
          ) : sessions.length === 0 ? (
            <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>No sessions in this build yet.</p>
          ) : (
            sessions.map((session, index) => (
              <SessionSection
                key={session.id}
                session={session}
                open={isOpen(session, index)}
                first={index === 0}
                phone={phone}
                fine={drag}
                onToggle={() => setToggled((current) => ({ ...current, [session.id]: !isOpen(session, index) }))}
                onRetryPrompts={onRetryPrompts}
                onAdd={onAdd}
                onSetModel={onSetModel}
              />
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: phone ? "stretch" : "flex-start", gap: phone ? 4 : 7, marginTop: 10 }}>
          <AddSession phone={phone} others={others} onAttach={onAttach} />
          <Link
            to="/compose/start"
            {...paste.handlers}
            style={{
              ...textLink,
              fontSize: 12,
              alignSelf: "flex-start",
              ...(phone ? { display: "inline-flex", alignItems: "center", minHeight: 44 } : null),
              ...ring(paste.state.focusVisible),
            }}
          >
            Or paste a transcript
          </Link>
        </div>
      </div>
    </Panel>
  );
}
