/* Followers and Following on a phone (mobile prompt 26, Part B): below 768 only. The top bar (back, the person's name) is the
   frame's, registered by the page. Under it, on the Page shade with no panel: two equal tabs that are the facts ("240 followers",
   "88 following", each going to its route), then the people as rows: avatar 40 at radius 9, the name 15/600 with "@handle" 15
   Text 3 after it, their one line 13 Text 3, and at the right Follow (small, Inverse), Following (small, secondary) or "You".
   Everything it does goes through `FollowListView`'s own props, so the reads, the writes and their rollbacks are the desktop's. */

import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PageState } from "@/components/pagestate/PageState";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { PHONE_MARGIN, PHONE_ROW } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { WAY_OUT } from "@/lib/copy/copy";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { PANEL_GAP } from "@/components/shell/pageGrid";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { followEmpty, followFact, followTitle, type FollowListKind, type FollowListViewProps, type FollowRowView } from "./FollowListView";

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const count = (n: number) => n.toLocaleString("en-GB");

function Person({ person, onFollow }: { person: FollowRowView; onFollow: (id: string, follow: boolean) => void }) {
  const body = (
    <>
      <Avatar size={40} userId={person.id} name={person.name} src={person.avatarUrl} alt="" style={{ borderRadius: 9 }} />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span style={{ ...ellipsis, fontSize: 15, lineHeight: "20px" }}>
          <span style={{ fontWeight: 600, color: t.text }}>{person.name}</span>
          {person.handle ? <span style={{ fontWeight: 400, color: t.label }}>{` @${person.handle}`}</span> : null}
        </span>
        {person.line ? <span style={{ ...ellipsis, fontSize: 13, lineHeight: "16px", color: t.label }}>{person.line}</span> : null}
      </span>
    </>
  );
  const lead: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 auto", color: "inherit", textDecoration: "none", minHeight: PHONE_ROW - 16 };
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 12, minHeight: PHONE_ROW, padding: `8px ${PHONE_MARGIN}px`, boxSizing: "border-box" }}>
      {person.handle ? (
        <Link to={`/profile/${person.handle}`} style={lead}>
          {body}
        </Link>
      ) : (
        <span style={lead}>{body}</span>
      )}
      {person.isReader ? (
        <span style={{ fontSize: 13, lineHeight: "16px", color: t.label, flex: "none" }}>You</span>
      ) : person.readerFollows ? (
        <Button variant="secondary" size={28} aria-pressed onClick={() => onFollow(person.id, false)}>
          Following
        </Button>
      ) : (
        <Button variant="primary" size={28} onClick={() => onFollow(person.id, true)}>
          Follow
        </Button>
      )}
    </li>
  );
}

export function FollowListPhone(props: FollowListViewProps) {
  useColumnPanels(true);
  const navigate = useNavigate();
  const { which, handle, owner } = props;
  const followers = which === "followers" ? props.total : (owner?.otherCount ?? null);
  const following = which === "following" ? props.total : (owner?.otherCount ?? null);
  const tabs = [
    { value: "followers" as const, label: followers === null ? "Followers" : `${count(followers)} ${followers === 1 ? "follower" : "followers"}` },
    { value: "following" as const, label: following === null ? "Following" : `${count(following)} following` },
  ];
  const onTab = (next: FollowListKind) => {
    if (next !== which) navigate(`/profile/${handle}/${next}`);
  };
  return (
    <div data-testid="follow-list-phone" style={{ margin: `0 -${PANEL_GAP}px`, paddingBottom: 24, fontFamily: FIGTREE, minWidth: 0 }}>
      {/* The tabs are the facts; the page's h1 says the same thing for screen readers. */}
      <h1 className="sr-only">{followFact(which, handle, props.total)}</h1>
      <PhoneTabs<FollowListKind> label="Followers and following" tabs={tabs} value={which} onChange={onTab} equal />
      <section data-testid="follow-list" aria-label={followTitle(which, handle)}>
        <PageState
          read={props.read}
          thing="this list"
          region={followTitle(which, handle)}
          style={{ padding: PHONE_MARGIN }}
          skeleton={
            <LoadingRegion what={which === "followers" ? "the followers" : "who they follow"} announce style={{ padding: `8px ${PHONE_MARGIN}px` }}>
              {[0, 1, 2, 3, 4].map((at) => (
                <Skeleton key={at} height={40} radius={9} style={{ marginBottom: 16 }} />
              ))}
            </LoadingRegion>
          }
          notFound={{ when: ([profile]) => profile === null, kind: "profile", way: WAY_OUT.browseBuilds }}
          empty={{ when: () => !props.locked && props.people.length === 0, line: followEmpty(which), testId: "follow-empty", phoneList: true }}
        >
          {() =>
            props.locked ? (
              <p style={{ margin: 0, padding: PHONE_MARGIN, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{`@${handle}'s profile is private.`}</p>
            ) : (
              <ol aria-label={followTitle(which, handle)} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {props.people.map((person) => (
                  <Person key={person.id} person={person} onFollow={props.onFollow} />
                ))}
              </ol>
            )
          }
        </PageState>
        {props.hasMore && !props.locked && props.people.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: PHONE_MARGIN }}>
            <Button variant="secondary" size={44} onClick={props.onMore} disabled={props.loadingMore}>
              {props.loadingMore ? "Loading" : "Show more"}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default FollowListPhone;
