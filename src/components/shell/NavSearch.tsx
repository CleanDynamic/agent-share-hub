import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SEARCH_MAX, normaliseQuery } from "@/lib/build/search";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
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
   ──────────────────────────────────────────────────────────────────────────── */

/** True when the key press belongs to something the reader is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

export function NavSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [value, setValue] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const { state, handlers } = useInteractive<HTMLInputElement>();

  const galleryQuery = pathname === "/gallery" ? params.get("q") ?? "" : null;
  useEffect(() => {
    if (galleryQuery !== null) setValue(galleryQuery);
  }, [galleryQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      field.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = normaliseQuery(value);
    if (query === null) return;
    navigate(`/gallery?q=${encodeURIComponent(query)}`);
  };

  return (
    <form role="search" onSubmit={onSubmit} style={{ ...body, margin: 0 }}>
      <input
        ref={field}
        type="search"
        aria-label="Search builds"
        placeholder="Search builds"
        maxLength={SEARCH_MAX}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        {...handlers}
        style={{
          ...fieldStyle(state),
          borderRadius: r.control,
          width: "100%",
          height: SPACE.lg,
          paddingInline: SPACE.sm,
          boxSizing: "border-box",
        }}
      />
    </form>
  );
}

export default NavSearch;
