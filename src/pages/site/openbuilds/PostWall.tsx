/* UX-06 Part 5: the Wall, every build in a post's replies side by side. PURE: typed props, no fetching, no router hooks but `Link`.

   Cards in `useCardColumns`' columns (three, two below 1101, one below 761), 24 apart. A published build is the module box: no
   picture area (no Builds view draws a cover on disk to copy, so none is drawn, as UX-03 Part 2 decided for a build without one),
   the title 14/500, `Avatar` 20 with the handle, `Claude Code · Rebuilt from @maya` (or `· new build`) in `--label`, the reproduction
   wording (`Plaque`, as the post card draws it), `Pinned`, and Open, Reply, Rebuild. A build attached from a draft is a
   `DashedSlot` box: `In progress · 2 sessions` and `updated 20m ago`.

   Under the cards, the way in: `Built something for this? Reply with a build.` and the view's one primary, `Reply with a build`,
   which opens the reply box with the picker at Build. While that box is open it carries the primary. */

import type { CSSProperties, ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Plaque } from "@/components/brand/Plaque";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { useCardColumns } from "@/pages/site/builds/BuildsFrame";

import type { WallCard } from "./postModel";

export const WALL_WAY_IN = "Built something for this? Reply with a build.";

export interface PostWallProps {
  cards: readonly WallCard[];
  onReply: (replyId: string) => void;
  onReplyWithBuild: () => void;
  /** The reply box, when Reply with a build opened it. */
  box?: ReactNode;
  /** Part 6: the Line up steps control and its table. */
  lineUp?: ReactNode;
}

const line = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "16px", color, ...extra });

/** Off-screen cards are laid out only when they come near. */
const offScreen: CSSProperties = { contentVisibility: "auto", containIntrinsicSize: "auto 200px" };

function Who({ author }: { author: WallCard["author"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <Avatar size={20} userId={author.id} name={author.name} src={author.avatarUrl} />
      <span style={line(12.5, t.text2)}>{author.handle ? `@${author.handle}` : author.name}</span>
    </div>
  );
}

function Card({ card, onReply }: { card: WallCard; onReply: (replyId: string) => void }) {
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ ...line(14, t.text, { fontWeight: 500, lineHeight: 1.3 }), overflowWrap: "anywhere" }}>{card.title}</h3>
        {card.pinned ? <span style={{ ...line(12, t.label), flex: "none" }}>Pinned</span> : null}
      </div>
      <Who author={card.author} />
      <p style={{ ...line(12, t.label), marginTop: 8 }}>{card.line}</p>
      {card.kind === "published" ? (
        card.plaque ? (
          <div style={{ marginTop: 8 }}>
            <Plaque build={card.plaque} size="row" />
          </div>
        ) : null
      ) : (
        <p style={{ ...line(12, t.label), marginTop: 4 }}>{card.updated}</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {card.kind === "published" ? <PostControl to={card.to}>Open</PostControl> : null}
        <PostControl onClick={() => onReply(card.replyId)}>Reply</PostControl>
        {card.kind === "published" ? <PostControl to={card.rebuildTo}>Rebuild</PostControl> : null}
      </div>
    </>
  );
  return card.kind === "published" ? (
    <li data-testid="wall-card" data-kind={card.kind} style={{ ...offScreen, listStyle: "none", background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16, minWidth: 0 }}>
      {body}
    </li>
  ) : (
    <DashedSlot as="li" wide data-testid="wall-card" data-kind={card.kind} style={{ ...offScreen, listStyle: "none", padding: 16 }}>
      {body}
    </DashedSlot>
  );
}

export function PostWall({ cards, onReply, onReplyWithBuild, box, lineUp }: PostWallProps) {
  const columns = useCardColumns();
  return (
    <div data-columns={columns}>
      {lineUp}
      <ol aria-label="Builds in replies" style={{ margin: "24px 0 0", padding: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, alignItems: "start" }}>
        {cards.map((card) => (
          <Card key={card.replyId} card={card} onReply={onReply} />
        ))}
      </ol>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${t.hairline}` }}>
        {box ?? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={line(13, t.text2, { lineHeight: "20px" })}>{WALL_WAY_IN}</p>
            <PostPrimary onClick={onReplyWithBuild} block>
              Reply with a build
            </PostPrimary>
          </div>
        )}
      </div>
    </div>
  );
}
