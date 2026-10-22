/* CA-16 P4 — the typeahead picker: Field, Task, Setting, Data handled and Tools and stack.

   CHOSEN VALUES are chips with a remove button; a Field chip shows its full path, an entry of the maker's own has a
   dashed edge. SUGGESTIONS sit above the input as up to three dashed chips with "+"; nothing is pre-selected.
   TYPING searches the list (`findValues`, at most 8) and shows each label with the matching part in weight 600 and its
   path in grey mono. When the text is not an exact label, the last option is Add "<text>" as your own entry, kept as
   `{ custom }` and cut to 60 characters. LIMITS: Field 3, Task 3 (the first chosen is Primary, and a chip menu can change
   it), Setting 2; Data handled and Tools and stack have none. At the limit the input says "Remove one to add another".

   It is a combobox: `role="combobox"`, `aria-expanded`, `aria-controls` the `role="listbox"`, `aria-activedescendant`
   the active `role="option"`; ArrowDown, ArrowUp, Enter and Escape work. Touch targets are 44 high on a phone. */

import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { CUSTOM_MAX_LENGTH, findValues, pathOf, valueOf, valueByLabel, type Facet, type TaxonomyValue } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Entry } from "@/lib/classify/types";

import { bareButton, ellipsis, text, wellField } from "./refinedStyles";

export const OWN_ENTRY_NOTE = "Shown on your build, reviewed for the list";
export const AT_LIMIT = "Remove one to add another";
export const MAX_RESULTS = 8;

export interface ClassificationPickerProps {
  /** A stable id, the prefix of every element id in the picker. */
  id: string;
  facet: Facet;
  /** The accessible name of the input: "Field", "Task". */
  label: string;
  entries: readonly Entry[];
  onChange: (next: Entry[]) => void;
  /** The most that can be chosen; absent: no limit. */
  max?: number;
  /** Up to three, shown above the input. */
  suggestions?: readonly TaxonomyValue[];
  phone: boolean;
  placeholder?: string;
  /** Task: the first chosen is Primary, and a chip menu changes it. */
  primary?: boolean;
}

/** The first chosen is primary, and only that one. */
export function withPrimary(entries: readonly Entry[]): Entry[] {
  return entries.map((entry, index) => {
    const { primary: _drop, ...rest } = entry as Entry & { primary?: true };
    void _drop;
    return (index === 0 ? { ...rest, primary: true } : rest) as Entry;
  });
}

const labelOfEntry = (facet: Facet, entry: Entry): string => (isCustomEntry(entry) ? entry.custom : (valueOf(facet, entry.id)?.label ?? entry.id));
const chipText = (facet: Facet, entry: Entry): string => (isCustomEntry(entry) ? entry.custom : facet === "field" ? pathOf(entry.id, facet) : labelOfEntry(facet, entry));

function Highlight({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span style={{ fontWeight: 600 }}>{label.slice(at, at + query.length)}</span>
      {label.slice(at + query.length)}
    </>
  );
}

function Chip({
  facet,
  entry,
  phone,
  primary,
  isPrimary,
  onRemove,
  onMakePrimary,
}: {
  facet: Facet;
  entry: Entry;
  phone: boolean;
  primary: boolean;
  isPrimary: boolean;
  onRemove: () => void;
  onMakePrimary: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const label = chipText(facet, entry);
  const removeHover = useInteractive<HTMLButtonElement>();
  const menuHover = useInteractive<HTMLButtonElement>();
  const custom = isCustomEntry(entry);
  const size = phone ? 44 : 28;
  const box: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minHeight: size,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "0 4px 0 10px",
    borderRadius: 6,
    background: t.tile,
    borderWidth: 1,
    borderStyle: custom ? "dashed" : "solid",
    borderColor: custom ? t.line : t.tileBorder,
    ...text(12.5, 400, t.text),
    position: "relative",
  };
  return (
    <li style={box} data-custom={custom ? "true" : undefined}>
      <span style={{ ...ellipsis, minWidth: 0 }}>{label}</span>
      {primary && isPrimary ? <span style={{ ...text(10.5, 500, t.label), textTransform: "uppercase", letterSpacing: ".06em" }}>Primary</span> : null}
      {primary && !isPrimary ? (
        <button
          type="button"
          aria-label={`Options for ${label}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
          {...menuHover.handlers}
          style={{ ...bareButton, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: size, minHeight: size, borderRadius: 6, color: t.label, ...ring(menuHover.state.focusVisible) }}
        >
          <Glyph name="more" size={16} />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        {...removeHover.handlers}
        style={{ ...bareButton, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: size, minHeight: size, borderRadius: 6, color: t.label, ...ring(removeHover.state.focusVisible) }}
      >
        <Glyph name="x" size={14} />
      </button>
      {menu ? (
        <div
          role="menu"
          aria-label={`${label} options`}
          style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 20, padding: 4, borderRadius: 8, background: t.window, border: `1px solid ${t.windowBorder}`, boxShadow: t.windowShadow }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMakePrimary();
              setMenu(false);
            }}
            style={{ ...bareButton, display: "flex", alignItems: "center", minHeight: phone ? 44 : 32, padding: "0 12px", borderRadius: 6, whiteSpace: "nowrap", ...text(13, 400, t.text) }}
          >
            Make primary
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function ClassificationPicker({ id, facet, label, entries, onChange, max, suggestions = [], phone, placeholder, primary = false }: ClassificationPickerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { state: inputState, handlers: inputHandlers } = useInteractive<HTMLInputElement>({ onFocus: () => setFocused(true), onBlur: () => setFocused(false) });
  const listId = `${id}-list`;
  const atLimit = max !== undefined && entries.length >= max;
  const chosenIds = useMemo(() => new Set(entries.flatMap((entry) => (isCustomEntry(entry) ? [] : [entry.id]))), [entries]);

  const trimmed = query.trim();
  const results = useMemo(() => (trimmed ? findValues(facet, trimmed).filter((value) => !chosenIds.has(value.id)).slice(0, MAX_RESULTS) : []), [facet, trimmed, chosenIds]);
  const exact = trimmed ? valueByLabel(facet, trimmed) : null;
  const ownEntry = trimmed !== "" && !exact && !entries.some((entry) => isCustomEntry(entry) && entry.custom.toLowerCase() === trimmed.toLowerCase());
  const count = results.length + (ownEntry ? 1 : 0);
  const open = focused && !atLimit && count > 0;
  const activeIndex = count === 0 ? -1 : Math.min(active, count - 1);

  const commit = (next: Entry[]) => onChange(primary ? withPrimary(next) : next);
  const add = (entry: Entry) => {
    if (atLimit) return;
    commit([...entries, entry]);
    setQuery("");
    setActive(0);
  };
  const choose = (index: number) => {
    const value = results[index];
    if (value) add({ id: value.id });
    else if (ownEntry && index === results.length) add({ custom: trimmed.slice(0, CUSTOM_MAX_LENGTH) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (count > 0) setActive((activeIndex + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count > 0) setActive((activeIndex - 1 + count) % count);
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        choose(activeIndex);
      }
    } else if (event.key === "Escape") {
      if (query) {
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
      }
    }
  };

  const shownSuggestions = atLimit ? [] : suggestions.filter((value) => !chosenIds.has(value.id)).slice(0, 3);
  const option = (index: number): CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
    minHeight: phone ? 44 : 36,
    padding: "4px 12px",
    borderRadius: 6,
    cursor: "pointer",
    boxSizing: "border-box",
    ...text(13, 400, t.text),
    ...(index === activeIndex ? { background: t.selectedFill } : null),
  });
  const grey: CSSProperties = { fontFamily: DM_MONO, fontSize: 10.5, lineHeight: "normal", color: t.label, ...ellipsis };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {entries.length > 0 ? (
        <ul aria-label={`${label}, chosen`} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entries.map((entry, index) => (
            <Chip
              key={isCustomEntry(entry) ? `c:${entry.custom}` : entry.id}
              facet={facet}
              entry={entry}
              phone={phone}
              primary={primary}
              isPrimary={index === 0}
              onRemove={() => commit(entries.filter((_, at) => at !== index))}
              onMakePrimary={() => commit([entries[index], ...entries.filter((_, at) => at !== index)])}
            />
          ))}
        </ul>
      ) : null}

      {shownSuggestions.length > 0 ? (
        <ul aria-label={`${label}, suggestions`} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {shownSuggestions.map((value) => (
            <li key={value.id}>
              <button
                type="button"
                aria-label={`Add ${facet === "field" ? pathOf(value.id, facet) : value.label}`}
                title={pathOf(value.id, facet)}
                onClick={() => add({ id: value.id })}
                style={{ ...bareButton, display: "inline-flex", alignItems: "center", gap: 6, minHeight: phone ? 44 : 28, padding: "0 10px", borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: t.line, boxSizing: "border-box", ...text(12.5, 400, t.text2) }}
              >
                <span aria-hidden="true">+</span>
                {value.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ position: "relative" }}>
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={atLimit}
          value={atLimit ? "" : query}
          placeholder={atLimit ? AT_LIMIT : (placeholder ?? "")}
          maxLength={120}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          {...inputHandlers}
          style={{ ...wellField, height: phone ? 44 : 36, padding: "0 12px", ...text(phone ? 16 : 13.5, 400, t.text), ...(atLimit ? { filter: t.dimFilter } : null), ...ring(inputState.focusVisible) }}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label}, matches`}
            style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 30, listStyle: "none", padding: 4, margin: 0, borderRadius: 8, background: t.window, border: `1px solid ${t.windowBorder}`, boxShadow: t.windowShadow, maxHeight: 360, overflowY: "auto" }}
          >
            {results.map((value, index) => (
              <li
                key={value.id}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                style={option(index)}
              >
                <span style={ellipsis}>
                  <Highlight label={value.label} query={trimmed} />
                </span>
                <span style={grey}>{pathOf(value.id, facet)}</span>
              </li>
            ))}
            {ownEntry ? (
              <li
                id={`${id}-opt-${results.length}`}
                role="option"
                aria-selected={results.length === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(results.length)}
                onClick={() => choose(results.length)}
                style={option(results.length)}
              >
                <span style={ellipsis}>{`Add "${trimmed.slice(0, CUSTOM_MAX_LENGTH)}" as your own entry`}</span>
                <span style={{ ...grey, fontFamily: undefined, fontSize: 11.5 }}>{OWN_ENTRY_NOTE}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
