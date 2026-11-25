/* The profile on a phone (mobile prompt 26, Part A): below 768 only. Three pieces, each drawn by the desktop component's own
   props so the reads, writes, menus and toasts are the desktop's:

     ProfileHeadPhone   the header picture across the full width, 170 tall (the Panel area with the Deep dots at 6px when there is
                        none); the avatar 80, radius 18, a 4px Page ring, over the picture by 40; Follow or Following and Message at
                        the right, level with the avatar's bottom; the name as the h1; "@handle"; the one line; place and joined; the
                        two counts as links.
     ProfileFeedPhone   PhoneTabs (All, Builds, Topics, Replies), then the cards in the Page shade, the pinned one with "Pinned" above
                        its author row.
     ProfileSidePhone   each section after the feed in the owner's order, headed by its fact.

   The top bar (back, More) is the frame's; `ProfileHead` registers More's rows. */

import type { CSSProperties } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { PageEmpty, PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { SectionFact } from "@/components/phone/SectionFact";
import { FeedPost } from "@/components/gallery/FeedPost";
import { PostCard } from "@/components/post/PostCard";
import { PostControl } from "@/components/post/postControls";
import { cropInCell } from "@/components/post/media/cropStyle";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { MapCard } from "@/pages/site/builds/BuildsMapsView";

import { PAGE_TITLE } from "@/components/shell/PageHeader";

import { FEED_COPY, type FeedEntry, type ProfileFeedProps } from "./ProfileFeed";
import { HEAD_COPY, type ProfileHeadProps } from "./ProfileHead";
import { Progress, SIDE_TITLES, sectionHasContent, sideHeading, type ProfileSideProps, type SideSectionKey } from "./ProfileSide";
import { linkHostOf } from "./profileFeedModel";

export const PHONE_HEADER_HEIGHT = 170;
const AVATAR = 80;

/** The fallback: the Panel shade with the Deep dots at a 6px pitch. */
const DOT_GRID: CSSProperties = {
  background: t.surface,
  backgroundImage: `radial-gradient(${t.dotDeep} 1px, transparent 1.2px)`,
  backgroundSize: "6px 6px",
};

const line = (color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color, ...extra });

/* ── the head ── */

/** The 44 round secondary icon button for Message. */
function MessageButton({ onClick }: { onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={HEAD_COPY.message}
      onClick={onClick}
      {...handlers}
      style={{ boxSizing: "border-box", width: TOUCH_MIN, height: TOUCH_MIN, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, border: 0, borderRadius: r.full, background: t.control, color: t.text, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="msg" size={20} />
    </button>
  );
}

/** "240 followers" as a link whose number is 15/600 Text and whose word is Text 3. */
function CountLink({ text, to }: { text: string; to: string }) {
  const at = text.indexOf(" ");
  const number = at < 0 ? text : text.slice(0, at);
  const words = at < 0 ? "" : text.slice(at);
  return (
    <Link to={to} style={{ display: "inline-flex", alignItems: "center", minHeight: TOUCH_MIN, color: t.label, textDecoration: "none" }}>
      <span style={{ fontWeight: 600, color: t.text }}>{number}</span>
      {words}
    </Link>
  );
}

export function ProfileHeadPhone(props: ProfileHeadProps) {
  const { isOwn, following } = props;
  const header = props.header;
  const place = props.meta.find((part) => part.key === "place");
  const joined = props.meta.find((part) => part.key === "joined");
  const counts = props.meta.filter((part) => part.key === "followers" || part.key === "following");
  const whereWhen = [place?.text, joined?.text].filter(Boolean).join(" · ");
  const hideActions = isOwn || props.blocked === "by_them";
  const actions =
    hideActions ? null : props.blocked === "by_me" ? (
      <Button variant="secondary" size={28} onClick={props.onUnblock}>
        {HEAD_COPY.unblock}
      </Button>
    ) : (
      <>
        {following ? (
          <Button variant="secondary" size={28} aria-pressed onClick={props.onUnfollow} disabled={props.followBusy}>
            {HEAD_COPY.following}
          </Button>
        ) : (
          <Button variant="primary" size={28} onClick={props.onFollow} disabled={props.followBusy}>
            {HEAD_COPY.follow}
          </Button>
        )}
        {props.privateLine ? null : <MessageButton onClick={props.onMessage} />}
      </>
    );
  return (
    <header data-testid="profile-head" data-phone="" style={{ boxSizing: "border-box", width: "100%", fontFamily: FIGTREE }}>
      <div
        data-testid="profile-header-picture"
        data-texture={header ? undefined : "dot-grid"}
        style={{ position: "relative", width: "100%", height: PHONE_HEADER_HEIGHT, overflow: "hidden", ...(header ? { background: t.module } : DOT_GRID) }}
      >
        {header ? (
          <img
            src={header.url}
            alt={header.alt ?? ""}
            width={390}
            height={PHONE_HEADER_HEIGHT}
            decoding="async"
            fetchPriority="high"
            style={header.crop ? cropInCell(header.crop, 390 / PHONE_HEADER_HEIGHT) : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
      </div>
      <div style={{ padding: `0 ${PHONE_MARGIN}px` }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: -AVATAR / 2 }}>
          <Avatar size={AVATAR} userId={props.userId} name={props.name} src={props.avatarUrl} alt={props.avatarAlt ?? ""} style={{ borderRadius: 18, boxShadow: `0 0 0 4px ${t.bg}`, flex: "none" }} />
          <div data-testid="profile-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {actions}
          </div>
        </div>
        <h1 style={{ ...PAGE_TITLE, margin: "12px 0 0", fontFamily: FIGTREE, fontSize: 24, lineHeight: "28px", fontWeight: 600, letterSpacing: "-0.02em", color: t.text, overflowWrap: "anywhere" }}>{props.name}</h1>
        {props.handle ? <p style={line(t.label)}>{`@${props.handle}`}</p> : null}
        {props.privateLine ? (
          <p data-testid="profile-private" style={line(t.text2, { marginTop: 12 })}>
            {props.privateLine}
          </p>
        ) : (
          <>
            {props.oneLine || props.links.length > 0 ? (
              <p data-testid="profile-one-line" style={line(t.text, { marginTop: 8, overflowWrap: "anywhere" })}>
                {props.oneLine}
                {props.links.map((link, index) => (
                  <span key={link}>
                    {props.oneLine || index > 0 ? " " : null}
                    <a href={link} rel="me noopener" target="_blank" style={{ color: t.text, textDecoration: "underline", textUnderlineOffset: 3 }}>
                      {linkHostOf(link)}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
            {whereWhen ? <p data-testid="profile-meta" style={line(t.label, { marginTop: 8 })}>{whereWhen}</p> : null}
            {counts.length > 0 ? (
              <div data-testid="profile-counts" style={{ ...line(t.label), display: "flex", gap: 16, fontVariantNumeric: "tabular-nums" }}>
                {counts.map((part) => (part.to ? <CountLink key={part.key} text={part.text} to={part.to} /> : <span key={part.key}>{part.text}</span>))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}

/* ── the feed ── */

function PhoneItemMenu({ entry, canPin, onPin, onUnpin, onDisplay }: { entry: FeedEntry; canPin: boolean; onPin: () => void; onUnpin: () => void; onDisplay: (display: "first_post" | "map") => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PostControl round aria-label={FEED_COPY.menu(entry.heading)}>···</PostControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entry.pinned ? <DropdownMenuItem onSelect={onUnpin}>{FEED_COPY.unpin}</DropdownMenuItem> : canPin ? <DropdownMenuItem onSelect={onPin}>{FEED_COPY.pin}</DropdownMenuItem> : null}
        {entry.kind === "build" ? (
          <>
            <DropdownMenuItem disabled={entry.display === "first_post"} onSelect={() => onDisplay("first_post")}>{FEED_COPY.asPost}</DropdownMenuItem>
            <DropdownMenuItem disabled={entry.display === "map"} onSelect={() => onDisplay("map")}>{FEED_COPY.asMap}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PhoneCard({ entry, now }: { entry: FeedEntry; now: number }) {
  switch (entry.kind) {
    case "build":
      return entry.display === "map" ? <MapCard card={entry.map} direction="horizontal" index={0} /> : <FeedPost {...entry.post} phoneFeed now={now} />;
    case "topic":
    case "reply":
      return <PostCard card={entry.card} headingLevel={2} phone="home" />;
    case "repro_note":
      return null;
  }
}

export function ProfileFeedPhone(props: ProfileFeedProps) {
  const entries = props.entries.filter((entry) => entry.kind !== "repro_note");
  const small: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px" };
  return (
    <section aria-label="Feed" data-testid="profile-feed" data-phone="" style={{ fontFamily: FIGTREE, minWidth: 0, marginTop: 8 }}>
      {props.options.length > 1 ? <PhoneTabs label={FEED_COPY.filter} tabs={props.options} value={props.filter} onChange={props.onFilter} /> : null}
      {props.status === "error" && entries.length === 0 ? (
        <div style={{ padding: PHONE_MARGIN }}>
          <PageState read={props.read ?? readOf("error", undefined, props.onRetry)} thing="the feed" region="Feed" skeleton={null}>
            {() => null}
          </PageState>
        </div>
      ) : props.status === "ready" && entries.length === 0 ? (
        <div style={{ padding: PHONE_MARGIN }}>
          <PageEmpty phoneList line={props.empty.line} action={props.empty.action ? { label: props.empty.action.label, href: props.empty.action.to } : undefined} testId="profile-feed-empty" />
        </div>
      ) : (
        <div role="feed" aria-busy={props.status === "loading" || props.loadingMore}>
          {entries.map((entry, index) => (
            <article
              key={entry.key}
              aria-label={entry.heading}
              aria-posinset={index + 1}
              aria-setsize={props.hasMore ? -1 : entries.length}
              data-kind={entry.kind}
              data-testid="profile-feed-item"
              style={{ padding: `12px ${PHONE_MARGIN}px`, boxSizing: "border-box", contentVisibility: index < 3 ? undefined : "auto", containIntrinsicSize: index < 3 ? undefined : "auto 320px" }}
            >
              {entry.pinned || (entry.kind === "build" && entry.rebuiltFrom) || entry.kind === "reply" || props.isOwn ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: props.isOwn ? TOUCH_MIN : undefined, paddingBottom: 4 }}>
                  <span style={{ ...small, display: "flex", flexDirection: "column", gap: 2, minWidth: 0, overflowWrap: "anywhere", color: t.text2 }}>
                    {entry.pinned ? <span data-testid="profile-pinned">{FEED_COPY.pinned}</span> : null}
                    {entry.kind === "build" && entry.rebuiltFrom ? <span style={{ color: t.label }}>{entry.rebuiltFrom}</span> : null}
                    {entry.kind === "reply" ? (
                      <Link to={entry.repliedTo.to} data-testid="profile-replied-to" style={{ color: t.label, textDecoration: "none" }}>
                        {entry.repliedTo.text}
                      </Link>
                    ) : null}
                  </span>
                  {props.isOwn ? (
                    <PhoneItemMenu entry={entry} canPin={props.canPin} onPin={() => props.onPin(entry)} onUnpin={() => props.onUnpin(entry)} onDisplay={(display) => props.onDisplay(entry.id, display)} />
                  ) : null}
                </div>
              ) : null}
              <PhoneCard entry={entry} now={props.now} />
            </article>
          ))}
        </div>
      )}
      {props.hasMore && entries.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: PHONE_MARGIN }}>
          <Button variant="secondary" size={44} onClick={props.onMore} disabled={props.loadingMore}>
            {props.loadingMore ? FEED_COPY.loadingMore : FEED_COPY.more}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/* ── the side sections ── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} data-testid={`profile-side-${id}`}>
      <SectionFact fact={title} />
      {children}
    </section>
  );
}

function PhoneSection({ id, props }: { id: SideSectionKey; props: ProfileSideProps }) {
  switch (id) {
    case "about":
      return (
        <Section id="about" title={SIDE_TITLES.about}>
          <p style={{ ...line(t.text), padding: `0 ${PHONE_MARGIN}px`, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{props.about?.trim()}</p>
        </Section>
      );
    case "spaces":
      return (
        <Section id="spaces" title={sideHeading("spaces", props)}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {props.spaces.map((space) => (
              <li key={space.slug}>
                <PhoneRow title={space.name} to={`/openbuilds/spaces/${space.slug}`} trail={{ kind: "node", node: <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{space.standing}</span> }} />
              </li>
            ))}
          </ul>
        </Section>
      );
    case "others":
      return (
        <Section id="others" title={SIDE_TITLES.others}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {props.others.map((row) => (
              <li key={row.key}>
                <PhoneRow title={row.text} to={row.to} trail={{ kind: "chevron" }} />
              </li>
            ))}
          </ul>
        </Section>
      );
    case "collections":
      return (
        <Section id="collections" title={sideHeading("collections", props)}>
          <div className="bg-scroll-row" style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", padding: `0 ${PHONE_MARGIN}px 8px` }}>
            {props.collections.map((tile) => (
              <Link key={tile.key} to={tile.to} data-testid="profile-collection" style={{ flex: "0 0 156px", display: "flex", flexDirection: "column", gap: 8, padding: 8, boxSizing: "border-box", background: t.module, borderRadius: r.card, textDecoration: "none", color: t.text, minWidth: 0 }}>
                <div style={{ height: 88, borderRadius: r.media, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 }}>
                  {tile.covers.slice(0, 4).map((cover, index) => (
                    <div key={index} style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>{cover}</div>
                  ))}
                </div>
                <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tile.title}</span>
                <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{tile.count}</span>
              </Link>
            ))}
          </div>
        </Section>
      );
    case "marks":
      return (
        <Section id="marks" title={SIDE_TITLES.marks}>
          <p style={{ ...line(t.text2), padding: `0 ${PHONE_MARGIN}px` }}>{props.marks.join(" · ")}</p>
        </Section>
      );
  }
}

export function ProfileSidePhone(props: ProfileSideProps) {
  const sections = props.order.filter((section) => !section.hidden && sectionHasContent(section.key, props));
  if (!props.progress && sections.length === 0) return null;
  return (
    <aside aria-label="About this person" data-testid="profile-side" data-phone="" style={{ minWidth: 0, paddingBottom: 24 }}>
      {sections.map((section) => (
        <PhoneSection key={section.key} id={section.key} props={props} />
      ))}
      {props.progress ? (
        <div style={{ paddingTop: 8 }}>
          <Progress progress={props.progress} />
        </div>
      ) : null}
    </aside>
  );
}
