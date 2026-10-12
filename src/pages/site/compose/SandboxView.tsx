/* UI-P63 — the new composer: the frame. Sources, Build and Details, the Card,
   and the header that holds Publish.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `SandboxPage` supplies the build and the writes; the dev page supplies
   a fixture. The viewport is read here (768) so both behave alike.

   THE PANELS' INSIDES ARE NOT HERE. Sources, the Build list and Map, and
   Details are slots (`sources`, `list`, `map`, `selection`), each with the
   empty state this prompt draws. UI-P64 to UI-P66 fill them.

   EVERY PANEL IS FLAT. A place you work in is not a thing on display, so
   nothing on this route has `--glass` or a blur. Publish is the page's one
   primary.

   THREE COLUMNS at 1280 and wider (250 · fluid · 290), then 220 · fluid · 260
   to 900, then Sources and Build side by side with Details under them, then on
   a phone one column: the Build panel alone, with Sources and Details behind
   two buttons in its head. In Map, Sources folds to a 56px rail. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, PanelLeft } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Panel } from "@/components/brand/Panel";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { denseHeight } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import { isUntitled, SAVE_WORDS, UNTITLED, type PublishKey, type SaveState } from "./composeModel";
import type { ComposePublished, ComposeStatus } from "./ComposeView";
import { SandboxCard, type CardField, type CardProps } from "./SandboxCard";

export type { CardField } from "./SandboxCard";

/* ── the view's props ── */

export type SandboxLens = "list" | "map";

export interface SandboxMissingItem {
  key: PublishKey;
  /** In plain words: "a cover picture or video". */
  label: string;
}

export interface SandboxCounts {
  sessions: number;
  prompts: number;
  files: number;
}

export interface SandboxViewProps extends CardProps {
  fit?: "board" | "content";
  status: ComposeStatus;
  onRetry: () => void;

  save: SaveState;
  onRetrySave: () => void;
  missing: readonly SandboxMissingItem[];
  slug: string | null;
  published: ComposePublished | null;
  publishing: boolean;
  onPublish: () => void;

  counts: SandboxCounts;
  lens: SandboxLens;
  onLens: (lens: SandboxLens) => void;
  /** CONCEPT §5: two sessions or an agent. Until then the switch is not drawn. */
  mapAvailable: boolean;
  /** "Map is now available", until the maker has switched once. */
  mapHint: boolean;
  onUseResultPicture?: () => void;

  /** Puts the cursor in the Build panel's add field: Add › Prompt, and the "a prompt" missing item. */
  onAddPromptFocus?: () => void;

  /** Add › File: opens the page's file picker. Absent, the item stays disabled. */
  onAddFile?: () => void;
  /** Add › Session: the library's sessions that are in no build. Absent, the item stays disabled. */
  addableSessions?: readonly { id: string; label: string; line: string }[];
  onAddSession?: (id: string) => void;

  /** Add › Tool and Add › Result: make the row and select it in Details. Absent, the item stays disabled. */
  onAddTool?: () => void;
  onAddResult?: () => void;

  /** The panels' insides (UI-P64 to UI-P66). Absent, each draws its empty state. */
  sources?: ReactNode;
  list?: ReactNode;
  map?: ReactNode;
  selection?: ReactNode;
}

/* ── the Add menu ── */

export type AddKey = "prompt" | "session" | "agent" | "file" | "tool" | "manual" | "result";

/**
 * CONCEPT §5's seven, in order, with their one line each. `ready` is false
 * until the prompt that writes that kind has run: the item is listed but
 * disabled. UI-P76 turns the switch on only once they are all true.
 */
export const ADD_ITEMS: readonly { key: AddKey; name: string; line: string; ready: boolean }[] = [
  { key: "prompt", name: "Prompt", line: "A message you sent", ready: true },
  { key: "session", name: "Session", line: "A chat from your sources", ready: true },
  { key: "agent", name: "Agent or team", line: "Prompts that run by themselves", ready: false },
  { key: "file", name: "File", line: "Something the AI read", ready: true },
  { key: "tool", name: "Tool", line: "An app or connector it used", ready: true },
  { key: "manual", name: "Manual step", line: "Work done outside AI", ready: false },
  { key: "result", name: "Result", line: "The finished thing", ready: true },
];

const LIST_HINT = "Click a prompt to see its details · double-click to read all of it";
const DETAILS_EMPTY = "Select a prompt, session or file to see it here.";

/** "3 sessions · 12 prompts · 2 files", leaving out any zero. */
export function countsLine(counts: SandboxCounts): string {
  const parts: string[] = [];
  if (counts.sessions > 0) parts.push(`${counts.sessions} ${counts.sessions === 1 ? "session" : "sessions"}`);
  if (counts.prompts > 0) parts.push(`${counts.prompts} ${counts.prompts === 1 ? "prompt" : "prompts"}`);
  if (counts.files > 0) parts.push(`${counts.files} ${counts.files === 1 ? "file" : "files"}`);
  return parts.join(" · ");
}

type AddMenuProps = Pick<SandboxViewProps, "onAddFile" | "addableSessions" | "onAddSession" | "onAddPromptFocus" | "onAddTool" | "onAddResult">;

const itemStyle = (enabled: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 1,
  minHeight: 44,
  boxSizing: "border-box",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: r.control,
  cursor: enabled ? "pointer" : "default",
  opacity: enabled ? 1 : 0.5,
  outline: "none",
});

const menuSurface: CSSProperties = {
  zIndex: 50,
  width: 280,
  maxWidth: "calc(100vw - 32px)",
  padding: 6,
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
};

function AddLabel({ name, line }: { name: string; line: string }) {
  return (
    <>
      <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, color: t.text }}>{name}</span>
      <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{line}</span>
    </>
  );
}

function AddMenu({ onAddFile, addableSessions, onAddSession, onAddPromptFocus, onAddTool, onAddResult }: AddMenuProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          data-testid="sandbox-add"
          {...handlers}
          style={{
            height: 30,
            padding: "0 10px",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            borderRadius: r.control,
            border: `1px solid ${t.line}`,
            background: t.glass2,
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            ...ring(state.focusVisible),
          }}
        >
          Add
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          style={menuSurface}
        >
          {ADD_ITEMS.map((item) => {
            if (item.key === "session") {
              const enabled = item.ready && Boolean(onAddSession);
              const sessions = addableSessions ?? [];
              return (
                <Menu.Sub key={item.key}>
                  <Menu.SubTrigger disabled={!enabled} style={itemStyle(enabled)}>
                    <AddLabel name={item.name} line={item.line} />
                  </Menu.SubTrigger>
                  <Menu.Portal>
                    <Menu.SubContent sideOffset={6} style={menuSurface}>
                      {sessions.length === 0 ? (
                        <Menu.Item disabled style={itemStyle(false)}>
                          <AddLabel name="No sessions waiting" line="Every session is already in a build" />
                        </Menu.Item>
                      ) : (
                        sessions.slice(0, 6).map((session) => (
                          <Menu.Item key={session.id} onSelect={() => onAddSession?.(session.id)} style={itemStyle(true)}>
                            <AddLabel name={session.label} line={session.line} />
                          </Menu.Item>
                        ))
                      )}
                    </Menu.SubContent>
                  </Menu.Portal>
                </Menu.Sub>
              );
            }
            const handler =
              item.key === "file" ? onAddFile : item.key === "prompt" ? onAddPromptFocus : item.key === "tool" ? onAddTool : item.key === "result" ? onAddResult : undefined;
            const wired = item.key === "file" || item.key === "prompt" || item.key === "tool" || item.key === "result";
            const enabled = item.ready && (!wired || Boolean(handler));
            return (
              <Menu.Item key={item.key} disabled={!enabled} onSelect={handler} style={itemStyle(enabled)}>
                <AddLabel name={item.name} line={item.line} />
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ── pieces ── */

/** A link drawn as a button of the same size and type, for Preview. */
function LinkButton({ to, size, children }: { to: string | null; size: 30 | 42 | 48; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const phone = useIsPhone();
  const common: CSSProperties = {
    height: denseHeight(size, { touch: phone }),
    padding: "0 10px",
    borderRadius: r.control,
    boxSizing: "border-box",
    fontFamily: FIGTREE,
    fontSize: 14,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    border: `1px solid ${t.line}`,
    background: t.glass2,
    color: t.text,
    whiteSpace: "nowrap",
  };
  if (!to) {
    return (
      <span aria-disabled="true" style={{ ...common, opacity: 0.5, cursor: "not-allowed" }}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} {...handlers} style={{ ...common, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>{children}</h2>;
}

const quiet: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13.5, color: t.text2 };

function SourcesFrame({ rail, titled, children }: { rail: boolean; titled: boolean; children: ReactNode }) {
  if (rail) {
    return (
      <Panel surface="flat" padding="16px 0" style={{ display: "flex", justifyContent: "center" }}>
        <PanelLeft size={18} strokeWidth={1.6} color="var(--text2)" aria-label="Sources" role="img" />
      </Panel>
    );
  }
  return (
    <section aria-label="Sources" style={{ minWidth: 0 }}>
      <Panel surface="flat" padding="16px">
        {titled ? <PanelTitle>Sources</PanelTitle> : null}
        <div style={{ marginTop: titled ? 12 : 0, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </Panel>
    </section>
  );
}

function DefaultSources() {
  const label: CSSProperties = { fontFamily: DM_MONO, fontSize: 12, color: t.text2 };
  return (
    <>
      <span style={label}>Sessions in this build</span>
      <span style={label}>Files in this build</span>
      <span style={label}>Not in a build</span>
      <div
        style={{
          borderRadius: r.media,
          border: `1.5px dashed ${t.line}`,
          background: t.recess,
          padding: 16,
          textAlign: "center",
          fontFamily: FIGTREE,
          fontSize: 13.5,
          color: t.text2,
        }}
      >
        Drop sessions or files
      </div>
    </>
  );
}

function Skeletons({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the composer" announce>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? 9 : 12 }}>
        <Skeleton width={phone ? "70%" : 360} height={phone ? 25 : 33} radius={r.chip} />
        <Panel surface="flat" padding="16px">
          <Skeleton width={120} height={16} />
          <Skeleton height={phone ? 180 : 320} radius={r.media} style={{ marginTop: 12 }} />
        </Panel>
      </div>
    </LoadingRegion>
  );
}

function NotFound() {
  return (
    <Panel surface="flat" padding="24px" style={{ maxWidth: 520 }}>
      <h1 style={{ ...display(30), margin: 0, color: t.text }}>No build at this address</h1>
      <p style={{ margin: "7px 0 10px", fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
        Nothing here, or nothing you can open. It may have been deleted, or it may be another creator's build.
      </p>
      <Link to="/compose/new" style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2, textDecoration: "underline" }}>
        Start a new build
      </Link>
    </Panel>
  );
}

/* ── the view ── */

export function SandboxView(props: SandboxViewProps) {
  const phone = useIsPhone();
  const wide = useMinWidth(1280);
  const mid = useMinWidth(900);
  const { status, published, missing, save } = props;

  const [cardOpen, setCardOpen] = useState(false);
  const [cardField, setCardField] = useState<CardField | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const buildRef = useRef<HTMLElement>(null);

  if (status === "loading") return <Skeletons phone={phone} />;
  if (status === "error") {
    return (
      <Panel surface="flat" padding="16px">
        <ErrorState line="This build didn't load." panel="The composer" onRetry={props.onRetry} />
      </Panel>
    );
  }
  if (status === "notFound") return <NotFound />;

  const untitled = isUntitled(props.title);
  const needs = missing.length > 0 && !published;
  // Map is for desktop; a phone is always the list.
  const lens: SandboxLens = phone ? "list" : props.lens;

  const openCard = (field: CardField | null) => {
    setCardField(field);
    setCardOpen(true);
  };

  const onMissing = (key: PublishKey) => {
    if (key === "evidence") return openCard("cover");
    if (key === "title") return openCard("title");
    if (key === "outcome") return openCard("summary");
    props.onAddPromptFocus?.();
    buildRef.current?.focus();
  };

  const statusLine = (
    <p data-testid="sandbox-status" style={{ margin: "4px 0 0", fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
      {published ? "Published" : "Draft"}
      {save !== "idle" ? (
        <>
          {" · "}
          {SAVE_WORDS[save]}
          {save === "error" ? <TextButton onClick={props.onRetrySave}>Try again</TextButton> : null}
        </>
      ) : null}
      {needs ? (
        <>
          {" · Missing: "}
          {missing.map((item, index) => (
            <span key={item.key}>
              {index > 0 ? ", " : null}
              <TextButton underline onClick={() => onMissing(item.key)} target={phone}>
                {item.label}
              </TextButton>
            </span>
          ))}
        </>
      ) : null}
    </p>
  );

  const heading = (
    <h1
      data-testid="sandbox-heading"
      style={{ ...display(phone ? 30 : 34, { mobilePageHeading: phone }), margin: 0, color: untitled ? t.text2 : t.text, overflowWrap: "anywhere" }}
    >
      {untitled ? UNTITLED : props.title.trim()}
    </h1>
  );

  const publishLabel = published ? "Published" : props.publishing ? "Publishing…" : "Publish";
  const publishDisabled = Boolean(published) || props.publishing;
  const publishStyle: CSSProperties | undefined = needs ? { opacity: 0.7 } : undefined;
  const previewTo = props.slug ? `/b2/${props.slug}` : null;

  const lensSwitch = props.mapAvailable && !phone ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      <Segmented
        label="Build view"
        size={32}
        fontSize={12}
        value={props.lens}
        onChange={props.onLens}
        items={[
          { value: "list", label: "List" },
          { value: "map", label: "Map" },
        ]}
      />
      {props.mapHint ? <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>Map is now available</span> : null}
    </div>
  ) : null;

  const banner = published ? (
    <div
      role="status"
      data-testid="sandbox-published"
      style={{ padding: "9px 12px", borderRadius: 12, background: t.evidenceFill, color: t.onEvidenceFill, fontFamily: FIGTREE, fontSize: 13, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 4 }}
    >
      <span>
        Published. {published.inGallery ? "It is in the Gallery now." : `It will show in the Gallery once you ${published.shortfall}.`}
      </span>
      <Link to={`/b2/${published.slug}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>
        See it
      </Link>
    </div>
  ) : null;

  const detailsBody = props.selection ?? <p style={quiet}>{DETAILS_EMPTY}</p>;
  const sourcesBody = props.sources ?? <DefaultSources />;

  const buildPanel = (
    <section ref={buildRef} aria-label="Build" tabIndex={-1} style={{ outline: "none", minWidth: 0 }}>
    <Panel surface="flat" padding="16px">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, minWidth: 0, flexWrap: "wrap" }}>
          <PanelTitle>Build</PanelTitle>
          <span data-testid="sandbox-counts" style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
            {countsLine(props.counts)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {phone ? (
            <>
              <Button variant="secondary" size={30} fontSize={12} onClick={() => setSourcesOpen(true)}>
                Sources
              </Button>
              <Button variant="secondary" size={30} fontSize={12} onClick={() => setDetailsOpen(true)}>
                Details
              </Button>
            </>
          ) : null}
          <AddMenu onAddFile={props.onAddFile} addableSessions={props.addableSessions} onAddSession={props.onAddSession} onAddPromptFocus={props.onAddPromptFocus} onAddTool={props.onAddTool} onAddResult={props.onAddResult} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {lens === "map" ? (
          (props.map ?? null)
        ) : (
          (props.list ?? <p style={quiet}>{LIST_HINT}</p>)
        )}
      </div>
    </Panel>
    </section>
  );

  const card = (
    <SandboxCard
      {...props}
      phone={phone}
      open={cardOpen}
      onOpenChange={setCardOpen}
      field={cardField}
    />
  );

  if (phone) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div>
          {heading}
          {statusLine}
        </div>
        {banner}
        {buildPanel}
        <div
          role="group"
          aria-label="Actions"
          style={{
            position: "sticky",
            bottom: "calc(92px + env(safe-area-inset-bottom))",
            zIndex: 5,
            display: "flex",
            gap: 6,
            padding: 7,
            borderRadius: 16,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowCard,
            boxSizing: "border-box",
          }}
        >
          <Button variant="ghost" size={48} fontSize={14} onClick={() => openCard(null)}>
            Card
          </Button>
          <LinkButton to={previewTo} size={48}>
            Preview
          </LinkButton>
          <div style={{ flexGrow: 1 }}>
            <Button size={48} fontSize={15} fullWidth disabled={publishDisabled} onClick={props.onPublish} style={publishStyle}>
              {publishLabel}
            </Button>
          </div>
        </div>
        <BottomSheet open={sourcesOpen} onOpenChange={setSourcesOpen} title="Sources">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{sourcesBody}</div>
        </BottomSheet>
        <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Details">
          {detailsBody}
        </BottomSheet>
        {card}
      </div>
    );
  }

  const rail = lens === "map";
  const columns = !mid
    ? "220px minmax(0, 1fr)"
    : wide
      ? `${rail ? "56px" : "250px"} minmax(0, 1fr) 290px`
      : `${rail ? "56px" : "220px"} minmax(0, 1fr) 260px`;

  const detailsPanel = (
    <section aria-label="Details" style={{ minWidth: 0, ...(!mid ? { gridColumn: "1 / -1" } : null) }}>
      <Panel surface="flat" padding="16px">
        <PanelTitle>Details</PanelTitle>
        <div style={{ marginTop: 12 }}>{detailsBody}</div>
      </Panel>
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {heading}
          {statusLine}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, flexShrink: 0 }}>
          {lensSwitch}
          <Button variant="secondary" size={42} fontSize={14} onClick={() => openCard(null)}>
            Card
          </Button>
          <LinkButton to={previewTo} size={42}>
            Preview
          </LinkButton>
          <Button size={42} fontSize={14} disabled={publishDisabled} onClick={props.onPublish} style={publishStyle}>
            {publishLabel}
          </Button>
        </div>
      </div>
      {banner}
      <div style={{ display: "grid", gridTemplateColumns: columns, gap: 16, alignItems: "start" }}>
        <SourcesFrame rail={rail} titled={!props.sources}>{sourcesBody}</SourcesFrame>
        {buildPanel}
        {detailsPanel}
      </div>
      {card}
    </div>
  );
}

export default SandboxView;
