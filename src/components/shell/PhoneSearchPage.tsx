// The phone's search page (prompt 19), pushed from the top bar's Search: full screen, entering from the right. Its own top bar
// is the field (40 tall, radius 20, on Card, a 2px Mint inset while focused, the search icon at 18, 16px text) and "Cancel"
// at the right. Under it, the results grouped by kind with the count as the heading ("2 builds"), each group as `PhoneRow`s.
//
// The search is the repo's own: the query is tidied by `normaliseQuery`, matched by `listGallery({ query })` (which calls
// `search_build_ids`), and Enter opens /builds?q=… exactly as the desktop field does. Only builds are searchable today, so
// builds are the only group; a kind with nothing to show draws no heading. A dialog, so focus stays inside, Escape closes, and
// focus returns to the Search button.

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { listGallery } from "@/lib/build/gallery";
import { normaliseQuery, SEARCH_MAX } from "@/lib/build/search";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_MARGIN } from "./chromeSize";
import { useGallerySearch } from "./HeaderSearch";

/** The results page size: one screenful and a little more. */
const RESULTS = 20;
/** Typing waits this long before a request is made. */
const TYPE_WAIT_MS = 250;

/** The page's content. It mounts when the page opens, so nothing is asked of the database before then. */
function SearchBody({ open, onOpenChange, input }: { open: boolean; onOpenChange: (open: boolean) => void; input: RefObject<HTMLInputElement | null> }) {
  const submitSearch = useGallerySearch();
  const [value, setValue] = useState("");
  const [typed, setTyped] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const cancel = useInteractive<HTMLButtonElement>();

  useEffect(() => {
    const id = window.setTimeout(() => setTyped(normaliseQuery(value)), TYPE_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [value]);

  const results = useQuery({
    queryKey: ["phone-search", typed],
    queryFn: () => listGallery({ query: typed ?? undefined, limit: RESULTS }),
    enabled: open && typed !== null,
    staleTime: 30_000,
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitSearch(value)) onOpenChange(false);
  };

  const builds = typed !== null ? (results.data?.builds ?? []) : [];
  const count = results.data?.total ?? builds.length;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: `calc(env(safe-area-inset-top) + 6px) 4px 6px ${PHONE_MARGIN}px` }}>
        <form role="search" aria-label="Search builds" onSubmit={onSubmit} style={{ margin: 0, flex: 1, minWidth: 0 }}>
          <label
            data-ui="phone-search-field"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              boxSizing: "border-box",
              padding: "0 14px",
              borderRadius: 20,
              background: t.module,
              boxShadow: focused ? `inset 0 0 0 2px ${t.brandAccent}` : "none",
              color: t.label,
            }}
          >
            <MobileIcon name="search" size={18} />
            <input
              ref={input}
              type="search"
              aria-label="Search builds"
              placeholder="Search builds, makers, tools"
              maxLength={SEARCH_MAX}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="placeholder:text-[color:var(--label)] !bg-transparent !border-0 focus-visible:!outline-none focus-visible:!border-0"
              style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: "none", fontFamily: FIGTREE, fontSize: 16, lineHeight: "20px", color: t.text }}
            />
          </label>
        </form>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          {...cancel.handlers}
          style={{
            flexShrink: 0,
            minWidth: TOUCH_MIN,
            height: TOUCH_MIN,
            padding: "0 12px",
            border: 0,
            borderRadius: 22,
            background: "transparent",
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            ...ring(cancel.state.focusVisible),
          }}
        >
          Cancel
        </button>
      </div>
      <div aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {typed !== null && results.isSuccess ? (
          <section aria-label={`${count} ${count === 1 ? "build" : "builds"}`}>
            <h2 style={{ margin: 0, padding: `16px ${PHONE_MARGIN}px 4px`, fontSize: 20, fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em", color: t.text }}>
              {count} {count === 1 ? "build" : "builds"}
            </h2>
            {builds.map((build) => (
              <PhoneRow key={build.id} title={build.title} line={build.outcome ?? undefined} to={`/b2/${build.slug}`} trail={{ kind: "chevron" }} />
            ))}
          </section>
        ) : null}
      </div>
    </>
  );
}

export function PhoneSearchPage({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const focus = useWindowFocus(open);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          data-testid="phone-search"
          data-motion="push"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            input.current?.focus();
          }}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 45,
            display: "flex",
            flexDirection: "column",
            background: t.bg,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <Dialog.Title style={VISUALLY_HIDDEN}>Search</Dialog.Title>
          <SearchBody open={open} onOpenChange={onOpenChange} input={input} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PhoneSearchPage;
