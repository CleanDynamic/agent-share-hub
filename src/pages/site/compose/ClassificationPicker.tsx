/* CA-16 P4 and CA-16b: the typeahead picker: Field, Task, Setting, Data handled and Tools and stack.

   CHOSEN VALUES are chips with a remove button; a Field chip shows its full path, an entry of the maker's own has a
   dashed edge. SUGGESTIONS are one row above the input, "Suggested" and then up to three dashed chips with "+"; nothing is
   pre-selected. TYPING searches the list (`findValues`, at most 8): each row has its name with the matching letters at 600
   and, at the right, its path in the data face (a technical Field says "Technical ›", a synonym match says "Synonym
   match ·"). When the text is not an exact label the last row is Add "<text>" as your own entry, kept as `{ custom }` and
   cut to 60 characters. LIMITS: Field 3, Task 3 (the first chosen is Primary, and a chip menu changes it), Setting 2;
   Data handled and Tools and stack have none. At the limit the input says "Remove one to add another".

   It is a combobox: `role="combobox"`, `aria-expanded`, `aria-controls` the `role="listbox"`, `aria-activedescendant` the
   active `role="option"`; ArrowDown, ArrowUp, Enter and Escape work. While typing, the field's edge and ring are the
   focus ring. Touch targets are 44 high on a phone. The pieces are in `classificationPieces.tsx`. */

import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { CUSTOM_MAX_LENGTH, findValues, isTechnicalField, pathOf, valueOf, valueByLabel, type Facet, type TaxonomyValue } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Entry } from "@/lib/classify/types";

import { bareButton, ellipsis, text, wellField } from "./refinedStyles";
import { ChosenValue, Matched, SuggestedRow, Suggestion, ownEntryRow, typeaheadList, typeaheadNote, typeaheadRow } from "./classificationPieces";

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

/** The grey line at the right of a result: its path (a technical Field says so), or, for a synonym match, the root it sits under. */
export function resultNote(facet: Facet, value: TaxonomyValue, query: string): string {
  const q = query.trim().toLowerCase();
  const byLabel = value.label.toLowerCase().includes(q);
  if (!byLabel) {
    const root = pathOf(value.id, facet).split(" \u203A ")[0];
    return `Synonym match \u00B7 ${root}`;
  }
  const path = pathOf(value.id, facet);
  return facet === "field" && isTechnicalField(value.id) ? `Technical \u203A ${path}` : path;
}

function TaskMenu({ label, phone, onMakePrimary }: { label: string; phone: boolean; onMakePrimary: () => void }) {
  const [menu, setMenu] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <>
      <button
        type="button"
        aria-label={`Options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
        {...handlers}
        style={{ ...bareButton, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: phone ? 44 : 18, minHeight: phone ? 44 : 18, borderRadius: 4, color: t.text2, ...ring(state.focusVisible) }}
      >
        <Glyph name="more" size={14} />
      </button>
      {menu ? (
        <div role="menu" aria-label={`${label} options`} style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 20, padding: 4, borderRadius: 9, background: t.window, border: `1px solid ${t.controlBorder}`, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMakePrimary();
              setMenu(false);
            }}
            style={{ ...bareButton, display: "flex", alignItems: "center", minHeight: phone ? 44 : 30, padding: "0 10px", borderRadius: 6, whiteSpace: "nowrap", ...text(13, 400, t.text) }}
          >
            Make primary
          </button>
        </div>
      ) : null}
    </>
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
  const typing = focused && trimmed !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      {entries.length > 0 ? (
        <ul aria-label={`${label}, chosen`} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entries.map((entry, index) => {
            const name = chipText(facet, entry);
            return (
              <ChosenValue
                key={isCustomEntry(entry) ? `c:${entry.custom}` : entry.id}
                label={name}
                own={isCustomEntry(entry)}
                phone={phone}
                removeLabel={`Remove ${labelOfEntry(facet, entry)}`}
                onRemove={() => commit(entries.filter((_, at) => at !== index))}
                menu={
                  primary ? (
                    index === 0 ? (
                      <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, textTransform: "uppercase", letterSpacing: ".06em" }}>Primary</span>
                    ) : (
                      <TaskMenu label={name} phone={phone} onMakePrimary={() => commit([entries[index], ...entries.filter((_, at) => at !== index)])} />
                    )
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      ) : null}

      {shownSuggestions.length > 0 ? (
        <SuggestedRow label={`${label}, suggestions`}>
          {shownSuggestions.map((value) => (
            <Suggestion key={value.id} label={value.label} name={`Add ${facet === "field" ? pathOf(value.id, facet) : value.label}`} title={pathOf(value.id, facet)} phone={phone} onAdd={() => add({ id: value.id })} />
          ))}
        </SuggestedRow>
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
          style={{ ...wellField, height: phone ? 44 : 32, padding: "0 12px", ...text(phone ? 16 : 13, 400, t.text), ...(atLimit ? { filter: t.dimFilter } : null), ...(typing ? { borderColor: t.focusRing, boxShadow: `0 0 0 2px ${t.focusRing}` } : ring(inputState.focusVisible)) }}
        />
        {open ? (
          <ul id={listId} role="listbox" aria-label={`${label}, matches`} style={typeaheadList}>
            {results.map((value, index) => (
              <li
                key={value.id}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                style={typeaheadRow(index === activeIndex, phone)}
              >
                <span style={phone ? ellipsis : { ...ellipsis, flexShrink: 0, maxWidth: "55%" }}>
                  <Matched label={value.label} query={trimmed} />
                </span>
                <span style={typeaheadNote(phone)}>{resultNote(facet, value, trimmed)}</span>
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
                style={ownEntryRow(results.length === activeIndex, phone)}
              >
                <span style={{ ...ellipsis, flexShrink: 0, maxWidth: "60%" }}>{`Add \u201C${trimmed.slice(0, CUSTOM_MAX_LENGTH)}\u201D as your own entry`}</span>
                <span style={typeaheadNote(phone)}>{OWN_ENTRY_NOTE}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
