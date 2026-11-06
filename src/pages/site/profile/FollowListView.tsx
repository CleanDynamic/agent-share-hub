/* UX-10 P5b: a person's followers, or the people they follow. PURE: typed props, no fetching.

   One column at the feed's width. The h1 (`@maya's followers` or `People @maya follows`) with the count in `label`. Each person
   is a PlainRow: the avatar at the row size, name and @handle, and their one line in `text2` cut to one line; on the right,
   Follow or Following for everyone but the reader, both drawn as controls: a list of thirty primaries would break the one
   primary a view has (Visual grammar 9). Newest first, 30 a page, Show more as the feed has it. A private
   profile the reader does not follow shows the profile's private sentence; an empty list says so in one line. */

import type { CSSProperties } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { PostControl } from "@/components/post/postControls";
import { PlainRow } from "@/components/vision/PlainRow";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The feed column's width. */
export const FEED_WIDTH = 620;

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

export interface FollowListViewProps {
  handle: string;
  which: FollowListKind;
  /** The list's size; null while it is not known. Hidden at zero. */
  total: number | null;
  status: "loading" | "ready" | "error" | "private";
  people: readonly FollowRowView[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onFollow: (id: string, follow: boolean) => void;
  onRetry: () => void;
}

export const followTitle = (which: FollowListKind, handle: string): string => (which === "followers" ? `@${handle}'s followers` : `People @${handle} follows`);
export const followEmpty = (which: FollowListKind): string => (which === "followers" ? "No followers yet." : "Not following anyone yet.");

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function Person({ person }: { person: FollowRowView }) {
  const name = (
    <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <Avatar size={32} userId={person.id} name={person.name} src={person.avatarUrl} alt="" />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ ...ellipsis, fontWeight: 500, color: t.text }}>
          {person.name}
          {person.handle ? <span style={{ fontWeight: 400, color: t.label }}>{` @${person.handle}`}</span> : null}
        </span>
        {person.line ? <span style={{ ...ellipsis, color: t.text2, fontSize: 12.5 }}>{person.line}</span> : null}
      </span>
    </span>
  );
  return person.handle ? (
    <Link to={`/profile/${person.handle}`} style={{ color: "inherit", textDecoration: "none", minWidth: 0, display: "block" }}>
      {name}
    </Link>
  ) : (
    name
  );
}

export function FollowListView(props: FollowListViewProps) {
  const { which, handle } = props;
  return (
    <section data-testid="follow-list" style={{ width: "100%", maxWidth: FEED_WIDTH, margin: "0 auto", fontFamily: FIGTREE, paddingBottom: 48 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.015em", color: t.text }}>{followTitle(which, handle)}</h1>
      {props.total ? <div style={{ marginTop: 2, fontSize: 12, color: t.label, fontVariantNumeric: "tabular-nums" }}>{props.total.toLocaleString("en-GB")}</div> : null}
      <div style={{ marginTop: 24 }}>
        {props.status === "private" ? (
          <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>{`@${handle}'s profile is private.`}</p>
        ) : props.status === "error" ? (
          <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>
            {"This list didn't load. "}
            <PostControl onClick={props.onRetry}>Retry</PostControl>
          </p>
        ) : props.status === "ready" && props.people.length === 0 ? (
          <p data-testid="follow-empty" style={{ margin: 0, fontSize: 13, color: t.text2 }}>
            {followEmpty(which)}
          </p>
        ) : (
          <ol aria-label={followTitle(which, handle)} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {props.people.map((person, index) => (
              <PlainRow
                key={person.id}
                as="li"
                height={56}
                last={index === props.people.length - 1}
                label={<Person person={person} />}
                value={
                  person.isReader ? undefined : person.readerFollows ? (
                    <PostControl aria-pressed onClick={() => props.onFollow(person.id, false)}>
                      Following
                    </PostControl>
                  ) : (
                    <PostControl onClick={() => props.onFollow(person.id, true)}>Follow</PostControl>
                  )
                }
              />
            ))}
          </ol>
        )}
        {props.hasMore && props.status === "ready" ? (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <PostControl onClick={props.onMore} disabled={props.loadingMore}>
              {props.loadingMore ? "Loading" : "Show more"}
            </PostControl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default FollowListView;
