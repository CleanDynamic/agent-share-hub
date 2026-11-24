/* Prompt 21: the Filters dialog and the saved filter sets on a phone, as sheets from the bottom. The behaviour is the dialog's: the
   choices are a draft, Done applies it once, and closing drops it. What changes is the shape. A full sheet holds the "Find a filter"
   field and "Order values", then the groups (Classification, Proof, Structure, OpenBuilds) with each filter a 52-tall row; a row opens
   in place into its choices or its two fields. The saved sets are a content sheet of their own, reached from the footer. Pure. */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { ActionSheet } from "@/components/phone/ActionSheet";
import { BigButton } from "@/components/phone/BigButton";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PhoneField } from "@/components/phone/PhoneField";
import { PhonePills } from "@/components/phone/PhonePills";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { SAVE_FAILED } from "@/lib/copy/copy";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { PhoneCheckRow, PhoneGroupLabel, phoneText } from "./BuildsPhone";
import { SET_NAME_MAX } from "./SetDialogs";
import { FILTER_GROUPS, type BuildsFiltersViewProps, type FilterSection, type OpenSetView, type RangeSection, type SavedSetRow, type SavedSetsProps, type ScaleSection, type WordSection } from "./BuildsFiltersView";

const clampTo = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** A footer button that is words only: no fill. */
function Ghost({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...handlers} style={{ minHeight: 48, padding: "0 12px", border: 0, background: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.48 : 1, ...phoneText(15, 600, t.text2), ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

/** The footer's buttons are 48 tall with a little less padding than the big button's, so three fit a 360 screen. */
const FOOT_BUTTON = { padding: "0 14px" } as const;

/* ── a filter's choices ── */

/** One end of a range, typed. It holds its own text while focused and commits on Enter and on leaving; empty is no limit. */
function RangeInput({ label, value, min, max, onCommit }: { label: string; value: string; min: number; max: number; onCommit: (typed: number | null) => void }) {
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    if (typing === null) return;
    const parsed = Number.parseInt(typing.trim(), 10);
    setTyping(null);
    onCommit(typing.trim() === "" || Number.isNaN(parsed) ? null : parsed);
  };
  return (
    <div onFocus={() => setTyping((current) => current ?? value)} onBlur={commit} style={{ flex: 1, minWidth: 0 }}>
      <PhoneField
        label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={typing ?? value}
        onChange={(event) => setTyping(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}

function RangeChoices({ section, onChange }: { section: RangeSection; onChange?: (value: readonly [number, number]) => void }) {
  const [low, high] = section.value;
  return (
    <div role="group" aria-label={`${section.name}, ${section.valueText}`} style={{ display: "flex", gap: 12, padding: `4px ${PHONE_MARGIN}px 12px` }}>
      <RangeInput label="At least" value={low === section.min ? "" : String(low)} min={section.min} max={section.max} onCommit={(typed) => onChange?.([typed === null ? section.min : Math.min(clampTo(typed, section.min, section.max), high), high])} />
      <RangeInput label="At most" value={high === section.max ? "" : String(high)} min={section.min} max={section.max} onCommit={(typed) => onChange?.([low, typed === null ? section.max : Math.max(clampTo(typed, section.min, section.max), low)])} />
    </div>
  );
}

function WordChoices({ section, onToggle }: { section: WordSection; onToggle: (key: string) => void }) {
  if (section.options.length === 0) return <p style={{ margin: 0, padding: `4px ${PHONE_MARGIN}px 12px`, ...phoneText(13, 400, t.label) }}>No builds have a value yet.</p>;
  return (
    <div role="group" aria-label={`${section.name} values`}>
      {section.options.map((option) => (
        <PhoneCheckRow key={option.key} label={option.label} checked={option.checked} count={option.count} onChange={() => onToggle(option.key)} />
      ))}
    </div>
  );
}

function ScaleChoices({ section, onToggle }: { section: ScaleSection; onToggle?: (key: string) => void }) {
  const chosen = section.segments.filter((segment) => segment.on).map((segment) => segment.label).join(", ");
  return (
    <div role="group" aria-label={`${section.name}: ${chosen || "any"}`}>
      {section.segments.map((segment) => (
        <PhoneCheckRow key={segment.key} label={segment.label} checked={segment.on} onChange={() => onToggle?.(segment.key)} />
      ))}
    </div>
  );
}

/** What a filter holds, for the right of its row: "Any", the one value, "2 chosen". */
function heldOf(section: FilterSection): string {
  if (section.kind === "word") return section.value;
  if (section.kind === "range") return section.valueText;
  return section.segments.filter((segment) => segment.on).map((segment) => segment.label).join(", ") || "Any";
}

function FilterRow({ section, open, onPress, children }: { section: FilterSection; open: boolean; onPress: () => void; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <section aria-label={section.name}>
      <button type="button" aria-expanded={open} onClick={onPress} {...handlers} style={{ boxSizing: "border-box", width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 12, padding: `0 ${PHONE_MARGIN}px`, border: 0, background: "none", textAlign: "left", cursor: "pointer", ...phoneText(15, 400, t.text), ...ring(state.focusVisible) }}>
        <span style={{ flex: 1, minWidth: 0 }}>{section.name}</span>
        <span style={{ maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...phoneText(13, 400, t.text2) }}>{heldOf(section)}</span>
        <span aria-hidden="true" style={{ display: "inline-flex", color: t.label, transform: open ? "rotate(90deg)" : undefined }}>
          <MobileIcon name="chevr" size={20} />
        </span>
      </button>
      {open ? children : null}
    </section>
  );
}

/* ── the two fields at the top ── */

function FindFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <div style={{ position: "relative" }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 14, top: 13, color: t.label, display: "inline-flex" }}>
        <MobileIcon name="search" size={18} />
      </span>
      <input
        type="search"
        aria-label="Find a filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...handlers}
        style={{ boxSizing: "border-box", width: "100%", height: 44, padding: "0 12px 0 42px", border: 0, borderRadius: 12, background: t.surface, color: t.text, fontFamily: FIGTREE, fontSize: 16, outline: "none", boxShadow: state.focusVisible ? `inset 0 0 0 2px ${t.focusRing}` : `inset 0 0 0 1px ${t.fieldEdge}` }}
      />
    </div>
  );
}

/** Order values: a 44 control on Raised that shows the order every checklist has now; pressing it switches to the other. */
function OrderValues({ order, onOrder }: { order: "az" | "count"; onOrder: (order: "az" | "count") => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const word = order === "count" ? "Most builds" : "A to Z";
  return (
    <button type="button" aria-label={`Order values: ${word}`} onClick={() => onOrder(order === "count" ? "az" : "count")} {...handlers} style={{ boxSizing: "border-box", width: "100%", height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: 0, borderRadius: 12, background: t.inset, cursor: "pointer", ...phoneText(15, 400, t.text), ...ring(state.focusVisible) }}>
      <MobileIcon name="sort" size={18} />
      <span style={{ flex: 1, textAlign: "left", color: t.text2 }}>Order values</span>
      <span>{word}</span>
    </button>
  );
}

/* ── the sheet ── */

export interface PhoneFiltersSheetProps {
  props: BuildsFiltersViewProps;
  open: boolean;
  /** Close, the scrim and Escape: the draft is dropped. */
  onClose: () => void;
  /** Done: the draft is applied. */
  onDone: () => void;
  /** The match control, drawn by the filters module (it is a menu of its own). */
  match?: ReactNode;
}

export function PhoneFiltersSheet({ props, open, onClose, onDone, match }: PhoneFiltersSheetProps) {
  const { sections, savedSets, onToggleOption, onRange, onToggleSegment, order, onOrder, matchCount, dirty, onClear, addColumns, onAddColumns } = props;
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = search.trim().toLowerCase();
  const groups = FILTER_GROUPS.filter((group) => sections.some((section) => section.group === group));
  const shown = query ? sections.filter((section) => section.name.toLowerCase().includes(query)) : sections;

  const row = (section: FilterSection) => (
    <FilterRow key={section.id} section={section} open={chosen === section.id} onPress={() => setChosen((current) => (current === section.id ? null : section.id))}>
      {section.kind === "word" ? <WordChoices section={section} onToggle={(key) => onToggleOption(section.id, key)} /> : null}
      {section.kind === "range" ? <RangeChoices section={section} onChange={onRange ? (value) => onRange(section.id, value) : undefined} /> : null}
      {section.kind === "scale" ? <ScaleChoices section={section} onToggle={onToggleSegment ? (key) => onToggleSegment(section.id, key) : undefined} /> : null}
    </FilterRow>
  );

  const finish = (apply: boolean) => {
    setSearch("");
    setChosen(null);
    if (apply) onDone();
    else onClose();
  };

  return (
    <>
      <PhoneBottomSheet
        open={open}
        onOpenChange={(next) => (next ? undefined : finish(false))}
        title="Filters"
        height="full"
        dirty={dirty}
        data-testid="builds-filters-dialog"
        footer={{
          actions: (
            <>
              <Ghost onClick={onClear}>Clear all</Ghost>
              {savedSets ? (
                <BigButton style={FOOT_BUTTON} onClick={() => setSaving(true)} aria-haspopup="dialog">
                  Save these filters
                </BigButton>
              ) : null}
              <BigButton main style={FOOT_BUTTON} onClick={() => finish(true)}>
                Done
              </BigButton>
            </>
          ),
        }}
      >
        <div data-testid="builds-filters" style={{ paddingBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: `4px ${PHONE_MARGIN}px 0` }}>
            <FindFilter value={search} onChange={setSearch} />
            <OrderValues order={order} onOrder={onOrder} />
          </div>
          <p role="status" style={{ margin: 0, padding: `12px ${PHONE_MARGIN}px 0`, ...phoneText(13, 400, t.text2) }}>
            {matchCount === null ? "" : `${matchCount} ${matchCount === 1 ? "build matches" : "builds match"}`}
          </p>
          {query && shown.length === 0 ? <p style={{ margin: 0, padding: `12px ${PHONE_MARGIN}px`, ...phoneText(13, 400, t.text2) }}>No filter has that name.</p> : null}
          {query
            ? shown.map((section) => (
                <div key={section.id}>
                  <PhoneGroupLabel>{section.group}</PhoneGroupLabel>
                  {row(section)}
                </div>
              ))
            : groups.map((group) => (
                <div key={group} role="group" aria-label={group}>
                  <PhoneGroupLabel>{group}</PhoneGroupLabel>
                  {sections.filter((section) => section.group === group).map(row)}
                </div>
              ))}
          {match || (addColumns !== undefined && onAddColumns) ? (
            <div style={{ paddingTop: 8 }}>
              {match ? <div style={{ padding: `8px ${PHONE_MARGIN}px` }}>{match}</div> : null}
              {addColumns !== undefined && onAddColumns ? <PhoneCheckRow label="Add a column for each filter" checked={addColumns} onChange={() => onAddColumns(!addColumns)} /> : null}
            </div>
          ) : null}
        </div>
      </PhoneBottomSheet>
      {savedSets ? <PhoneSavedSets savedSets={savedSets} open={saving} onOpenChange={setSaving} onNavigate={() => { setSaving(false); finish(false); }} /> : null}
    </>
  );
}

/* ── saved filter sets ── */

const privacy = [
  { value: "private", label: "Private to you" },
  { value: "public", label: "Public" },
] as const;

function SheetRow({ children, onSelect, danger }: { children: ReactNode; onSelect: () => void; danger?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onSelect} {...handlers} style={{ boxSizing: "border-box", width: "100%", minHeight: 52, display: "flex", alignItems: "center", padding: `0 ${PHONE_MARGIN}px`, border: 0, background: "none", textAlign: "left", cursor: "pointer", ...phoneText(15, 400, danger ? t.dangerText : t.text), ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

function SetMore({ row, onRename, onTogglePublic, onDelete }: { row: SavedSetRow; onRename?: () => void; onTogglePublic?: (isPublic: boolean) => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const then = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <>
      <button type="button" aria-label={`More for ${row.name}`} aria-haspopup="dialog" onClick={() => setOpen(true)} {...handlers} style={{ width: TOUCH_MIN, height: TOUCH_MIN, flexShrink: 0, padding: 0, border: 0, background: "none", color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 999, ...ring(state.focusVisible) }}>
        <MobileIcon name="more" size={20} />
      </button>
      <PhoneBottomSheet open={open} onOpenChange={setOpen} title="More" line={row.name} height="content" dirty={false}>
        <div style={{ paddingBottom: 8 }}>
          {onRename ? <SheetRow onSelect={then(onRename)}>Rename</SheetRow> : null}
          {onTogglePublic ? <SheetRow onSelect={then(() => onTogglePublic(!row.isPublic))}>{row.isPublic ? "Make private" : "Make public"}</SheetRow> : null}
          {onDelete ? (
            <SheetRow danger onSelect={then(onDelete)}>
              Delete
            </SheetRow>
          ) : null}
        </div>
      </PhoneBottomSheet>
    </>
  );
}

function SetLink({ row, menu, onNavigate }: { row: SavedSetRow; menu?: ReactNode; onNavigate: () => void }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <div style={{ display: "flex", alignItems: "center", paddingRight: 4 }}>
      <Link
        to={row.href}
        aria-current={row.current ? "true" : undefined}
        onClick={onNavigate}
        {...handlers}
        style={{ flex: 1, minWidth: 0, boxSizing: "border-box", minHeight: 52, display: "flex", alignItems: "center", gap: 8, padding: `0 0 0 ${PHONE_MARGIN}px`, textDecoration: "none", ...phoneText(15, row.current ? 600 : 400, t.text), ...ring(state.focusVisible) }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
        {row.note ? <span style={phoneText(13, 400, t.text2)}>{row.note}</span> : row.count !== undefined ? <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.text2 }}>{row.count}</span> : null}
      </Link>
      {menu}
    </div>
  );
}

function OpenSet({ open }: { open: OpenSetView }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const followers = `${open.members} ${open.members === 1 ? "follower" : "followers"}`;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: `4px ${PHONE_MARGIN}px 0` }}>
      <span style={phoneText(13, 400, t.label)}>{open.isPublic ? `${open.mine ? "Your filter set" : "Filter set"} · ${followers}` : "Private to you"}</span>
      {!open.mine && open.isPublic ? (
        <button type="button" onClick={open.member ? open.onLeave : open.onJoin} aria-pressed={open.member} aria-label={`Follow ${open.name}`} {...handlers} style={{ minHeight: TOUCH_MIN, padding: "0 8px", border: 0, background: "none", cursor: "pointer", ...phoneText(13, 500, open.member ? t.text : t.text2), ...ring(state.focusVisible) }}>
          {open.member ? "Following" : "Follow"}
        </button>
      ) : null}
    </div>
  );
}

/** A name for a set: the field the sheets share. */
function NameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <PhoneField label="Filter set" value={value} maxLength={SET_NAME_MAX} autoComplete="off" onChange={(event) => onChange(event.target.value)} />;
}

function RenameSheet({ row, onClose, onRename }: { row: SavedSetRow | null; onClose: () => void; onRename: (id: string, name: string) => void | Promise<void> }) {
  const [name, setName] = useState(row?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(row?.id ?? null);
  if ((row?.id ?? null) !== seen) {
    setSeen(row?.id ?? null);
    setName(row?.name ?? "");
    setFailed(false);
    setBusy(false);
  }
  const ready = name.trim().length > 0 && !busy;
  const submit = async () => {
    if (!row || !ready) return;
    setBusy(true);
    setFailed(false);
    try {
      await onRename(row.id, name);
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <PhoneBottomSheet
      open={row !== null}
      onOpenChange={(next) => (next || busy ? undefined : onClose())}
      title="Rename filter set"
      height="content"
      dirty={false}
      footer={{
        actions: (
          <>
            <BigButton onClick={onClose} disabled={busy}>
              Close
            </BigButton>
            <BigButton main onClick={() => void submit()} disabled={!ready}>
              {busy ? "Saving" : "Rename"}
            </BigButton>
          </>
        ),
      }}
    >
      <div style={{ padding: `0 ${PHONE_MARGIN}px 16px` }}>
        <NameField value={name} onChange={setName} />
        {failed ? (
          <p role="alert" style={{ margin: "12px 0 0", ...phoneText(13, 400, t.text2) }}>
            {SAVE_FAILED}
          </p>
        ) : null}
      </div>
    </PhoneBottomSheet>
  );
}

/** Saved filter sets: the form that saves the filters now (a name and who can open it), then the sets as rows. */
export function PhoneSavedSets({ savedSets, open, onOpenChange, onNavigate }: { savedSets: SavedSetsProps; open: boolean; onOpenChange: (open: boolean) => void; onNavigate: () => void }) {
  const { rows, canSave, saveHint, onSaveCurrent, open: openSet, onRename, onTogglePublic, onDelete } = savedSets;
  const [name, setName] = useState("");
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState<SavedSetRow | null>(null);
  const [deleting, setDeleting] = useState<SavedSetRow | null>(null);
  const hasName = name.trim().length > 0;
  const ready = canSave && hasName && !busy;
  const hint = !hasName ? "Give it a name to save." : saveHint;

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSaveCurrent(name, isPublic);
      setName("");
      setPublic(false);
      setBusy(false);
      onOpenChange(false);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <>
      <PhoneBottomSheet
        open={open}
        onOpenChange={(next) => (next || busy ? undefined : onOpenChange(false))}
        title="Saved filter sets"
        height="full"
        dirty={false}
        data-testid="saved-sets-sheet"
        footer={{
          actions: (
            <>
              <BigButton onClick={() => onOpenChange(false)} disabled={busy}>
                Close
              </BigButton>
              <BigButton main onClick={() => void save()} disabled={!ready} aria-describedby={hint ? "phone-set-hint" : undefined}>
                {busy ? "Saving" : "Save"}
              </BigButton>
            </>
          ),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: `0 ${PHONE_MARGIN}px` }}>
          <NameField value={name} onChange={setName} />
        </div>
        <PhonePills<"private" | "public"> label="Who can open it" value={isPublic ? "public" : "private"} onChange={(value) => setPublic(value === "public")} pills={privacy} />
        {hint ? (
          <p id="phone-set-hint" style={{ margin: 0, padding: `0 ${PHONE_MARGIN}px`, ...phoneText(13, 400, t.label) }}>
            {hint}
          </p>
        ) : null}
        {failed ? (
          <p role="alert" style={{ margin: 0, padding: `8px ${PHONE_MARGIN}px 0`, ...phoneText(13, 400, t.text2) }}>
            {SAVE_FAILED}
          </p>
        ) : null}
        <section aria-label="Saved filter sets" style={{ paddingTop: 8, paddingBottom: 16 }}>
          {rows.map((row) => (
            <SetLink
              key={row.id}
              row={row}
              onNavigate={onNavigate}
              menu={
                onRename || onDelete ? (
                  <SetMore row={row} onRename={onRename ? () => setRenaming(row) : undefined} onTogglePublic={onTogglePublic ? (next) => onTogglePublic(row.id, next) : undefined} onDelete={onDelete ? () => setDeleting(row) : undefined} />
                ) : undefined
              }
            />
          ))}
          {openSet ? <OpenSet open={openSet} /> : null}
        </section>
      </PhoneBottomSheet>
      {onRename ? <RenameSheet row={renaming} onClose={() => setRenaming(null)} onRename={onRename} /> : null}
      <ActionSheet
        open={deleting !== null}
        onOpenChange={(next) => (next ? undefined : setDeleting(null))}
        title="Delete this filter set?"
        explanation="The filters in it stay as they are."
        action={{
          label: "Delete",
          danger: true,
          onSelect: () => {
            const target = deleting;
            setDeleting(null);
            if (target) void Promise.resolve(onDelete?.(target.id)).catch(() => undefined);
          },
        }}
      />
    </>
  );
}
