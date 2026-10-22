/* TF-02 — one tool picker, with logos.

   A trigger showing the chosen tool's logo at 16 and its name, or "Select a tool". It opens a Radix popover: a field,
   "Find a tool", that takes focus, then the rows (`pickerRows`) as a listbox. The focus stays in the field and the
   active row is named by `aria-activedescendant`: Up and Down move, Enter picks, Esc closes and gives focus back to the
   trigger. A listed tool is handed back as its `id`, a typed name as typed and trimmed, "No tool" as null.

   Pure but for its own open state: the build's tools come in as `inBuild`.

   CA-02: `step` is the Add item the tool is named on, and the rows fit it (`pickerRows`). A row that does not fit is
   drawn at the dim filter with its line under the name, and is `aria-disabled` unless it can still be picked (a tool
   that runs prompts by itself, named on a prompt). */

import * as Popover from "@radix-ui/react-popover";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { ModelMark } from "@/components/brand/ModelMark";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, CONTROL_HOVER, SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { toolFor, type StepKey, type ToolList } from "@/lib/tools/registry";

import { menuSurface, text, wellField } from "./refinedStyles";
import { PickerChevron, pickerFieldStyle } from "./modalRecipes";
import { pickerRows, TYPED_TOOL_MAX, type PickerRow } from "./toolPickerModel";

export interface ToolPickerProps {
  /** A tool id, a typed name, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The tools the build already uses. */
  inBuild: readonly string[];
  allowNone?: boolean;
  /** The trigger's accessible name. */
  label: string;
  phone: boolean;
  /** The Add item the tool is being named on (CA-02). */
  step: StepKey;
  /** CA-02 P5: what the "No tool" row says, and the trigger while nothing is picked ("My own code (API)"). */
  noneLabel?: string;
  /** CA-12: what the trigger says while nothing is picked and there is no "none" row to name; "Select a tool" by default. */
  placeholder?: string;
  /** CA-12 P13: the list offered: AI tools (the default) or apps and services. */
  list?: ToolList;
  /** CA-12 P11: nothing has been chosen yet, even though "none" is a choice: the trigger shows the placeholder, not the none row's words. */
  unpicked?: boolean;
  /** CA-13 rule 5: offer the Runtime models and services subcategory first (Decision dialog, helpers, "Runs in", answer shapes). */
  runtime?: boolean;
  /** CA-14 P2: a text button in `--text2` (a session's "No app chosen"), not the boxed control. */
  quiet?: boolean;
  /** CA-15b: drawn as the modals' picker field: full width, the well, the value at the left and a chevron at the right. */
  field?: boolean;
}

const isPickable = (row: PickerRow): boolean => row.kind !== "heading" && row.kind !== "note";

/** Over the Add dialogs, whose content sits at 51 over a scrim at 50. */
export const FLOATING_Z = 52;

/** The words a row reads as. */
function rowName(row: PickerRow, noneLabel = "No tool", list: ToolList = "ai"): string {
  switch (row.kind) {
    case "none":
      return noneLabel;
    case "tool":
      return row.tool.name;
    case "showAll":
      return `Show all ${row.count} ${list === "app" ? "apps" : "tools"}`;
    case "showMore":
      return `Show ${row.count} more`;
    case "use":
      return `Use "${row.name}"`;
    case "heading":
      return row.label;
    case "note":
      return row.text;
  }
}

/** A row that is listed but cannot be picked. */
const isDisabled = (row: PickerRow): boolean => row.kind === "tool" && row.unavailable === true && row.pickable !== true;

export function ToolPicker({ value, onChange, inBuild, allowNone = false, label, phone, step, noneLabel, placeholder = "Select a tool", list = "ai", unpicked = false, runtime = false, quiet = false, field: asField = false }: ToolPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const uid = useId();
  const trigger = useInteractive<HTMLButtonElement>();

  const chosen = toolFor(value);
  const typedValue = value && !chosen ? value.trim() : null;
  const shown = chosen ? chosen.name : typedValue || (allowNone && noneLabel && !unpicked ? noneLabel : placeholder);

  const rows = pickerRows({ query, inBuild, expanded, allowNone, step, list, runtime });
  const pickable = rows.filter(isPickable);
  const current = Math.min(active, Math.max(pickable.length - 1, 0));
  const rowId = (row: PickerRow) => `${uid}-row-${pickable.indexOf(row)}`;

  const isChosen = (row: PickerRow): boolean => {
    if (row.kind === "none") return !value;
    if (row.kind === "tool") return chosen?.id === row.tool.id;
    if (row.kind === "use") return typedValue !== null && typedValue.toLowerCase() === row.name.toLowerCase();
    return false;
  };

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery("");
    setExpanded(false);
    const first = pickerRows({ query: "", inBuild, expanded: false, allowNone, step, list, runtime }).filter(isPickable);
    setActive(Math.max(0, first.findIndex(isChosen)));
  };

  const pick = (row: PickerRow | undefined) => {
    if (!row || isDisabled(row)) return;
    if (row.kind === "showAll" || row.kind === "showMore") {
      setExpanded(true);
      return;
    }
    if (row.kind === "none") onChange(null);
    else if (row.kind === "tool") onChange(row.tool.id);
    else if (row.kind === "use") onChange(row.name.trim().slice(0, TYPED_TOOL_MAX));
    else return;
    setOpen(false);
  };

  const move = (to: number) => {
    const next = (to + pickable.length) % Math.max(pickable.length, 1);
    setActive(next);
    const element = document.getElementById(`${uid}-row-${next}`);
    if (typeof element?.scrollIntoView === "function") element.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(current - 1);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      pick(pickable[current]);
    }
  };

  const quietStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
    height: phone ? 36 : 28,
    padding: "0 6px",
    margin: "0 -6px",
    background: "transparent",
    border: 0,
    borderRadius: 6,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    ...text(15, 500, t.text2),
    ...ring(trigger.state.focusVisible),
  };
  const fieldStyle: CSSProperties = { ...pickerFieldStyle(phone, trigger.state, !value), ...ring(trigger.state.focusVisible) };
  const triggerStyle: CSSProperties = quiet ? quietStyle : asField ? fieldStyle : {
    ...CONTROL,
    ...(trigger.state.hovered ? CONTROL_HOVER : null),
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
    height: phone ? 44 : 32,
    padding: "0 10px",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    ...text(13, 400, value ? t.text : t.text2),
    ...ring(trigger.state.focusVisible),
  };

  const rowStyle = (row: PickerRow): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    minHeight: phone ? 44 : 36,
    padding: "0 10px",
    borderRadius: 6,
    border: "1px solid transparent",
    cursor: isDisabled(row) ? "default" : "pointer",
    overflowWrap: "anywhere",
    ...text(13, 400, row.kind === "showAll" || row.kind === "showMore" ? t.text2 : t.text),
    ...(row.kind === "tool" && row.unavailable ? { filter: t.dimFilter } : null),
    ...(pickable.indexOf(row) === current ? { background: t.controlOn } : null),
    ...(isChosen(row) ? SELECTED : null),
  });

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={label} aria-haspopup="listbox" aria-describedby={`${uid}-value`} {...trigger.handlers} style={triggerStyle}>
          {value ? <ModelMark tool={chosen ? chosen.id : value} size={16} /> : null}
          <span id={`${uid}-value`} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {shown}
          </span>
          {asField ? <PickerChevron /> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            field.current?.focus();
          }}
          /* Above a dialog's content (51): the picker opens inside the Add dialogs. */
          style={{ ...menuSurface(280), zIndex: FLOATING_Z, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <input
            ref={field}
            type="text"
            role="combobox"
            aria-label={list === "app" ? "Find an app" : "Find a tool"}
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-activedescendant={pickable.length ? `${uid}-row-${current}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={list === "app" ? "Find an app" : "Find a tool"}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(false);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            style={{ ...wellField, width: "100%", boxSizing: "border-box", height: phone ? 44 : 32, padding: "0 10px", fontSize: phone ? 16 : 13 }}
          />
          <div id={`${uid}-list`} role="listbox" aria-label={label} style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((row, index) =>
              row.kind === "note" ? (
                <div key={`n-${row.text}`} role="note" style={{ ...text(12, 400, t.text2), padding: "6px 8px", overflowWrap: "anywhere" }}>
                  {row.text}
                </div>
              ) : row.kind === "heading" ? (
                <div key={`h-${row.label}`} role="presentation" style={{ ...text(11.5, 400, t.label), padding: index === 0 ? "4px 10px" : "8px 10px 4px" }}>
                  {row.label}
                </div>
              ) : (
                <div
                  key={`${row.kind}-${row.kind === "tool" ? row.tool.id : row.kind === "use" ? row.name : index}`}
                  id={rowId(row)}
                  role="option"
                  aria-selected={isChosen(row)}
                  aria-disabled={isDisabled(row) ? true : undefined}
                  onMouseMove={() => setActive(pickable.indexOf(row))}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row)}
                  style={rowStyle(row)}
                >
                  {row.kind === "tool" ? <ModelMark tool={row.tool.id} size={16} /> : null}
                  {row.kind === "tool" && row.line ? (
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, padding: "4px 0" }}>
                      <span>{rowName(row, noneLabel, list)}</span>
                      <span style={text(11.5, 400, t.label)}>{row.line}</span>
                    </span>
                  ) : (
                    <span style={{ minWidth: 0 }}>{rowName(row, noneLabel, list)}</span>
                  )}
                </div>
              ),
            )}
            {pickable.length === 0 ? <span style={VISUALLY_HIDDEN}>{list === "app" ? "No apps match" : "No tools match"}</span> : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default ToolPicker;
