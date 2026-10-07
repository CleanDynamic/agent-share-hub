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
//
// DENSER SINCE UI-P55: the bar's field is 31 tall (38 before), 0 9px inside, a 6px
// gap, its text 12px. The sheet's field keeps 44 and 16px: a touch target, and
// an input on a phone is never under 16.

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { normaliseQuery, SEARCH_MAX } from "@/lib/build/search";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/* index.css gives every <input> a `--recess` fill, a 1px border and a focus
   outline, all `!important`, which no inline style can beat. This field is a
   transparent input inside a drawn box (the label), so those are switched off
   with Tailwind's own important utilities — generated utilities, not new CSS
   classes — and the box carries the focus ring instead. The placeholder is the
   kit's `--text2`, a pseudo-element no inline style reaches. */
const INPUT_CLASS =
  "placeholder:text-[color:var(--text2)] !bg-transparent !border-0 focus-visible:!outline-none focus-visible:!border-0";

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
  /** `bar` is the desktop header's 280×31 field with the "/" hint; `sheet` is the phone's full-width 44px field at 16px. */
  variant?: "bar" | "sheet";
  /** Called with the raw text on submit. Return true when it was used (the sheet closes on it). */
  onSubmit: (query: string) => boolean | void;
  /** The query to show; the gallery's own while on /gallery. */
  initialValue?: string;
  /** "/" focuses the field. On for the header, off for the sheet. */
  shortcut?: boolean;
  autoFocus?: boolean;
  /** `bar` width in px. Omit to let the field shrink (min 140, up to 280) when the header is tight. */
  width?: number;
}

export function HeaderSearch({
  variant = "bar",
  onSubmit,
  initialValue = "",
  shortcut = variant === "bar",
  autoFocus = false,
  width,
}: HeaderSearchProps) {
  const [value, setValue] = useState(initialValue);
  const field = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

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
    <form
      role="search"
      aria-label="Search builds"
      onSubmit={submit}
      style={{ margin: 0, display: "flex", minWidth: sheet ? undefined : width ? undefined : 140, flex: sheet || width ? undefined : "0 1 280px" }}
    >
      <label
        data-ui="header-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: sheet ? "100%" : (width ?? "100%"),
          height: sheet ? 44 : 31,
          boxSizing: "border-box",
          padding: "0 9px",
          borderRadius: r.control,
          background: t.field,
          border: `1px solid ${focused ? t.action : t.line}`,
          color: t.text2,
          /* The input's size is set here, on its box: above 768px index.css makes
             every input inherit its font size, so the input's own 12px never
             applied and the field drew the page's 16. */
          fontSize: sheet ? 16 : 12,
          ...ring(focusVisible),
        }}
      >
        <Search size={15} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
        <input
          ref={field}
          type="search"
          aria-label="Search builds"
          /* The 200px field (UI-P39) has room for the short form only. */
          placeholder={!sheet && width !== undefined && width < 280 ? "Search builds" : "Search builds, makers, tools"}
          className={INPUT_CLASS}
          maxLength={SEARCH_MAX}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => {
            setFocused(true);
            // Where :focus-visible is unsupported the ring is shown rather than hidden.
            let visible = true;
            try {
              visible = event.currentTarget.matches(":focus-visible");
            } catch {
              /* keep the ring */
            }
            setFocusVisible(visible);
          }}
          onBlur={() => {
            setFocused(false);
            setFocusVisible(false);
          }}
          style={{
            background: "transparent",
            border: 0,
            outline: "none",
            flexGrow: 1,
            minWidth: 0,
            fontFamily: FIGTREE,
            fontSize: sheet ? 16 : 12,
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
