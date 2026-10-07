import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SEARCH_MAX, normaliseQuery } from "@/lib/build/search";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { denseHeight } from "@/lib/theme/density";
import { SPACE, SPACE_COMPACT } from "@/lib/theme/space";
import { body } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P07 — the one search field on the desktop.

   ONE BOX, THE SAME EVERYWHERE, WHOSE RESULTS ARE THE GALLERY (hicks-law ›
   Familiarity; CONTRACT §14). It sits under the wordmark on every page that
   has the nav, and submitting it opens /gallery?q=… — the gallery reads the
   query from there (RC-P10). The phone's magnifier goes to the same place.

   THE QUERY IS TIDIED BEFORE IT LEAVES: normaliseQuery trims it, collapses
   its whitespace and cuts it to 80, and a query under two characters goes
   nowhere, because it would match nearly everything. The field stops typing at
   80 for the same reason.

   "/" FOCUSES IT, from anywhere that is not already taking text
   ⟦responsive-design › Input Method Adaptation: Keyboard⟧: an input, a
   textarea, a select or an editable region keeps its "/". Only the keystroke
   the field takes is prevented; with a modifier held the key belongs to
   whatever else wants it.

   ON THE GALLERY THE FIELD SHOWS THE GALLERY'S QUERY, so the box and the
   results always agree about what was searched for.

   ITS LOOK is the kit's field — an inset --recess well at --r-control, a
   --line border that brightens on hover and turns --action with the theme's
   single focus ring — never a pill (buildgallery-theme › Radius; Focus ring).
   The font is set on the form because index.css makes every input inherit its
   font size above 768px.

   DENSER SINCE UI-P55: SPACE.lg as a height is 40, which the table takes to 33,
   and the inline padding is the compact sm, 12.

   THE PLACEHOLDER IS --text2 (RC-P09c), through the one mechanism the kit has
   for it: ::placeholder is a pseudo-element no inline style can reach, so it
   takes the generated utility ui/input.tsx uses, whose note explains why that
   is not a new class. Without it the placeholder kept the base stylesheet's
   grey: 1.75:1 on Noon's --recess, where --text2 is 4.55:1 (5.73:1 on
   Dusk).
   ──────────────────────────────────────────────────────────────────────────── */

/** The kit's placeholder colour, spelled as ui/input.tsx spells it. */
const PLACEHOLDER_CLASS = "placeholder:text-[color:var(--text2)]";

/** True when the key press belongs to something the reader is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * RC-P10 — THE GALLERY'S OWN FIELD IS THIS FIELD, with three things changed by
 * props rather than a second copy of the component: no "/" shortcut (the nav's
 * field keeps it, and one key cannot focus two boxes), a submitted query
 * written into the gallery's address instead of a navigation, and its own
 * accessible name, so the two search landmarks on a desktop gallery are
 * distinguishable. Every prop is optional; the nav renders it as before.
 */
export interface NavSearchProps {
  /** "/" focuses the field from anywhere not taking text. Default on. */
  shortcut?: boolean;
  /**
   * Where a submitted query goes. Default: open /gallery?q=…. Called with
   * null when the field is submitted empty, which clears the search.
   */
  onSearch?: (query: string | null) => void;
  /** The field's accessible name. Default "Search builds". */
  label?: string;
  /** The input, for a page that moves focus to it (/gallery?focus=search). */
  inputRef?: MutableRefObject<HTMLInputElement | null>;
}

export function NavSearch({
  shortcut = true,
  onSearch,
  label = "Search builds",
  inputRef,
}: NavSearchProps = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [value, setValue] = useState("");
  const field = useRef<HTMLInputElement | null>(null);
  const { state, handlers } = useInteractive<HTMLInputElement>();

  const galleryQuery = pathname === "/gallery" ? params.get("q") ?? "" : null;
  useEffect(() => {
    if (galleryQuery !== null) setValue(galleryQuery);
  }, [galleryQuery]);

  useEffect(() => {
    if (!shortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      field.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = normaliseQuery(value);
    if (onSearch) {
      // An emptied field clears the search; a query under two characters
      // goes nowhere, as it does from the nav.
      if (query !== null || value.trim() === "") onSearch(query);
      return;
    }
    if (query === null) return;
    navigate(`/gallery?q=${encodeURIComponent(query)}`);
  };

  return (
    <form role="search" aria-label={label} onSubmit={onSubmit} style={{ ...body, margin: 0 }}>
      <input
        ref={(node) => {
          field.current = node;
          if (inputRef) inputRef.current = node;
        }}
        type="search"
        aria-label={label}
        placeholder="Search builds"
        className={PLACEHOLDER_CLASS}
        maxLength={SEARCH_MAX}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...handlers}
        style={{
          ...fieldStyle(state),
          borderRadius: r.control,
          width: "100%",
          height: denseHeight(SPACE.lg),
          paddingInline: SPACE_COMPACT.sm,
          boxSizing: "border-box",
        }}
      />
    </form>
  );
}

export default NavSearch;
