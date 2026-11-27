// The phone's search page (prompt 19), pushed from the top bar's Search: full screen, entering from the right. Its own top bar
// is the field (40 tall, radius 20, on Card, a 2px Mint inset while focused, the search icon at 18, 16px text) and "Cancel"
// at the right. Under it, the results grouped by kind with the count as the heading ("2 builds", "1 topic", "3 people"), each
// group as `PhoneRow`s.
//
// The search is the repo's own: the query is tidied by `normaliseQuery`; builds are matched by `listGallery({ query })` (which
// calls `search_build_ids`), topics and people by `lib/search/phoneSearch.ts`. Enter opens /builds?q=... exactly as the desktop
// field does. A kind with no match draws no heading, unless nothing matched at all ("0 builds"). A dialog, so focus stays
// inside, Escape closes, and focus returns to the Search button.

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { listGallery } from "@/lib/build/gallery";
import { listBusySpaces, postKey } from "@/lib/openbuilds";
import { normaliseQuery, SEARCH_MAX } from "@/lib/build/search";
import { groupHeading, PHONE_SEARCH_LIMIT, searchPeople, searchTopics } from "@/lib/search/phoneSearch";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_MARGIN } from "./chromeSize";
import { useGallerySearch } from "./HeaderSearch";

/** One kind of result: the count as the heading, then its rows. */
function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section aria-label={heading}>
      <h2 style={{ margin: 0, padding: `16px ${PHONE_MARGIN}px 4px`, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{heading}</h2>
      {children}
    </section>
  );
}

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

  const on = open && typed !== null;
  const builds = useQuery({
    queryKey: ["phone-search", "builds", typed],
    queryFn: () => listGallery({ query: typed ?? undefined, limit: PHONE_SEARCH_LIMIT }),
    enabled: on,
    staleTime: 30_000,
  });
  const topics = useQuery({ queryKey: ["phone-search", "topics", typed], queryFn: () => searchTopics(typed as string), enabled: on, staleTime: 30_000 });
  const people = useQuery({ queryKey: ["phone-search", "people", typed], queryFn: () => searchPeople(typed as string), enabled: on, staleTime: 30_000 });

  // Prompt 21: with the field empty, the spaces with the most new posts this week (the desktop right panel's own read).
  const empty = value.trim() === "";
  const busy = useQuery({ queryKey: postKey("listBusySpaces"), queryFn: () => listBusySpaces({ limit: 8 }), enabled: open && empty, staleTime: 30_000 });
  const busyRows = empty ? (busy.data ?? []) : [];
  // The group gives way to the results once the reader types (and, with nothing busy, they stay as they were).
  const showResults = !empty || busyRows.length === 0;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitSearch(value)) onOpenChange(false);
  };

  const buildRows = typed !== null ? (builds.data?.builds ?? []) : [];
  const buildCount = builds.data?.total ?? buildRows.length;
  const topicRows = typed !== null ? (topics.data?.rows ?? []) : [];
  const topicCount = topics.data?.total ?? topicRows.length;
  const peopleRows = typed !== null ? (people.data?.rows ?? []) : [];
  const peopleCount = people.data?.total ?? peopleRows.length;
  const settled = typed !== null && !builds.isPending && !topics.isPending && !people.isPending;
  const none = settled && buildRows.length + topicRows.length + peopleRows.length === 0;

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
        {busyRows.length > 0 ? (
          <section aria-label="Most new posts this week" data-testid="search-busy-spaces">
            <h2 style={{ margin: 0, padding: `16px ${PHONE_MARGIN}px 4px`, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{groupHeading(busyRows.length, "space", "spaces")}</h2>
            {busyRows.map((entry) => (
              <PhoneRow
                key={entry.space.id}
                title={entry.space.name}
                line={`${entry.recent} new ${entry.recent === 1 ? "post" : "posts"} this week`}
                to={`/openbuilds/spaces/${entry.space.slug}`}
                trail={{ kind: "chevron" }}
              />
            ))}
          </section>
        ) : null}
        {showResults && (buildRows.length > 0 || none) ? (
          <Group heading={groupHeading(buildCount, "build", "builds")}>
            {buildRows.map((build) => (
              <PhoneRow key={build.id} title={build.title} line={build.outcome ?? undefined} to={`/b2/${build.slug}`} trail={{ kind: "chevron" }} />
            ))}
          </Group>
        ) : null}
        {showResults && topicRows.length > 0 ? (
          <Group heading={groupHeading(topicCount, "topic", "topics")}>
            {topicRows.map((topic) => (
              <PhoneRow key={topic.id} title={topic.title} line={topic.by ?? undefined} to={`/openbuilds/topics/${topic.id}`} trail={{ kind: "chevron" }} />
            ))}
          </Group>
        ) : null}
        {showResults && peopleRows.length > 0 ? (
          <Group heading={groupHeading(peopleCount, "person", "people")}>
            {peopleRows.map((person) => (
              <PhoneRow
                key={person.id}
                title={person.name}
                line={`@${person.handle}`}
                to={`/profile/${person.handle}`}
                lead={{ kind: "avatar", node: <Avatar userId={person.id} name={person.name} src={person.avatarUrl} alt="" size={40} /> }}
                trail={{ kind: "chevron" }}
              />
            ))}
          </Group>
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
