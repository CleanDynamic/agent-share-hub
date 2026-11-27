/* Prompt 23: the build editor on a phone (below 768). One screen, the build list:

   THE TOP BAR is the shell's (back "Back to Drafts", the logo, More); this registers More's rows, in this order: Undo, Redo, Find,
   Preview, Colours, Recently removed, Mark still open, Clear the build. Find turns the bar into its field (`PhoneFindBar`).
   THE TITLE ROW, padding 0 16 4: the title as an editable line in Geist Serif 24/30, then "Draft · saved just now · 2 sessions / 4
   prompts / 1 file" 13 Text 3 after the save square. THE VIEW PILLS: List, Map, Sources (Sources opens its sheet and is never
   the chosen pill). THE HINT, 13 Text 3, padding 0 16 8. THE LIST (or the read-only Map). THE ROUND ADD BUTTON, 72 above the
   inset (over the footer). THE STICKY FOOTER on Panel, padding 12 16 plus the inset: the ready line at the left and Publish.

   Choosing (a long press on a tile) swaps the footer for the choosing bar. A tap on a tile opens its sheet (Details); a swipe
   to the left shows Duplicate and Remove behind it. Publish asks in an action sheet; while anything required is open, it opens
   the ready-to-publish sheet first, as the checklist does on a computer. Nothing here writes on its own: every action is the
   page's, the same handler the computer's control calls. */

import { ATTACHMENT_COPY, type Attachment } from "@/lib/build/attachments";
import { ReaderAttachmentStrip } from "@/components/build/AttachmentStrip";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { ActionSheet } from "@/components/phone/ActionSheet";
import { BigButton } from "@/components/phone/BigButton";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PhonePills } from "@/components/phone/PhonePills";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { HISTORY_COPY } from "@/lib/build/buildHistory";
import { SELECTION_COPY } from "@/lib/build/buildSelection";
import { CLEAR_COPY } from "@/lib/build/componentMenus";
import { readyLine, type ChecklistItem } from "@/lib/build/publishChecklist";
import { useRegisterPageBar, type MoreItem } from "@/components/shell/phoneBarRegistry";
import { focusBuild } from "../SkipToBuild";
import { ring } from "@/lib/theme/controls";
import { BASE, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, SENTIENT, textStep } from "@/lib/theme/type";

import { ClickToEdit } from "../DetailsOverlay";
import { NO_DRAG } from "../listNest";
import { PUBLISHED_COPY } from "../PublishedMenu";
import { SaveLine } from "../SaveLine";
import { STILL_OPEN_TILE_COPY } from "../StillOpenTile";
import { OpenRequestWindow } from "../composerWindows";
import { OPEN_REQUEST_COPY } from "../openRequestCopy";
import { isUntitled, UNTITLED, type SaveState } from "../composeModel";
import type { BuildFind } from "../useBuildFind";
import { useBuildActionsContext } from "../useBuildActions";
import { useBuildHistoryContext } from "../useBuildHistory";
import { useBuildSelectionContext } from "../useBuildSelection";

import { PhoneFindBar } from "./PhoneFindBar";
import { PhoneMap } from "./PhoneMap";
import { PhoneSources, type PhoneSourcesModel } from "./PhoneSources";
import { usePhoneSwipe } from "./usePhoneSwipe";
import { KIND_ICON, notReadyRows, phoneCountsLine, PHONE_EDITOR_COPY, type PhoneMapModel } from "./phoneEditorModel";
import type { StepKind } from "@/lib/build/graph";

/** The footer (29f): 50 of content, with the 44 Publish centred in it, plus the inset (84 on the boards, where the inset is 34). */
export const PHONE_EDITOR_FOOTER = 50;
const FOOTER_BOTTOM = `calc(${PHONE_EDITOR_FOOTER}px + env(safe-area-inset-bottom))`;

/** What only the phone needs from the page, beyond the view's own props. The page builds it on a phone and nowhere else. */
export interface PhoneEditorExtras {
  /** Choose a step, open its session and bring it into view (the ready sheet's rows and the map's nodes). */
  onOpenStep: (id: string) => void;
  /** A step's number, for the number boxes. */
  numberOf: (id: string) => string | null;
  /** A step's kind and title, for the ready sheet. */
  stepOf: (id: string) => { kind: StepKind; title: string } | null;
  map: PhoneMapModel;
  sources: PhoneSourcesModel;
  /** Where the chosen tiles can go. */
  moveTo: readonly { key: string; label: string }[];
  onMoveTiles: (ids: readonly string[], key: string) => void;
  /** The reference bridge is there: Group and Colour can make a group. */
  canGroup: boolean;
  onColours: () => void;
  /** Mark still open, for the chosen step; null with none chosen. */
  stillOpen: { title: string; current: string | undefined; onSubmit: (problem: string | null) => void } | null;
}

export interface PhoneEditorProps {
  title: string;
  onTitle: (title: string) => void;
  save: SaveState;
  lastSavedAt?: Date | null;
  pendingWrites?: number;
  saveDetail?: string;
  onRetrySave: () => void;
  threadNote?: string | null;
  counts: { sessions: number; prompts: number; files: number };
  published: boolean;
  publishedSlug: string | null;
  publishedWords: string;
  publishing: boolean;
  checklist: import("@/lib/build/publishChecklist").Checklist | null;
  /** The pictures attached to prompts, to check they show nothing private before publishing. */
  pictures?: readonly Attachment[];
  /** Runs before anything opens; false stops it (offline). */
  prepare?: () => Promise<boolean>;
  onPublish: () => void;
  /** What a non-step checklist row does (the computer's checklist links). */
  onChecklistAction: (item: ChecklistItem) => void;
  previewTo: string | null;
  publishedOptions: ReactNode;
  find?: BuildFind;
  hint: string | null;
  banner: ReactNode;
  strips: ReactNode;
  list: ReactNode;
  emptyBuild: ReactNode | null;
  post: ReactNode;
  sessionList: ReactNode;
  /** 29f: the View sheet (Session list, part labels, Collapse all), drawn closed until the bar's More sheet has its "View" row
      chosen. The page hands the sheet a way to be held open from here. Absent: there is no View row. */
  viewSheet?: (sheet: { open: boolean; onOpenChange: (open: boolean) => void }) => ReactNode;
  detailsBody: ReactNode;
  onEditSelected?: () => void;
  selectedKey: string | null;
  addMenu: ReactNode;
  card: ReactNode;
  /** Opens the Card (title, description, Classification), as the computer's Classification button does. */
  onCard: () => void;
  extras: PhoneEditorExtras | undefined;
}

const SHEET_ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 52,
  padding: `8px ${PHONE_MARGIN}px`,
  display: "flex",
  alignItems: "center",
  gap: 12,
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  textAlign: "left",
  cursor: "pointer",
};

function SheetButton({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-testid={testId} onClick={onClick} {...handlers} style={{ ...SHEET_ROW, ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

/** The number box: mono 13 on Raised, 24 tall, radius 6. */
export function PhoneNumberBox({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" style={{ boxSizing: "border-box", minWidth: 24, height: 24, padding: "0 6px", borderRadius: 6, background: t.control, color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: DM_MONO, fontSize: 13, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </span>
  );
}

/* ── the title row ── */

function TitleRow({ title, onTitle, meta }: { title: string; onTitle: (title: string) => void; meta: ReactNode }) {
  const untitled = isUntitled(title);
  const [draft, setDraft] = useState(untitled ? "" : title.trim());
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(isUntitled(title) ? "" : title.trim());
  }, [title]);
  const { state, handlers } = useInteractive<HTMLInputElement>();
  const commit = () => {
    editing.current = false;
    const next = draft.trim();
    if (next !== (untitled ? "" : title.trim())) onTitle(next);
  };
  return (
    <div data-testid="phone-title-row" style={{ padding: `0 ${PHONE_MARGIN}px 4px`, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {/* The page's heading, for the arrival focus and screen readers; the field below is what is seen. */}
      <h1 data-testid="sandbox-heading" className="sr-only">
        {untitled ? UNTITLED : title.trim()}
      </h1>
      <input
        aria-label="Title"
        data-testid="phone-title"
        /* The global field rule's opt-out: the title sits on the page, with no field edge or well. */
        data-notepad-field=""
        value={draft}
        placeholder={UNTITLED}
        enterKeyHint="done"
        onFocus={(event) => {
          editing.current = true;
          handlers.onFocus?.(event);
        }}
        onBlur={(event) => {
          commit();
          handlers.onBlur?.(event);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(untitled ? "" : title.trim());
            editing.current = false;
            event.currentTarget.blur();
          }
        }}
        style={{
          boxSizing: "border-box",
          width: "100%",
          minHeight: 44,
          margin: 0,
          padding: 0,
          border: 0,
          borderRadius: 6,
          background: "transparent",
          color: t.text,
          fontFamily: SENTIENT,
          fontSize: 24,
          lineHeight: "30px",
          fontWeight: 400,
          outline: "none",
          ...ring(state.focusVisible),
        }}
      />
      {meta}
    </div>
  );
}

/* ── the footer and the choosing bar ── */

const FOOTER: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
  boxSizing: "border-box",
  minHeight: `calc(${PHONE_EDITOR_FOOTER}px + env(safe-area-inset-bottom))`,
  padding: `0 ${PHONE_MARGIN}px env(safe-area-inset-bottom)`,
  display: "flex",
  alignItems: "center",
  gap: 12,
  /* The Page shade, with the dock's own structural line along its top: the footer stands where the dock would. */
  background: t.bg,
  boxShadow: `inset 0 1px 0 ${t.control}`,
};

function ChooseButton({ icon, label, onClick, danger = false, disabled = false, testId }: { icon: MobileIconName; label: string; onClick: () => void; danger?: boolean; disabled?: boolean; testId: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      style={{
        boxSizing: "border-box",
        width: 52,
        height: 52,
        flexShrink: 0,
        padding: 0,
        border: 0,
        borderRadius: 12,
        background: "transparent",
        color: danger ? t.dangerText : t.text,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        fontFamily: FIGTREE,
        fontSize: 11,
        lineHeight: "14px",
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        ...(disabled ? { color: t.label } : null),
        ...ring(state.focusVisible),
      }}
    >
      <MobileIcon name={icon} size={20} />
      {label}
    </button>
  );
}

/* ── the editor ── */

type PhoneLens = "list" | "map";

export function PhoneEditor(props: PhoneEditorProps) {
  const { extras, find } = props;
  const history = useBuildHistoryContext();
  const actions = useBuildActionsContext();
  const selection = useBuildSelectionContext();
  const [lens, setLens] = useState<PhoneLens>("list");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [stillOpenAsking, setStillOpenAsking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const choosing = Boolean(selection && (selection.choosing || selection.size > 0));
  /** The choosing bar has room for the close icon before its count. */
  const roomy = useMinWidth(380);
  const chosenTiles = selection ? [...selection.tiles] : [];

  /* Swipe a tile to the left: Duplicate and Remove behind it. */
  const swipe = usePhoneSwipe(listRef, {
    enabled: lens === "list" && !choosing,
    onDuplicate: (id) => actions?.duplicate([id]),
    onRemove: (id) => actions?.removeTile(id),
  });

  /* A tap on a tile (not on a control inside it, not while choosing, not the end of a swipe) opens its sheet. The tile is the
     control (its own role, name and keys); this only listens for what its click already did, after it. */
  const tapState = useRef({ choosing, consumed: swipe.consumed });
  tapState.current = { choosing, consumed: swipe.consumed };
  useEffect(() => {
    const host = listRef.current;
    if (!host) return;
    const onClick = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const tile = event.target.closest<HTMLElement>("[data-node-id]");
      if (!tile || !host.contains(tile)) return;
      const control = event.target.closest(NO_DRAG);
      if (control && control !== tile && tile.contains(control)) return;
      if (tapState.current.choosing || tapState.current.consumed()) return;
      window.setTimeout(() => setDetailsOpen(true), 0);
    };
    host.addEventListener("click", onClick);
    return () => host.removeEventListener("click", onClick);
  }, [lens]);

  /* Publish: the checklist's gate first, then the action sheet. */
  const pressPublish = async () => {
    if (props.prepare && !(await props.prepare())) return;
    if (props.checklist?.needed) setReadyOpen(true);
    else setAsking(true);
  };

  const openStep = (id: string) => {
    extras?.onOpenStep(id);
    window.setTimeout(() => setDetailsOpen(true), 0);
  };

  /* More: the editor's own rows, in its order, with no Copy link or Share. */
  const counts = actions?.clear.counts;
  const empty = !counts || counts.sessions + counts.tiles + counts.files + counts.parts === 0;
  const more: MoreItem[] = [
    { icon: "undo", label: history?.canUndo ? HISTORY_COPY.undoStep(history.undoSentence ?? "") : HISTORY_COPY.nothingToUndo, disabled: !history?.canUndo, onSelect: () => void history?.undo() },
    { icon: "redo", label: history?.canRedo ? HISTORY_COPY.redoStep(history.redoSentence ?? "") : HISTORY_COPY.nothingToRedo, disabled: !history?.canRedo, onSelect: () => void history?.redo() },
    ...(props.viewSheet ? [{ icon: "listv" as const, label: "View", onSelect: () => setViewOpen(true) }] : []),
    { icon: "search", label: PHONE_EDITOR_COPY.find, disabled: !find || lens !== "list", onSelect: () => find?.show() },
    { icon: "preview", label: PHONE_EDITOR_COPY.preview, disabled: !props.previewTo, onSelect: () => setPreviewOpen(true) },
    ...(extras ? [{ icon: "colour" as const, label: "Colours", onSelect: extras.onColours }] : []),
    ...(actions?.recentlyRemoved ? [{ icon: "restore" as const, label: actions.recentlyRemoved.count > 0 ? `${CLEAR_COPY.recentlyRemoved} (${actions.recentlyRemoved.count})` : CLEAR_COPY.recentlyRemoved, onSelect: actions.recentlyRemoved.open }] : []),
    ...(extras ? [{ icon: "flag" as const, label: STILL_OPEN_TILE_COPY.mark, disabled: !extras.stillOpen, onSelect: () => setStillOpenAsking(true) }] : []),
    { icon: "open", label: "Classification", onSelect: props.onCard },
    ...(actions ? [{ icon: "trash" as const, label: CLEAR_COPY.menu, tone: "danger" as const, disabled: empty, onSelect: actions.clear.ask }] : []),
  ];
  /* 29f: the bar reads Back, the beaver, More and "Skip to build" (a text button at the right, in place of the old outlined chip). */
  useRegisterPageBar({ more, bare: true, skip: () => void focusBuild(), skipLabel: "Skip to build" });

  const ready = props.checklist && !props.published ? readyLine(props.checklist) : null;
  const meta = (
    <p data-testid="sandbox-status" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, overflowWrap: "anywhere" }}>
      <SaveSquareInline save={props.save} />
      {props.published ? props.publishedWords : "Draft"}
      <SaveLine save={props.save} lastSavedAt={props.lastSavedAt} pending={props.pendingWrites} detail={props.saveDetail} onRetry={props.onRetrySave} retryUnderline />
      {props.threadNote ? ` · ${props.threadNote}` : null}
      {phoneCountsLine(props.counts) ? <span data-testid="sandbox-counts">{` · ${phoneCountsLine(props.counts)}`}</span> : null}
    </p>
  );

  const pills = (
    <PhonePills<"list" | "map" | "sources">
      label={PHONE_EDITOR_COPY.views}
      value={lens}
      onChange={(value) => {
        if (value === "sources") setSourcesOpen(true);
        else setLens(value);
      }}
      pills={[
        { value: "list", label: PHONE_EDITOR_COPY.list, icon: "listv" },
        { value: "map", label: PHONE_EDITOR_COPY.map, icon: "mapv" },
        { value: "sources", label: PHONE_EDITOR_COPY.sources, icon: "sources" },
      ]}
    />
  );

  const footer = choosing && selection ? (
    <div role="toolbar" aria-label="Selection" data-testid="phone-choose-bar" style={{ ...FOOTER, gap: 0, paddingLeft: 4, paddingRight: 8 }}>
      <ClearButton count={PHONE_EDITOR_COPY.chosen(selection.size)} roomy={roomy} onClick={selection.clear} />
      <ChooseButton testId="choose-move" icon="move" label={PHONE_EDITOR_COPY.move} disabled={chosenTiles.length === 0 || !extras || extras.moveTo.length === 0} onClick={() => setMoveOpen(true)} />
      <ChooseButton testId="choose-group" icon="group" label={PHONE_EDITOR_COPY.group} disabled={!extras?.canGroup || chosenTiles.length < 2} onClick={() => actions?.group(chosenTiles)} />
      <ChooseButton testId="choose-colour" icon="colour" label={PHONE_EDITOR_COPY.colour} disabled={!extras?.canGroup || chosenTiles.length < 1} onClick={() => actions?.group(chosenTiles)} />
      <ChooseButton testId="choose-duplicate" icon="copy" label={PHONE_EDITOR_COPY.duplicate} disabled={chosenTiles.length === 0} onClick={() => actions?.duplicate(chosenTiles)} />
      <ChooseButton testId="choose-remove" icon="trash" label={PHONE_EDITOR_COPY.remove} danger onClick={() => actions?.removeSelection(selection.items)} />
    </div>
  ) : (
    <div role="group" aria-label="Actions" data-testid="phone-editor-footer" style={FOOTER}>
      {props.published ? (
        <>
          <span style={{ flexGrow: 1 }} />
          {props.publishedSlug ? (
            <Link to={`/b2/${props.publishedSlug}`} style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text, minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 12px" }}>
              {PUBLISHED_COPY.viewLive}
            </Link>
          ) : null}
          {props.publishedOptions}
        </>
      ) : (
        <>
          <ReadyButton words={ready} onClick={() => setReadyOpen(true)} />
          <BigButton main disabled={props.publishing} onClick={() => void pressPublish()} style={{ flexShrink: 0, gap: 8, height: 44, borderRadius: 22, fontSize: 16, fontWeight: 650 }}>
            <MobileIcon name="publish" size={18} />
            {props.publishing ? "Publishing…" : "Publish"}
          </BigButton>
        </>
      )}
    </div>
  );

  const rows = props.checklist && extras ? notReadyRows(props.checklist, extras.numberOf) : [];

  return (
    <div data-testid="phone-editor" style={{ display: "flex", flexDirection: "column", minWidth: 0, margin: `0 -${PHONE_MARGIN}px`, paddingBottom: `calc(${PHONE_EDITOR_FOOTER + 56 + 32}px + env(safe-area-inset-bottom))` }}>
      {find?.open ? <PhoneFindBar find={find} /> : null}
      <TitleRow title={props.title} onTitle={props.onTitle} meta={meta} />
      {/* The build's head on a phone: the views. The page's tests read it as the sign the editor has loaded. */}
      <div data-testid="sandbox-build-head-row" style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>{pills}</div>
      </div>
      {props.banner ? <div style={{ padding: `0 ${PHONE_MARGIN}px 8px` }}>{props.banner}</div> : null}
      {props.strips ? <div style={{ padding: `0 ${PHONE_MARGIN}px 8px` }}>{props.strips}</div> : null}
      {lens === "list" ? (
        <>
          {props.hint ? <p style={{ margin: 0, padding: `0 ${PHONE_MARGIN}px 8px`, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{props.hint}</p> : null}
          {props.sessionList}
          <section id="build" aria-label="Build" tabIndex={-1} style={{ outline: "none", minWidth: 0 }}>
            <div ref={listRef} data-phone-list="" data-grip-drag="" style={{ minWidth: 0, position: "relative", touchAction: "pan-y", padding: `0 ${PHONE_MARGIN}px` }}>
              {props.emptyBuild ?? props.list}
              {swipe.tray}
            </div>
          </section>
          {props.post ? <div style={{ padding: `16px ${PHONE_MARGIN}px 0` }}>{props.post}</div> : null}
        </>
      ) : extras ? (
        <PhoneMap model={extras.map} selectedId={props.selectedKey} onOpen={openStep} />
      ) : null}
      {props.addMenu}
      {footer}

      {props.viewSheet ? props.viewSheet({ open: viewOpen, onOpenChange: setViewOpen }) : null}
      <PhoneSources open={sourcesOpen} onOpenChange={setSourcesOpen} model={extras?.sources ?? null} />

      <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Details">
        <ClickToEdit onEdit={props.onEditSelected ? () => { setDetailsOpen(false); props.onEditSelected?.(); } : undefined} phone>
          {/* The 16 side margin of a phone; prompt 24 draws the step's sheet itself. */}
          <div style={{ padding: `0 ${PHONE_MARGIN}px ${PHONE_MARGIN}px`, minWidth: 0 }}>{props.detailsBody}</div>
        </ClickToEdit>
      </BottomSheet>

      <PhoneBottomSheet open={readyOpen} onOpenChange={setReadyOpen} title={ready ?? "Publish checklist"} data-testid="ready-sheet">
        <div role="list" style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
          {rows.map((row) => {
            const step = row.item.stepId ? extras?.stepOf(row.item.stepId) : null;
            return (
              <div role="listitem" key={row.key}>
                <SheetButton
                  testId="ready-row"
                  onClick={() => {
                    setReadyOpen(false);
                    const id = row.item.stepId;
                    if (id && step) openStep(id);
                    else props.onChecklistAction(row.item);
                  }}
                >
                  {row.number ? <PhoneNumberBox>{row.number}</PhoneNumberBox> : step ? <MobileIcon name={KIND_ICON[step.kind]} size={20} /> : null}
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flexGrow: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, lineHeight: "20px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step?.title ?? row.title}</span>
                    <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{step ? [row.title, row.needs].filter(Boolean).join(". ") : row.needs ?? ""}</span>
                  </span>
                </SheetButton>
              </div>
            );
          })}
        </div>
        {props.pictures?.length ? (
          <section aria-label={ATTACHMENT_COPY.privatePictures} data-testid="checklist-section-pictures" style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: textStep.meta, fontWeight: 400, lineHeight: "16px", color: t.label }}>{ATTACHMENT_COPY.privatePictures}</h3>
            <ReaderAttachmentStrip attachments={props.pictures} phone />
          </section>
        ) : null}
      </PhoneBottomSheet>

      <PhoneBottomSheet open={moveOpen} onOpenChange={setMoveOpen} title={PHONE_EDITOR_COPY.moveTo} data-testid="move-sheet">
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
          {(extras?.moveTo ?? []).map((target) => (
            <SheetButton
              key={target.key}
              onClick={() => {
                setMoveOpen(false);
                extras?.onMoveTiles(chosenTiles, target.key);
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 500, lineHeight: "20px" }}>{target.label}</span>
            </SheetButton>
          ))}
        </div>
      </PhoneBottomSheet>

      <ActionSheet
        open={asking}
        onOpenChange={setAsking}
        title={PHONE_EDITOR_COPY.publishAsk(isUntitled(props.title) ? UNTITLED : props.title.trim())}
        explanation={PHONE_EDITOR_COPY.publishLine}
        action={{ label: "Publish", onSelect: () => props.onPublish() }}
      />

      {previewOpen && props.previewTo ? (
        <PreviewScreen
          to={props.previewTo}
          onClose={() => setPreviewOpen(false)}
          onPublish={() => {
            setPreviewOpen(false);
            void pressPublish();
          }}
          published={props.published}
        />
      ) : null}

      {extras?.stillOpen ? (
        <OpenRequestWindow
          open={stillOpenAsking}
          title={OPEN_REQUEST_COPY.titleTile(extras.stillOpen.title)}
          initial={extras.stillOpen.current}
          onClose={() => setStillOpenAsking(false)}
          onSubmit={(problem) => {
            setStillOpenAsking(false);
            extras.stillOpen?.onSubmit(problem);
          }}
        />
      ) : null}
      {props.card}
    </div>
  );
}

/**
 * The count, "2 chosen" 15/600, which is also what ends choosing: a tap on it clears the choice. The close icon stands before it
 * where the bar has room (from 380 wide); the count is said politely as it changes.
 */
function ClearButton({ count, roomy, onClick }: { count: string; roomy: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <>
      <button
        type="button"
        aria-label={SELECTION_COPY.clear}
        onClick={onClick}
        {...handlers}
        style={{ flex: "1 1 auto", minWidth: 0, minHeight: 44, padding: "0 4px 0 8px", border: 0, borderRadius: 22, background: "transparent", color: t.text, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", whiteSpace: "nowrap", ...ring(state.focusVisible) }}
      >
        {roomy ? (
          <span aria-hidden="true" style={{ display: "inline-flex", color: t.text2 }}>
            <MobileIcon name="close" size={16} />
          </span>
        ) : null}
        <span data-testid="selection-count" aria-hidden="true" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {count}
        </span>
      </button>
      <span role="status" className="sr-only">
        {count}
      </span>
    </>
  );
}

function ReadyButton({ words, onClick }: { words: string | null; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (!words) return <span style={{ flexGrow: 1 }} />;
  return (
    <button
      type="button"
      data-testid="sandbox-ready"
      aria-haspopup="dialog"
      onClick={onClick}
      {...handlers}
      style={{ flexGrow: 1, minWidth: 0, minHeight: 44, padding: 0, border: 0, background: "transparent", textAlign: "left", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.text2, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {words}
    </button>
  );
}

function SaveSquareInline({ save }: { save: SaveState }) {
  const colour = save === "error" ? t.dangerText : save === "saved" ? t.brandAccent : t.label;
  return <span aria-hidden="true" data-testid="save-square" data-state={save} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: colour, marginRight: 8, verticalAlign: "middle", position: "relative", top: -1 }} />;
}

/** Preview, full screen: the build page as a reader sees it, a close button at the top left and Publish in a sticky footer. */
function PreviewScreen({ to, onClose, onPublish, published }: { to: string; onClose: () => void; onPublish: () => void; published: boolean }) {
  const close = useRef<HTMLButtonElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  /* A pushed page: it enters from the right in BASE; with reduced motion it fades in over the same time. Transform and opacity only. */
  useEffect(() => {
    const reduced = prefersReducedMotion();
    screenRef.current?.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: BASE, easing: STANDARD });
  }, []);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  /* A portal, over the top bar: the page's main column is a stacking context of its own. */
  return createPortal(
    <div ref={screenRef} role="dialog" aria-modal="true" aria-label={PHONE_EDITOR_COPY.preview} data-testid="phone-preview" style={{ position: "fixed", inset: 0, zIndex: 60, background: t.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ boxSizing: "border-box", height: "calc(52px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)", paddingInline: 4, display: "flex", alignItems: "center", background: t.bg }}>
        <button ref={close} type="button" aria-label={PHONE_EDITOR_COPY.closePreview} onClick={onClose} style={{ width: 44, height: 44, border: 0, borderRadius: 22, background: "transparent", color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <MobileIcon name="close" size={24} />
        </button>
      </div>
      <iframe title={PHONE_EDITOR_COPY.preview} src={to} style={{ flexGrow: 1, width: "100%", border: 0, background: t.bg }} />
      {published ? null : (
        <div style={{ ...FOOTER, position: "static", justifyContent: "flex-end" }}>
          <BigButton main onClick={onPublish} style={{ gap: 8 }}>
            <MobileIcon name="publish" size={18} />
            Publish
          </BigButton>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default PhoneEditor;
