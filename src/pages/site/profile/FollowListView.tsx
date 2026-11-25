/* UX-10 P5b, restyled by Synth 12 Part B: a person's followers, or the people they follow. PURE: typed props, no fetching.

   Two panels inside a 980 container, `300px minmax(0, 1fr)`. Left: the person (avatar 56 radius 12, the name in Geist Serif
   17, "@maya" 15 Text 3; the whole block links back to the profile), then the other list's count as a link ("88 following").
   761 to 1100 the left panel is a row above the list; 760 and below, one column.

   Main: the h1 is the fact, 20/600 ("240 followers" or "88 following"). Each person: avatar 40, name 15/600 and "@handle"
   15 Text 3, their one line 15 Text 2 cut to one line; at the right Follow or Following as small secondary buttons, and
   "You" on the reader's own row. 30 a page, then Show more. A private profile the reader does not follow says
   "@maya's profile is private."; an empty list says so in one line. */

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT } from "@/lib/copy/copy";
import type { CSSProperties } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { PostControl } from "@/components/post/postControls";
import { PANEL_GAP } from "@/components/shell/pageGrid";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, SENTIENT } from "@/lib/theme/type";

import { FollowListPhone } from "./FollowListPhone";

/** The page's container. */
export const FEED_WIDTH = 980;

export type FollowListKind = "followers" | "following";

export interface FollowRowView {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  line: string | null;
  readerFollows: boolean;
  /** The reader themselves: no button. */
  isReader: boolean;
}

/** The person whose list this is, for the left panel; null until the profile has arrived. */
export interface FollowOwnerView {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** The other list's size: following on the followers page, followers on the following page. */
  otherCount: number;
}

export interface FollowListViewProps {
  handle: string;
  owner?: FollowOwnerView | null;
  which: FollowListKind;
  /** The list's size; null while it is not known. Hidden at zero. */
  total: number | null;
  /** G4: the profile and the list, read together: PageState draws loading, failed, not found (G33) and empty. */
  read: readonly ReadLike[];
  /** The profile answered, and it is private to this reader: said in a sentence, the list not drawn. */
  locked: boolean;
  people: readonly FollowRowView[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onFollow: (id: string, follow: boolean) => void;
}

export const followTitle = (which: FollowListKind, handle: string): string => (which === "followers" ? `@${handle}'s followers` : `People @${handle} follows`);
/** The h1: "240 followers" or "88 following"; the title while the count is not known. */
export const followFact = (which: FollowListKind, handle: string, total: number | null): string =>
  total === null ? followTitle(which, handle) : which === "followers" ? `${total.toLocaleString("en-GB")} ${total === 1 ? "follower" : "followers"}` : `${total.toLocaleString("en-GB")} following`;
export const followEmpty = (which: FollowListKind): string => (which === "followers" ? "No followers yet." : "Not following anyone yet.");

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const panel: CSSProperties = { background: t.surface, borderRadius: 12, padding: 16, boxSizing: "border-box", minWidth: 0 };

function Person({ person }: { person: FollowRowView }) {
  const name = (
    <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <Avatar size={40} userId={person.id} name={person.name} src={person.avatarUrl} alt="" />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, fontSize: 15, lineHeight: "20px" }}>
        <span style={ellipsis}>
          <span style={{ fontWeight: 600, color: t.text }}>{person.name}</span>
          {person.handle ? <span style={{ fontWeight: 400, color: t.label }}>{` @${person.handle}`}</span> : null}
        </span>
        {person.line ? <span style={{ ...ellipsis, color: t.text2 }}>{person.line}</span> : null}
      </span>
    </span>
  );
  return person.handle ? (
    <Link to={`/profile/${person.handle}`} style={{ color: "inherit", textDecoration: "none", minWidth: 0, display: "block", flex: "1 1 auto" }}>
      {name}
    </Link>
  ) : (
    <span style={{ minWidth: 0, flex: "1 1 auto" }}>{name}</span>
  );
}

function Owner({ owner, handle, which, row }: { owner: FollowOwnerView | null | undefined; handle: string; which: FollowListKind; row: boolean }) {
  const other = which === "followers" ? "following" : "followers";
  const otherText = owner ? (which === "followers" ? `${owner.otherCount.toLocaleString("en-GB")} following` : `${owner.otherCount.toLocaleString("en-GB")} ${owner.otherCount === 1 ? "follower" : "followers"}`) : null;
  return (
    <aside aria-label={`@${handle}`} data-testid="follow-owner" style={{ ...panel, display: "flex", flexDirection: row ? "row" : "column", alignItems: row ? "center" : "flex-start", justifyContent: "space-between", gap: 12 }}>
      <Link to={`/profile/${handle}`} style={{ display: "flex", flexDirection: row ? "row" : "column", alignItems: row ? "center" : "flex-start", gap: 12, color: "inherit", textDecoration: "none", minWidth: 0 }}>
        {owner ? <Avatar size={56} userId={owner.id} name={owner.name} src={owner.avatarUrl} alt="" style={{ borderRadius: 12 }} /> : null}
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {owner ? <span style={{ ...ellipsis, fontFamily: SENTIENT, fontSize: 17, lineHeight: "24px", color: t.text }}>{owner.name}</span> : null}
          <span style={{ ...ellipsis, fontSize: 15, lineHeight: "20px", color: t.label }}>{`@${handle}`}</span>
        </span>
      </Link>
      {otherText ? (
        <Link to={`/profile/${handle}/${other}`} style={{ fontSize: 15, lineHeight: "20px", color: t.text, textDecoration: "underline", textUnderlineOffset: 3 }}>
          {otherText}
        </Link>
      ) : null}
    </aside>
  );
}

/** Two panels from 1101; 761 to 1100 the person is a row above the list; 760 and below, one column. */
const TWO_PANELS_MIN = 1101;

function FollowListDesktop(props: FollowListViewProps) {
  useColumnPanels(true);
  const two = useMinWidth(TWO_PANELS_MIN);
  const between = useMinWidth(761);
  const { which, handle } = props;
  const main = (
    <section data-testid="follow-list" style={{ ...panel, paddingBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text, fontVariantNumeric: "tabular-nums" }}>{followFact(which, handle, props.total)}</h1>
      <div style={{ marginTop: 12 }}>
        <PageState
          read={props.read}
          thing="this list"
          region={followTitle(which, handle)}
          skeleton={
            <LoadingRegion what={which === "followers" ? "the followers" : "who they follow"} announce>
              {[0, 1, 2, 3, 4].map((at) => (
                <Skeleton key={at} height={44} radius={10} style={{ marginBottom: 12 }} />
              ))}
            </LoadingRegion>
          }
          notFound={{ when: ([profile]) => profile === null, kind: "profile", way: WAY_OUT.browseBuilds }}
          empty={{ when: () => !props.locked && props.people.length === 0, line: followEmpty(which), testId: "follow-empty" }}
        >
          {() =>
            props.locked ? (
              <p style={{ margin: 0, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{`@${handle}'s profile is private.`}</p>
            ) : (
              <ol aria-label={followTitle(which, handle)} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {props.people.map((person) => (
                  <li key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "8px 0", boxSizing: "border-box" }}>
                    <Person person={person} />
                    {person.isReader ? (
                      <span style={{ fontSize: 13, lineHeight: "16px", color: t.label, flex: "none" }}>You</span>
                    ) : person.readerFollows ? (
                      <PostControl aria-pressed onClick={() => props.onFollow(person.id, false)}>
                        Following
                      </PostControl>
                    ) : (
                      <PostControl onClick={() => props.onFollow(person.id, true)}>Follow</PostControl>
                    )}
                  </li>
                ))}
              </ol>
            )
          }
        </PageState>
        {props.hasMore && !props.locked && props.people.length > 0 ? (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <PostControl onClick={props.onMore} disabled={props.loadingMore}>
              {props.loadingMore ? "Loading" : "Show more"}
            </PostControl>
          </div>
        ) : null}
      </div>
    </section>
  );
  return (
    <div
      style={{
        width: "100%",
        maxWidth: FEED_WIDTH,
        margin: "0 auto",
        fontFamily: FIGTREE,
        paddingBottom: 48,
        ...(two ? { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", columnGap: PANEL_GAP, alignItems: "start" } : { display: "flex", flexDirection: "column", gap: PANEL_GAP }),
      }}
    >
      <Owner owner={props.owner} handle={handle} which={which} row={!two && between} />
      {main}
    </div>
  );
}

/** Below 768 the list is the phone's own page (`FollowListPhone`); from 768 up it is the two panels above. */
export function FollowListView(props: FollowListViewProps) {
  const phone = useIsPhone();
  return phone ? <FollowListPhone {...props} /> : <FollowListDesktop {...props} />;
}

export default FollowListView;
