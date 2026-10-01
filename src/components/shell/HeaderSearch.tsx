// The header's search field (UI-P17), also the phone's search sheet (UI-P19).
//
// REUSES `NavSearch`'s SUBMIT BEHAVIOUR AND DESTINATION, not its look: a query
// is tidied by `normaliseQuery` (trimmed, whitespace collapsed, cut to 80; under
// two characters goes nowhere) and opens /gallery?q=…, so the field and the
// gallery always agree about what was searched for. `NavSearch` itself stays for
// `FlatShell`.
//
// "/" FOCUSES IT from anywhere that is not already taking text — an input, a
// textarea, a select or an editable region keeps its "/" — and only without a
// modifier held. The field is a label, so a click anywhere on the box focuses
// the input.

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { normaliseQuery, SEARCH_MAX } from "@/lib/build/search";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/** The kit's placeholder colour, spelled as ui/input.tsx spells it (a pseudo-element no inline style reaches). */
const PLACEHOLDER_CLASS = "placeholder:text-[color:var(--text2)]";

/** True when the key press belongs to something the reader is typing into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/** Where a submitted query goes: the gallery, with the query tidied. Null when it is too short to search. */
export function useGallerySearch(): (query: string) => boolean {
  const navigate = useNavigate();
  return (query: string) => {
    const tidy = normaliseQuery(query);
    if (tidy === null) return false;
    navigate(`/gallery?q=${encodeURIComponent(tidy)}`);
    return true;
  };
}

export interface HeaderSearchProps {
  /** `bar` is the desktop header's 280×38 field with the "/" hint; `sheet` is the phone's full-width 44px field at 16px. */
  variant?: "bar" | "sheet";
  /** Called with the raw text on submit. Return true when it was used (the sheet closes on it). */
  onSubmit: (query: string) => boolean | void;
  /** The query to show; the gallery's own while on /gallery. */
  initialValue?: string;
  /** "/" focuses the field. On for the header, off for the sheet. */
  shortcut?: boolean;
  autoFocus?: boolean;
}

export function HeaderSearch({
  variant = "bar",
  onSubmit,
  initialValue = "",
  shortcut = variant === "bar",
  autoFocus = false,
}: HeaderSearchProps) {
  const [value, setValue] = useState(initialValue);
  const field = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => setValue(initialValue), [initialValue]);

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  const sheet = variant === "sheet";

  return (
    <form role="search" aria-label="Search builds" onSubmit={submit} style={{ margin: 0, display: "flex" }}>
      <label
        data-ui="header-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: sheet ? "100%" : 280,
          height: sheet ? 44 : 38,
          boxSizing: "border-box",
          padding: "0 12px",
          borderRadius: r.control,
          background: t.field,
          border: `1px solid ${focused ? t.action : t.line}`,
          color: t.text2,
        }}
      >
        <Search size={15} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
        <input
          ref={field}
          type="search"
          aria-label="Search builds"
          placeholder="Search builds, makers, tools"
          className={PLACEHOLDER_CLASS}
          maxLength={SEARCH_MAX}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            background: "transparent",
            border: 0,
            outline: "none",
            flexGrow: 1,
            minWidth: 0,
            fontFamily: FIGTREE,
            fontSize: sheet ? 16 : 13,
            color: t.text,
          }}
        />
        {!sheet && (
          <span
            aria-hidden="true"
            style={{
              fontFamily: DM_MONO,
              fontSize: 10,
              border: `1px solid ${t.line}`,
              borderRadius: 6,
              padding: "0 5px",
            }}
          >
            /
          </span>
        )}
      </label>
    </form>
  );
}

/** The search field wired to the router: submits to the gallery and shows its query while there. */
export function RoutedHeaderSearch(props: Pick<HeaderSearchProps, "variant" | "autoFocus"> & { onDone?: () => void }) {
  const search = useGallerySearch();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const initial = pathname === "/gallery" ? (params.get("q") ?? "") : "";
  return (
    <HeaderSearch
      variant={props.variant}
      autoFocus={props.autoFocus}
      initialValue={initial}
      onSubmit={(query) => {
        const used = search(query);
        if (used) props.onDone?.();
        return used;
      }}
    />
  );
}
